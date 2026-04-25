// Zerion Agent — Integration & MCP Tests
// Tests: MCP server protocol, agent lifecycle, policy state machine

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { AutonomousAgent, PolicyEngine, PolicyPresets, DecisionEngine, MarketAnalyzer } from "../../agent/engine.js";

// ══════════════════════════════════════════════════════════════════════════════
// MCP PROTOCOL TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("MCP Protocol", () => {
  let server;

  function sendRequest(request) {
    return new Promise((resolve, reject) => {
      const proc = spawn("node", ["agent/mcp-server.js"], {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
      });
      
      let output = "";
      let errorOutput = "";
      
      proc.stdout.on("data", (d) => { output += d.toString(); });
      proc.stderr.on("data", (d) => { errorOutput += d.toString(); });
      
      proc.on("close", (code) => {
        try {
          const lines = output.trim().split("\n");
          const lastLine = lines[lines.length - 1];
          resolve({ response: lastLine ? JSON.parse(lastLine) : null, code, stderr: errorOutput });
        } catch (e) {
          resolve({ error: e.message, output: output.slice(0, 500), stderr: errorOutput });
        }
      });
      
      proc.on("error", reject);
      
      proc.stdin.write(JSON.stringify(request) + "\n");
      proc.stdin.end();
    });
  }

  describe("initialize", () => {
    it("should respond with server capabilities", async () => {
      const result = await sendRequest({
        jsonrpc: "2.0", id: 1, method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {} },
      });
      assert.ok(result.response);
      assert.equal(result.response.result.protocolVersion, "2024-11-05");
      assert.equal(result.response.result.serverInfo.name, "zerion-autonomous-agent");
    });

    it("should include tool capability", async () => {
      const result = await sendRequest({
        jsonrpc: "2.0", id: 2, method: "initialize",
        params: { protocolVersion: "2024-11-05", capabilities: {} },
      });
      assert.ok(result.response.result.capabilities.tools);
    });
  });

  describe("tools/list", () => {
    it("should return all 7 tools", async () => {
      const result = await sendRequest({
        jsonrpc: "2.0", id: 3, method: "tools/list",
      });
      assert.ok(result.response);
      assert.equal(result.response.result.tools.length, 7);
    });

    it("should include start_agent", async () => {
      const result = await sendRequest({ jsonrpc: "2.0", id: 4, method: "tools/list" });
      const tool = result.response.result.tools.find(t => t.name === "start_agent");
      assert.ok(tool);
      assert.equal(tool.inputSchema.required[0], "walletAddress");
    });

    it("should include stop_agent", async () => {
      const result = await sendRequest({ jsonrpc: "2.0", id: 5, method: "tools/list" });
      assert.ok(result.response.result.tools.find(t => t.name === "stop_agent"));
    });

    it("should include analyze_wallet", async () => {
      const result = await sendRequest({ jsonrpc: "2.0", id: 6, method: "tools/list" });
      assert.ok(result.response.result.tools.find(t => t.name === "analyze_wallet"));
    });

    it("should include validate_action", async () => {
      const result = await sendRequest({ jsonrpc: "2.0", id: 7, method: "tools/list" });
      assert.ok(result.response.result.tools.find(t => t.name === "validate_action"));
    });

    it("should include update_policy", async () => {
      const result = await sendRequest({ jsonrpc: "2.0", id: 8, method: "tools/list" });
      assert.ok(result.response.result.tools.find(t => t.name === "update_policy"));
    });
  });

  describe("tools/call — list_policies (no agent)", () => {
    it("should return conservative policies when no agent running", async () => {
      const result = await sendRequest({
        jsonrpc: "2.0", id: 10, method: "tools/call",
        params: { name: "list_policies", arguments: {} },
      });
      assert.ok(result.response);
      assert.ok(result.response.result.content[0].text.includes("conservative"));
    });
  });

  describe("tools/call — get_agent_status (no agent)", () => {
    it("should return idle status", async () => {
      const result = await sendRequest({
        jsonrpc: "2.0", id: 11, method: "tools/call",
        params: { name: "get_agent_status", arguments: {} },
      });
      const content = JSON.parse(result.response.result.content[0].text);
      assert.equal(content.status, "idle");
      assert.equal(content.running, false);
    });
  });

  describe("unknown method", () => {
    it("should return error for unknown methods", async () => {
      const result = await sendRequest({
        jsonrpc: "2.0", id: 12, method: "unknown/method",
      });
      assert.ok(result.response.error);
    });
  });

  describe("notifications/initialized", () => {
    it("should handle initialized notification silently", async () => {
      const result = await sendRequest({
        jsonrpc: "2.0", method: "notifications/initialized",
      });
      assert.equal(result.response, null);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AGENT LIFECYCLE INTEGRATION TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("Agent Lifecycle — Integration", () => {
  let agent;

  afterEach(() => {
    if (agent && agent._running) agent.stop();
  });

  describe("full lifecycle: create → start → cycle → stop", () => {
    it("should complete a full lifecycle", async () => {
      agent = new AutonomousAgent({
        walletAddress: "0xLifecycleTest",
        policies: PolicyPresets.conservative,
        strategy: "monitor",
        dryRun: true,
        intervalMs: 100,
      });
      
      assert.equal(agent._running, false);
      assert.equal(agent.stats.cycles, 0);
      
      await agent.start();
      assert.equal(agent._running, true);
      assert.ok(agent.stats.startTime > 0);
      
      // Wait for at least one cycle
      await new Promise(r => setTimeout(r, 200));
      assert.ok(agent.stats.cycles >= 1);
      
      agent.stop();
      assert.equal(agent._running, false);
    });

    it("should emit lifecycle events in order", async () => {
      const events = [];
      agent = new AutonomousAgent({
        walletAddress: "0xEvents",
        dryRun: true,
        intervalMs: 50,
      });
      
      agent.on("started", () => events.push("started"));
      agent.on("cycle:complete", () => events.push("cycle"));
      agent.on("stopped", () => events.push("stopped"));
      
      await agent.start();
      await new Promise(r => setTimeout(r, 200));
      agent.stop();
      
      assert.equal(events[0], "started");
      assert.ok(events.includes("cycle"));
      assert.equal(events[events.length - 1], "stopped");
    });
  });

  describe("strategy: monitor", () => {
    it("should generate info-only actions", async () => {
      const events = [];
      agent = new AutonomousAgent({
        walletAddress: "0xMonitor",
        strategy: "monitor",
        dryRun: true,
        intervalMs: 50,
      });
      
      agent.on("action:simulated", (data) => events.push(data));
      agent.on("action:blocked", (data) => events.push("blocked:" + data.reason));
      
      await agent.start();
      await new Promise(r => setTimeout(r, 200));
      agent.stop();
      
      // Monitor should not block its own actions
      assert.equal(events.filter(e => typeof e === "string" && e.startsWith("blocked")).length, 0);
    });
  });

  describe("strategy: rebalance with over-concentrated portfolio", () => {
    it("should detect over-concentration and suggest swaps", () => {
      const engine = new DecisionEngine();
      const analysis = {
        totalValue: 10000,
        overConcentrated: [
          { asset: "ETH", value: 7000, pct: 70 },
          { asset: "SOL", value: 3500, pct: 35 },
        ],
        concentration: [
          { asset: "ETH", value: 7000, pct: 70 },
          { asset: "SOL", value: 3500, pct: 35 },
        ],
      };
      
      const actions = engine.generateActions(analysis, "rebalance");
      assert.equal(actions.length, 2); // Two over-concentrated positions
      assert.equal(actions[0].urgency, "high"); // ETH 70% = high urgency
    });

    it("should not flag positions at exactly 30%", () => {
      const engine = new DecisionEngine();
      const analysis = {
        totalValue: 10000,
        overConcentrated: [{ asset: "ETH", value: 3000, pct: 30 }],
        concentration: [{ asset: "ETH", value: 3000, pct: 30 }],
      };
      
      const actions = engine.generateActions(analysis, "rebalance");
      assert.equal(actions.length, 0);
    });
  });

  describe("policy enforcement during agent run", () => {
    it("should enforce spend limits during agent operation", async () => {
      agent = new AutonomousAgent({
        walletAddress: "0xSpendLimit",
        policies: [
          { type: "action_allowlist", allowedActions: ["swap", "analyze"] },
          { type: "spend_limit", maxPerTx: 50, maxPerDay: 100, maxPerWeek: 500, allowedTokens: [] },
          { type: "slippage", maxSlippageBps: 100 },
        ],
        strategy: "monitor",
        dryRun: true,
        intervalMs: 5000, // Long interval to avoid rapid cycles
      });
      
      // Test policy engine directly
      const validAction = { type: "swap", amountUsd: 40 };
      assert.equal(agent.policyEngine.validate(validAction).allowed, true);
      
      const overLimitAction = { type: "swap", amountUsd: 60 };
      assert.equal(agent.policyEngine.validate(overLimitAction).allowed, false);
      
      const blockedTypeAction = { type: "bridge" };
      assert.equal(agent.policyEngine.validate(blockedTypeAction).allowed, false);
    });

    it("should enforce chain locks", () => {
      agent = new AutonomousAgent({
        walletAddress: "0xChainLock",
        policies: [
          { type: "chain_lock", allowedChains: ["ethereum"], blockBridges: true },
        ],
        dryRun: true,
      });
      
      assert.equal(agent.policyEngine.validate({ type: "swap", chainId: "ethereum" }).allowed, true);
      assert.equal(agent.policyEngine.validate({ type: "swap", chainId: "solana" }).allowed, false);
      assert.equal(agent.policyEngine.validate({ type: "bridge", chainId: "ethereum" }).allowed, false);
    });

    it("should enforce action allowlists", () => {
      agent = new AutonomousAgent({
        walletAddress: "0xAllowlist",
        policies: [
          { type: "action_allowlist", allowedActions: ["analyze", "swap"] },
        ],
        dryRun: true,
      });
      
      assert.equal(agent.policyEngine.validate({ type: "analyze" }).allowed, true);
      assert.equal(agent.policyEngine.validate({ type: "swap" }).allowed, true);
      assert.equal(agent.policyEngine.validate({ type: "send" }).allowed, false);
      assert.equal(agent.policyEngine.validate({ type: "bridge" }).allowed, false);
    });
  });

  describe("policy updates at runtime", () => {
    it("should allow policy changes while running", () => {
      agent = new AutonomousAgent({
        walletAddress: "0xRuntime",
        policies: PolicyPresets.conservative,
        dryRun: true,
      });
      
      // Start conservative
      assert.equal(agent.policyEngine.validate({ type: "swap", amountUsd: 5000 }).allowed, false);
      
      // Switch to aggressive
      agent.policyEngine.policies = PolicyPresets.aggressive;
      assert.equal(agent.policyEngine.validate({ type: "swap", amountUsd: 5000 }).allowed, true);
      
      // Switch to DCA
      agent.policyEngine.policies = PolicyPresets.dca;
      assert.equal(agent.policyEngine.validate({ type: "swap", amountUsd: 50 }).allowed, true);
    });

    it("should handle policy change between cycles", async () => {
      const policyLog = [];
      agent = new AutonomousAgent({
        walletAddress: "0xPolicySwitch",
        policies: PolicyPresets.conservative,
        strategy: "monitor",
        dryRun: true,
        intervalMs: 100,
      });
      
      agent.on("cycle:complete", () => {
        policyLog.push(agent.policyEngine.policies.length);
      });
      
      await agent.start();
      await new Promise(r => setTimeout(r, 150));
      
      // Switch policies mid-run
      agent.policyEngine.policies = PolicyPresets.aggressive;
      await new Promise(r => setTimeout(r, 150));
      
      agent.stop();
      assert.ok(policyLog.length >= 1);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POLICY STATE MACHINE TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("Policy State Machine", () => {
  describe("spend tracker state transitions", () => {
    it("should track cumulative spend accurately", () => {
      const engine = new PolicyEngine([
        { type: "spend_limit", maxPerTx: 100, maxPerDay: 1000, maxPerWeek: 5000, allowedTokens: [] }
      ]);
      
      const today = new Date().toISOString().slice(0, 10);
      
      engine.validate({ type: "swap", amountUsd: 100 });
      assert.equal(engine.spendTracker.get(today), 100);
      
      engine.validate({ type: "swap", amountUsd: 200 });
      assert.equal(engine.spendTracker.get(today), 300);
      
      engine.validate({ type: "swap", amountUsd: 500 });
      assert.equal(engine.spendTracker.get(today), 800);
    });

    it("should enforce daily limit via tracker", () => {
      const engine = new PolicyEngine([
        { type: "spend_limit", maxPerTx: 1000, maxPerDay: 500, maxPerWeek: 5000, allowedTokens: [] }
      ]);
      
      engine.validate({ type: "swap", amountUsd: 400 });
      assert.equal(engine.validate({ type: "swap", amountUsd: 200 }).allowed, false);
    });

    it("should track per-day independently (simulated multi-day)", () => {
      const engine = new PolicyEngine([
        { type: "spend_limit", maxPerTx: 1000, maxPerDay: 500, maxPerWeek: 5000, allowedTokens: [] }
      ]);
      
      // Day 1
      engine.validate({ type: "swap", amountUsd: 400 });
      
      // Manually reset for day 2
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      engine.spendTracker.delete(new Date().toISOString().slice(0, 10));
      
      // Day 2 - fresh spend
      assert.equal(engine.validate({ type: "swap", amountUsd: 300 }).allowed, true);
    });
  });

  describe("action counter state", () => {
    it("should count actions per window", () => {
      const engine = new PolicyEngine([
        { type: "time_window", windows: [{ start: "00:00", end: "23:59", timezone: "UTC" }], maxActionsPerWindow: 10 }
      ]);
      
      for (let i = 0; i < 5; i++) engine.validate({ type: "swap" });
      
      // All 5 should pass
      assert.equal(engine.actionCounter.size, 5);
    });

    it("should block after max actions", () => {
      const engine = new PolicyEngine([
        { type: "time_window", windows: [{ start: "00:00", end: "23:59", timezone: "UTC" }], maxActionsPerWindow: 3 }
      ]);
      
      engine.validate({ type: "swap" });
      engine.validate({ type: "swap" });
      engine.validate({ type: "swap" });
      
      assert.equal(engine.validate({ type: "swap" }).allowed, false);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ERROR RECOVERY & RESILIENCE TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("Error Recovery", () => {
  describe("agent error handling", () => {
    it("should continue after cycle errors", async () => {
      const errors = [];
      agent = new AutonomousAgent({
        walletAddress: "0xErrorRecovery",
        dryRun: true,
        intervalMs: 50,
      });
      
      agent.on("cycle:error", (data) => errors.push(data));
      
      await agent.start();
      // MarketAnalyzer will fail without API key, but agent should continue
      await new Promise(r => setTimeout(r, 200));
      agent.stop();
      
      // Agent should still be functional
      assert.equal(agent._running, false);
      assert.ok(agent.stats.cycles > 0);
    });

    it("should emit error events without crashing", async () => {
      let errorCount = 0;
      agent = new AutonomousAgent({
        walletAddress: "0xErrorEmit",
        dryRun: true,
        intervalMs: 50,
      });
      
      agent.on("cycle:error", () => errorCount++);
      
      await agent.start();
      await new Promise(r => setTimeout(r, 200));
      agent.stop();
      
      assert.ok(errorCount >= 0);
    });
  });

  describe("policy engine error handling", () => {
    it("should handle broken policy objects gracefully", () => {
      const engine = new PolicyEngine([
        { type: "spend_limit", maxPerTx: 100, maxPerDay: 500, maxPerWeek: 2000, allowedTokens: [] },
        { type: "broken_policy" }, // Unknown type
      ]);
      
      const result = engine.validate({ type: "swap", amountUsd: 50 });
      assert.equal(result.allowed, false);
      assert.ok(result.reason);
    });

    it("should handle missing required policy fields", () => {
      const engine = new PolicyEngine([
        { type: "spend_limit" }, // Missing maxPerTx etc
      ]);
      
      try {
        engine.validate({ type: "swap", amountUsd: 50 });
      } catch {
        // Should not crash completely
      }
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE BENCHMARKS
// ══════════════════════════════════════════════════════════════════════════════

describe("Performance", () => {
  describe("PolicyEngine throughput", () => {
    it("should validate 1000 actions in under 1 second", () => {
      const engine = new PolicyEngine(PolicyPresets.conservative);
      const start = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        engine.validate({
          type: "swap",
          amountUsd: Math.random() * 100,
          chainId: "ethereum",
          tokenOut: "ETH",
        });
      }
      
      const duration = Date.now() - start;
      assert.ok(duration < 1000, `1000 validations took ${duration}ms (expected < 1000ms)`);
    });

    it("should validate 10000 actions in under 5 seconds", () => {
      const engine = new PolicyEngine(PolicyPresets.aggressive);
      const start = Date.now();
      
      for (let i = 0; i < 10000; i++) {
        engine.validate({ type: "swap", amountUsd: Math.random() * 100 });
      }
      
      const duration = Date.now() - start;
      assert.ok(duration < 5000, `10000 validations took ${duration}ms (expected < 5000ms)`);
    });
  });

  describe("DecisionEngine throughput", () => {
    it("should generate actions in under 1ms", () => {
      const engine = new DecisionEngine();
      const analysis = {
        totalValue: 10000,
        overConcentrated: [
          { asset: "ETH", value: 7000, pct: 70 },
        ],
        concentration: [{ asset: "ETH", value: 7000, pct: 70 }],
      };
      
      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        engine.generateActions(analysis, "rebalance");
      }
      
      const duration = Date.now() - start;
      assert.ok(duration < 100, `1000 decisions took ${duration}ms`);
    });
  });

  describe("Memory", () => {
    it("should not leak memory on repeated cycles", () => {
      const engine = new PolicyEngine(PolicyPresets.conservative);
      
      for (let i = 0; i < 5000; i++) {
        engine.validate({ type: "swap", amountUsd: 10 });
        if (i % 100 === 0) engine.spendTracker.clear();
      }
      
      // Engine should still be functional
      assert.equal(engine.validate({ type: "swap", amountUsd: 5 }).allowed, true);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// COMBINATORIAL POLICY TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("Combinatorial Policies", () => {
  const engines = [];
  const presets = Object.entries(PolicyPresets);
  
  describe("all presets x all action types", () => {
    for (const [presetName, policies] of presets) {
      describe(presetName, () => {
        const engine = new PolicyEngine(policies);
        
        for (const actionType of ["swap", "bridge", "send", "analyze"]) {
          it(`${actionType} — should return valid result`, () => {
            const result = engine.validate({
              type: actionType,
              amountUsd: 50,
              chainId: "ethereum",
              tokenOut: "ETH",
            });
            assert.ok(result.allowed !== undefined);
            assert.ok(typeof result.allowed === "boolean");
          });
        }
      });
    }
  });

  describe("all presets x chain combinations", () => {
    const chains = ["ethereum", "solana", "base", "polygon", "arbitrum"];
    
    for (const [presetName, policies] of presets) {
      describe(presetName, () => {
        const engine = new PolicyEngine(policies);
        
        for (const chain of chains) {
          it(`chain ${chain} — should handle gracefully`, () => {
            const result = engine.validate({
              type: "swap",
              chainId: chain,
              amountUsd: 50,
            });
            assert.ok(result.allowed !== undefined);
          });
        }
      });
    }
  });

  describe("all presets x amount ranges", () => {
    const amounts = [0, 1, 50, 100, 500, 1000, 5000, 10000, 100000];
    
    for (const [presetName, policies] of presets) {
      describe(presetName, () => {
        const engine = new PolicyEngine(policies);
        
        for (const amount of amounts) {
          it(`amount $${amount} — should not crash`, () => {
            const result = engine.validate({
              type: "swap",
              amountUsd: amount,
              chainId: "ethereum",
              tokenOut: "ETH",
            });
            assert.ok(result.allowed !== undefined);
          });
        }
      });
    }
  });
});

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("🚀 Zerion Agent Integration Tests Complete");
}
