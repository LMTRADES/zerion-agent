#!/usr/bin/env node
// Zerion Autonomous Agent — MCP Server
// Exposes agent control, policy management, and wallet operations 
// as MCP tools for AI agent environments.
//
// Usage: node agent/mcp-server.js
// MCP transport: stdio (JSON-RPC)

import { createAgent, PolicyPresets, PolicyEngine } from "./engine.js";

// ─── MCP Tool Definitions ───────────────────────────────────────────────────

const TOOLS = [
  {
    name: "start_agent",
    description: "Start the autonomous agent for a wallet address with specified policies and strategy",
    inputSchema: {
      type: "object",
      properties: {
        walletAddress: { type: "string", description: "Wallet address to manage" },
        strategy: { type: "string", enum: ["monitor", "rebalance", "compound"], default: "monitor" },
        preset: { type: "string", enum: ["conservative", "aggressive", "dca"], default: "conservative" },
        intervalMs: { type: "number", description: "Loop interval in ms", default: 300000 },
        dryRun: { type: "boolean", default: true },
      },
      required: ["walletAddress"],
    },
  },
  {
    name: "stop_agent",
    description: "Stop the running agent and return statistics",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_agent_status",
    description: "Get current agent status, stats, and configuration",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "update_policy",
    description: "Update agent policies at runtime",
    inputSchema: {
      type: "object",
      properties: {
        preset: { type: "string", enum: ["conservative", "aggressive", "dca"] },
        customPolicies: { type: "array", description: "Custom policy array" },
      },
    },
  },
  {
    name: "analyze_wallet",
    description: "Run a one-time wallet analysis without starting the agent",
    inputSchema: {
      type: "object",
      properties: {
        walletAddress: { type: "string", description: "Wallet address to analyze" },
      },
      required: ["walletAddress"],
    },
  },
  {
    name: "validate_action",
    description: "Check if an action is allowed under current policies",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", description: "Action type (swap, bridge, send, analyze)" },
        amountUsd: { type: "number", description: "Amount in USD" },
        chainId: { type: "string", description: "Blockchain chain ID" },
        tokenOut: { type: "string", description: "Token being sold/swapped" },
      },
      required: ["type"],
    },
  },
  {
    name: "list_policies",
    description: "List all active policies and their current state",
    inputSchema: { type: "object", properties: {} },
  },
];

// ─── MCP Server ─────────────────────────────────────────────────────────────

/** @type {import("../agent/engine.js").AutonomousAgent|null} */
let activeAgent = null;

async function handleRequest(request) {
  const { method, params, id } = request;

  if (method === "initialize") {
    return {
      jsonrpc: "2.0", id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "zerion-autonomous-agent", version: "1.0.0" },
      },
    };
  }

  if (method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }

  if (method === "tools/call") {
    const { name, arguments: args } = params;
    try {
      const result = await handleToolCall(name, args || {});
      return {
        jsonrpc: "2.0", id,
        result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },
      };
    } catch (err) {
      return {
        jsonrpc: "2.0", id,
        result: { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true },
      };
    }
  }

  if (method === "notifications/initialized") {
    return null; // No response needed
  }

  return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } };
}

async function handleToolCall(name, args) {
  switch (name) {
    case "start_agent": {
      if (activeAgent && activeAgent._running) {
        return { error: "Agent already running", status: "running" };
      }
      const policies = PolicyPresets[args.preset] || PolicyPresets.conservative;
      activeAgent = await createAgent({
        walletAddress: args.walletAddress,
        policies: args.customPolicies || policies,
        strategy: args.strategy || "monitor",
        intervalMs: args.intervalMs || 300_000,
        dryRun: args.dryRun !== false,
      });
      await activeAgent.start();
      return {
        status: "started",
        wallet: activeAgent.walletAddress,
        strategy: activeAgent.strategy,
        dryRun: activeAgent.dryRun,
        policyCount: activeAgent.policyEngine.policies.length,
      };
    }

    case "stop_agent": {
      if (!activeAgent) return { error: "No agent running" };
      activeAgent.stop();
      const stats = { ...activeAgent.stats };
      activeAgent = null;
      return { status: "stopped", stats };
    }

    case "get_agent_status": {
      if (!activeAgent) return { status: "idle", running: false };
      return {
        status: "running",
        wallet: activeAgent.walletAddress,
        strategy: activeAgent.strategy,
        dryRun: activeAgent.dryRun,
        running: activeAgent._running,
        stats: { ...activeAgent.stats },
        policies: activeAgent.policyEngine.policies.map(p => p.type),
      };
    }

    case "update_policy": {
      if (!activeAgent) return { error: "No agent running — start agent first" };
      const newPolicies = args.customPolicies || PolicyPresets[args.preset] || PolicyPresets.conservative;
      activeAgent.policyEngine.policies = newPolicies;
      return {
        status: "policies_updated",
        policyCount: newPolicies.length,
        policyTypes: newPolicies.map(p => p.type),
      };
    }

    case "analyze_wallet": {
      const tempAgent = await createAgent({
        walletAddress: args.walletAddress,
        dryRun: true,
      });
      const analysis = await tempAgent.marketAnalyzer.analyze(args.walletAddress);
      return { wallet: args.walletAddress, analysis };
    }

    case "validate_action": {
      if (!activeAgent) return { error: "No agent running — start agent first" };
      const action = {
        type: args.type,
        amountUsd: args.amountUsd,
        chainId: args.chainId,
        tokenOut: args.tokenOut,
      };
      const result = activeAgent.policyEngine.validate(action);
      return { action, ...result };
    }

    case "list_policies": {
      if (!activeAgent) return {
        policies: PolicyPresets.conservative.map(p => ({
          type: p.type,
          config: p,
        })),
        agentRunning: false,
      };
      return {
        policies: activeAgent.policyEngine.policies.map(p => ({ type: p.type, config: p })),
        agentRunning: activeAgent._running,
        stats: { ...activeAgent.stats },
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── Stdio Transport ────────────────────────────────────────────────────────

async function main() {
  process.stdin.setEncoding("utf-8");
  let buffer = "";

  process.stdin.on("data", async (chunk) => {
    buffer += chunk;
    
    // Process complete JSON-RPC messages (newline-delimited)
    const lines = buffer.split("\n");
    buffer = lines.pop(); // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const request = JSON.parse(line);
        const response = await handleRequest(request);
        if (response) {
          process.stdout.write(JSON.stringify(response) + "\n");
        }
      } catch (err) {
        process.stderr.write(`MCP parse error: ${err.message}\n`);
      }
    }
  });

  process.on("SIGINT", () => {
    if (activeAgent) activeAgent.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    if (activeAgent) activeAgent.stop();
    process.exit(0);
  });
}

main().catch(err => {
  process.stderr.write(`MCP server fatal: ${err.message}\n`);
  process.exit(1);
});
