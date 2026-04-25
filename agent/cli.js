#!/usr/bin/env node
// Zerion Autonomous Agent — CLI Entry Point
// Run the agent from command line: node agent/cli.js --wallet 0x... --strategy rebalance

import { createAgent, PolicyPresets } from "./engine.js";

function usage() {
  console.log(`
Zerion Autonomous Agent — CLI

Usage: node agent/cli.js [options]

Options:
  --wallet, -w     Wallet address to manage (required)
  --strategy, -s   Strategy: monitor, rebalance, compound (default: monitor)
  --preset, -p     Policy preset: conservative, aggressive, dca (default: conservative)
  --interval, -i   Loop interval in ms (default: 300000 = 5 min)
  --live           Execute real transactions (default: dry-run)
  --once           Run one cycle and exit (default: continuous)
  --json           Output JSON only (no console logs)
  --help, -h       Show this help

Policy Presets:
  conservative — $100 max/tx, $500/day, ETH/SOL/USDC only, 09:00-17:00
  aggressive   — $5000 max/tx, $25000/day, all chains, all hours
  dca          — $200 max/tx, $200/day, DCA into ETH/SOL/BTC

Strategies:
  monitor   — Watch wallet, report status (no actions)
  rebalance — Rebalance over-concentrated positions (>30%)
  compound  — Take profits on large unrealized gains (>10%)

Examples:
  # Monitor a wallet with conservative policies (dry-run)
  node agent/cli.js --wallet 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

  # Aggressive trading agent, live execution, 1-min intervals
  node agent/cli.js -w 0x... -s rebalance -p aggressive --live -i 60000

  # DCA agent, one cycle only
  node agent/cli.js -w 0x... -s monitor -p dca --once
`);
}

function parseArgs(argv) {
  const args = {
    wallet: process.env.AGENT_WALLET_ADDRESS || null,
    strategy: "monitor",
    preset: "conservative",
    interval: 300_000,
    live: false,
    once: false,
    json: false,
    help: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case "--wallet": case "-w": args.wallet = next; i++; break;
      case "--strategy": case "-s": args.strategy = next; i++; break;
      case "--preset": case "-p": args.preset = next; i++; break;
      case "--interval": case "-i": args.interval = parseInt(next, 10); i++; break;
      case "--live": args.live = true; break;
      case "--once": args.once = true; break;
      case "--json": args.json = true; break;
      case "--help": case "-h": args.help = true; break;
      default:
        if (arg.startsWith("--")) {
          console.error(`Unknown option: ${arg}`);
          args.help = true;
        }
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    usage();
    process.exit(0);
  }

  if (!args.wallet) {
    console.error("Error: --wallet is required");
    usage();
    process.exit(1);
  }

  if (!["monitor", "rebalance", "compound"].includes(args.strategy)) {
    console.error(`Error: Unknown strategy "${args.strategy}". Use monitor, rebalance, or compound.`);
    process.exit(1);
  }

  if (!["conservative", "aggressive", "dca"].includes(args.preset)) {
    console.error(`Error: Unknown preset "${args.preset}". Use conservative, aggressive, or dca.`);
    process.exit(1);
  }

  const policies = PolicyPresets[args.preset];
  const config = {
    walletAddress: args.wallet,
    policies,
    strategy: args.strategy,
    intervalMs: args.interval,
    dryRun: !args.live,
  };

  if (!args.json) {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║         ZERION AUTONOMOUS AGENT                          ║
╠══════════════════════════════════════════════════════════╣
║ Wallet:    ${args.wallet.slice(0, 16)}...
║ Strategy:  ${args.strategy.padEnd(24)}
║ Preset:    ${args.preset.padEnd(24)}
║ Mode:      ${config.dryRun ? "DRY-RUN (safe)" : "LIVE ⚠️"  }
║ Interval:  ${Math.round(args.interval / 1000)}s
╚══════════════════════════════════════════════════════════╝
`);
  }

  const agent = await createAgent(config);

  // JSON mode: emit events as JSON lines
  if (args.json) {
    agent.on("cycle:complete", (data) => process.stdout.write(JSON.stringify(data) + "\n"));
    agent.on("action:simulated", (data) => process.stdout.write(JSON.stringify({ simulated: data }) + "\n"));
    agent.on("action:blocked", (data) => process.stdout.write(JSON.stringify({ blocked: data }) + "\n"));
    agent.on("cycle:error", (data) => process.stdout.write(JSON.stringify({ error: data }) + "\n"));
    agent.on("stopped", (stats) => process.stdout.write(JSON.stringify({ stopped: stats }) + "\n"));
  }

  // System signals
  process.on("SIGINT", () => {
    if (!args.json) console.log("\nShutting down...");
    agent.stop();
    if (!args.json) console.log(JSON.stringify(agent.stats, null, 2));
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    agent.stop();
    process.exit(0);
  });

  await agent.start();

  if (args.once) {
    // Wait for first cycle to complete
    agent.once("cycle:complete", () => {
      agent.stop();
      if (!args.json) {
        console.log("\n✅ One cycle complete");
        console.log(JSON.stringify(agent.stats, null, 2));
      }
      process.exit(0);
    });
    
    // Timeout after 60s
    setTimeout(() => {
      if (agent._running) {
        agent.stop();
        if (!args.json) console.log("⚠️  Timeout — stopping after 60s");
        process.exit(1);
      }
    }, 60_000);
  }
}

main().catch(err => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
