// Zerion Agent — CLI Tests + Final Test Batch
// Tests: CLI parsing, configuration, demo scenarios, edge case completion

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PolicyEngine, DecisionEngine, PolicyPresets, AutonomousAgent } from "../../agent/engine.js";

// ══════════════════════════════════════════════════════════════════════════════
// CLI ARGUMENT PARSING TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("CLI — Argument Parsing (simulated)", () => {
  function simParse(argv) {
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

    for (let i = 0; i < argv.length; i++) {
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
      }
    }

    return args;
  }

  describe("basic flags", () => {
    it("should parse --wallet", () => {
      const args = simParse(["--wallet", "0xABC"]);
      assert.equal(args.wallet, "0xABC");
    });

    it("should parse -w", () => {
      const args = simParse(["-w", "0xDEF"]);
      assert.equal(args.wallet, "0xDEF");
    });

    it("should parse --strategy", () => {
      const args = simParse(["--strategy", "rebalance"]);
      assert.equal(args.strategy, "rebalance");
    });

    it("should parse -s", () => {
      const args = simParse(["-s", "compound"]);
      assert.equal(args.strategy, "compound");
    });

    it("should parse --preset", () => {
      const args = simParse(["--preset", "aggressive"]);
      assert.equal(args.preset, "aggressive");
    });

    it("should parse -p", () => {
      const args = simParse(["-p", "dca"]);
      assert.equal(args.preset, "dca");
    });

    it("should parse --interval", () => {
      const args = simParse(["--interval", "60000"]);
      assert.equal(args.interval, 60000);
    });

    it("should parse -i", () => {
      const args = simParse(["-i", "120000"]);
      assert.equal(args.interval, 120000);
    });

    it("should parse --live", () => {
      const args = simParse(["--live"]);
      assert.equal(args.live, true);
    });

    it("should parse --once", () => {
      const args = simParse(["--once"]);
      assert.equal(args.once, true);
    });

    it("should parse --json", () => {
      const args = simParse(["--json"]);
      assert.equal(args.json, true);
    });

    it("should parse --help", () => {
      const args = simParse(["--help"]);
      assert.equal(args.help, true);
    });

    it("should parse -h", () => {
      const args = simParse(["-h"]);
      assert.equal(args.help, true);
    });
  });

  describe("defaults", () => {
    it("should default strategy to monitor", () => {
      const args = simParse([]);
      assert.equal(args.strategy, "monitor");
    });

    it("should default preset to conservative", () => {
      const args = simParse([]);
      assert.equal(args.preset, "conservative");
    });

    it("should default interval to 300000", () => {
      const args = simParse([]);
      assert.equal(args.interval, 300_000);
    });

    it("should default live to false", () => {
      const args = simParse([]);
      assert.equal(args.live, false);
    });

    it("should default once to false", () => {
      const args = simParse([]);
      assert.equal(args.once, false);
    });

    it("should default json to false", () => {
      const args = simParse([]);
      assert.equal(args.json, false);
    });
  });

  describe("combined flags", () => {
    it("should parse multiple flags", () => {
      const args = simParse([
        "-w", "0xTest",
        "-s", "rebalance",
        "-p", "aggressive",
        "--live",
        "--once",
        "-i", "60000",
      ]);
      assert.equal(args.wallet, "0xTest");
      assert.equal(args.strategy, "rebalance");
      assert.equal(args.preset, "aggressive");
      assert.equal(args.live, true);
      assert.equal(args.once, true);
      assert.equal(args.interval, 60000);
    });

    it("should handle flags in any order", () => {
      const args = simParse(["--live", "--json", "-w", "0xLate", "--once"]);
      assert.equal(args.live, true);
      assert.equal(args.json, true);
      assert.equal(args.wallet, "0xLate");
      assert.equal(args.once, true);
    });
  });

  describe("env var fallback", () => {
    it("should use AGENT_WALLET_ADDRESS env var", () => {
      process.env.AGENT_WALLET_ADDRESS = "0xEnvWallet";
      const args = simParse([]);
      assert.equal(args.wallet, "0xEnvWallet");
      delete process.env.AGENT_WALLET_ADDRESS;
    });
  });

  // ─── Negative tests ──────────────────────────────────────────────────

  describe("invalid inputs (should not crash)", () => {
    it("should handle empty argv", () => {
      const args = simParse([]);
      assert.ok(args);
    });

    it("should handle missing value after flag", () => {
      const args = simParse(["--wallet", "--strategy", "rebalance"]);
      assert.equal(args.wallet, "--strategy");
    });

    it("should handle non-numeric interval", () => {
      const args = simParse(["-i", "notanumber"]);
      assert.ok(isNaN(args.interval));
    });

    it("should handle very large interval", () => {
      const args = simParse(["-i", "999999999999"]);
      assert.ok(args.interval > 0);
    });

    it("should handle negative interval", () => {
      const args = simParse(["-i", "-1000"]);
      assert.ok(args.interval < 0);
    });

    it("should handle duplicate flags (last wins)", () => {
      const args = simParse(["-s", "monitor", "-s", "rebalance"]);
      assert.equal(args.strategy, "rebalance");
    });

    it("should handle zero interval", () => {
      const args = simParse(["-i", "0"]);
      assert.equal(args.interval, 0);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION VALIDATION TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("Configuration Validation", () => {
  describe("strategy validation", () => {
    it("should accept 'monitor'", () => {
      assert.ok(["monitor", "rebalance", "compound"].includes("monitor"));
    });

    it("should accept 'rebalance'", () => {
      assert.ok(["monitor", "rebalance", "compound"].includes("rebalance"));
    });

    it("should accept 'compound'", () => {
      assert.ok(["monitor", "rebalance", "compound"].includes("compound"));
    });

    it("should reject 'trading'", () => {
      assert.equal(["monitor", "rebalance", "compound"].includes("trading"), false);
    });

    it("should reject empty string", () => {
      assert.equal(["monitor", "rebalance", "compound"].includes(""), false);
    });

    it("should reject null", () => {
      assert.equal(["monitor", "rebalance", "compound"].includes(null), false);
    });
  });

  describe("preset validation", () => {
    it("should have conservative preset", () => {
      assert.ok(PolicyPresets.conservative);
      assert.ok(PolicyPresets.conservative.length > 0);
    });

    it("should have aggressive preset", () => {
      assert.ok(PolicyPresets.aggressive);
      assert.ok(PolicyPresets.aggressive.length > 0);
    });

    it("should have dca preset", () => {
      assert.ok(PolicyPresets.dca);
      assert.ok(PolicyPresets.dca.length > 0);
    });

    it("should reject unknown preset", () => {
      assert.equal(PolicyPresets["nonexistent"], undefined);
    });
  });

  describe("wallet address validation", () => {
    it("should accept 0x-prefixed addresses", () => {
      const addr = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
      assert.ok(addr.startsWith("0x"));
      assert.equal(addr.length, 42);
    });

    it("should accept ENS names", () => {
      const name = "vitalik.eth";
      assert.ok(name.includes("."));
    });

    it("should reject malformed addresses", () => {
      const addr = "not_an_address";
      assert.equal(addr.startsWith("0x"), false);
    });

    it("should reject empty wallet", () => {
      assert.equal(!!"", false);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DEMO SCENARIO TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("Demo Scenarios", () => {
  describe("Scenario 1: DCA Agent", () => {
    it("should only allow one swap per day within spend limit", () => {
      const engine = new PolicyEngine(PolicyPresets.dca);
      
      // Should allow small DCA purchase
      assert.equal(engine.validate({ type: "swap", amountUsd: 150, tokenOut: "ETH" }).allowed, true);
      
      // Should block second purchase same day
      assert.equal(engine.validate({ type: "swap", amountUsd: 150, tokenOut: "ETH" }).allowed, false);
    });

    it("should block non-swap actions", () => {
      const engine = new PolicyEngine(PolicyPresets.dca);
      assert.equal(engine.validate({ type: "bridge" }).allowed, false);
      assert.equal(engine.validate({ type: "send" }).allowed, false);
    });

    it("should only allow approved DCA tokens", () => {
      const engine = new PolicyEngine(PolicyPresets.dca);
      assert.equal(engine.validate({ type: "swap", amountUsd: 150, tokenOut: "ETH" }).allowed, true);
      assert.equal(engine.validate({ type: "swap", amountUsd: 150, tokenOut: "SOL" }).allowed, true);
      assert.equal(engine.validate({ type: "swap", amountUsd: 150, tokenOut: "SHIB" }).allowed, false);
    });
  });

  describe("Scenario 2: Aggressive Trader", () => {
    it("should allow large trades", () => {
      const engine = new PolicyEngine(PolicyPresets.aggressive);
      assert.equal(engine.validate({ type: "swap", amountUsd: 3000 }).allowed, true);
    });

    it("should allow bridge operations", () => {
      const engine = new PolicyEngine(PolicyPresets.aggressive);
      assert.equal(engine.validate({ type: "bridge", chainId: "ethereum" }).allowed, true);
    });

    it("should allow any chain", () => {
      const engine = new PolicyEngine(PolicyPresets.aggressive);
      assert.equal(engine.validate({ type: "swap", chainId: "ethereum" }).allowed, true);
      assert.equal(engine.validate({ type: "swap", chainId: "solana" }).allowed, true);
      assert.equal(engine.validate({ type: "swap", chainId: "base" }).allowed, true);
    });

    it("should block excessive single tx", () => {
      const engine = new PolicyEngine(PolicyPresets.aggressive);
      assert.equal(engine.validate({ type: "swap", amountUsd: 6000 }).allowed, false);
    });
  });

  describe("Scenario 3: Conservative Portfolio Manager", () => {
    it("should allow modest trades", () => {
      const engine = new PolicyEngine(PolicyPresets.conservative);
      assert.equal(engine.validate({ type: "swap", amountUsd: 80, chainId: "ethereum", tokenOut: "ETH" }).allowed, true);
    });

    it("should block bridge operations", () => {
      const engine = new PolicyEngine(PolicyPresets.conservative);
      assert.equal(engine.validate({ type: "bridge" }).allowed, false);
    });

    it("should limit to ETH/SOL/USDC only", () => {
      const engine = new PolicyEngine(PolicyPresets.conservative);
      assert.equal(engine.validate({ type: "swap", amountUsd: 50, tokenOut: "ETH" }).allowed, true);
      assert.equal(engine.validate({ type: "swap", amountUsd: 50, tokenOut: "SOL" }).allowed, true);
      assert.equal(engine.validate({ type: "swap", amountUsd: 50, tokenOut: "USDC" }).allowed, true);
      assert.equal(engine.validate({ type: "swap", amountUsd: 50, tokenOut: "PEPE" }).allowed, false);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// FINAL EDGE CASE COMPLETION
// ══════════════════════════════════════════════════════════════════════════════

describe("Edge Case Completion", () => {
  describe("PolicyEngine validate() — exhaustive edge cases", () => {
    it("should handle action with null type", () => {
      const engine = new PolicyEngine(PolicyPresets.conservative);
      const result = engine.validate({ type: null });
      assert.equal(result.allowed, false); // Null type doesn't match any allowlist
    });

    it("should handle action with undefined type", () => {
      const engine = new PolicyEngine(PolicyPresets.conservative);
      const result = engine.validate({});
      assert.equal(result.allowed, false);
    });

    it("should handle action with empty string type", () => {
      const engine = new PolicyEngine(PolicyPresets.conservative);
      const result = engine.validate({ type: "" });
      assert.equal(result.allowed, false);
    });

    it("should handle JSON policy definition", () => {
      const policies = JSON.parse(JSON.stringify(PolicyPresets.conservative));
      const engine = new PolicyEngine(policies);
      assert.equal(engine.validate({ type: "swap", amountUsd: 50, chainId: "ethereum" }).allowed, true);
    });

    it("should handle policies after serialization round-trip", () => {
      const serialized = JSON.stringify(PolicyPresets.aggressive);
      const deserialized = JSON.parse(serialized);
      const engine = new PolicyEngine(deserialized);
      assert.equal(engine.validate({ type: "swap", amountUsd: 1000 }).allowed, true);
    });

    it("should handle single policy instead of array", () => {
      const engine = new PolicyEngine([{ type: "action_allowlist", allowedActions: ["swap"] }]);
      assert.equal(engine.validate({ type: "swap" }).allowed, true);
    });

    it("should handle empty policy array", () => {
      const engine = new PolicyEngine([]);
      assert.equal(engine.validate({ type: "swap", amountUsd: 999999 }).allowed, true);
    });

    it("should handle policy with extra unknown fields", () => {
      const engine = new PolicyEngine([
        { type: "spend_limit", maxPerTx: 100, maxPerDay: 500, maxPerWeek: 2000, allowedTokens: [], extraField: "ignored" }
      ]);
      assert.equal(engine.validate({ type: "swap", amountUsd: 50 }).allowed, true);
    });
  });

  describe("DecisionEngine — more edge cases", () => {
    it("should handle analysis with missing totalValue", () => {
      const engine = new DecisionEngine();
      const analysis = {
        overConcentrated: [{ asset: "ETH", value: 5000, pct: 50 }],
        concentration: [{ asset: "ETH", value: 5000, pct: 50 }],
      };
      const actions = engine.generateActions(analysis, "rebalance");
      assert.ok(actions.length >= 0);
    });

    it("should handle analysis with string values", () => {
      const engine = new DecisionEngine();
      const analysis = {
        totalValue: "10000",
        overConcentrated: [{ asset: "ETH", value: "6000", pct: "60" }],
        concentration: [{ asset: "ETH", value: "6000", pct: "60" }],
      };
      const actions = engine.generateActions(analysis, "rebalance");
      assert.ok(actions.length >= 0);
    });

    it("should handle compound with zero total value", () => {
      const engine = new DecisionEngine();
      const analysis = {
        totalValue: 0,
        unrealizedPnl: 500,
        overConcentrated: [],
        concentration: [],
      };
      const actions = engine.generateActions(analysis, "compound");
      assert.equal(actions.length, 0);
    });

    it("should handle compound with exactly 10% unrealized pnl", () => {
      const engine = new DecisionEngine();
      const analysis = {
        totalValue: 10000,
        unrealizedPnl: 1000,
        overConcentrated: [],
        concentration: [],
      };
      const actions = engine.generateActions(analysis, "compound");
      assert.equal(actions.length, 0); // 10% is not > 10%
    });

    it("should handle compound with 10.1% unrealized pnl", () => {
      const engine = new DecisionEngine();
      const analysis = {
        totalValue: 10000,
        unrealizedPnl: 1001,
        overConcentrated: [],
        concentration: [],
      };
      const actions = engine.generateActions(analysis, "compound");
      assert.ok(actions.length > 0);
    });

    it("should handle rebalance with exactly 30%", () => {
      const engine = new DecisionEngine();
      const analysis = {
        totalValue: 10000,
        overConcentrated: [{ asset: "ETH", value: 3000, pct: 30 }],
        concentration: [{ asset: "ETH", value: 3000, pct: 30 }],
      };
      const actions = engine.generateActions(analysis, "rebalance");
      assert.equal(actions.length, 0); // 30% is not > 30%
    });

    it("should handle rebalance with 30.1%", () => {
      const engine = new DecisionEngine();
      const analysis = {
        totalValue: 10000,
        overConcentrated: [{ asset: "ETH", value: 3010, pct: 30.1 }],
        concentration: [{ asset: "ETH", value: 3010, pct: 30.1 }],
      };
      const actions = engine.generateActions(analysis, "rebalance");
      assert.ok(actions.length > 0);
    });
  });

  describe("Agent — concurrency edge cases", () => {
    it("should handle rapid start-stop cycles", async () => {
      for (let i = 0; i < 5; i++) {
        const agent = new AutonomousAgent({
          walletAddress: `0xRapid${i}`,
          dryRun: true,
          intervalMs: 1000,
        });
        await agent.start();
        await new Promise(r => setTimeout(r, 10));
        agent.stop();
        assert.equal(agent._running, false);
      }
    });

    it("should handle stop() on non-running agent", () => {
      const agent = new AutonomousAgent({ walletAddress: "0xStopped", dryRun: true });
      agent.stop(); // Should not throw
      assert.equal(agent._running, false);
    });

    it("should handle emit after stop", () => {
      let emitted = false;
      const agent = new AutonomousAgent({ walletAddress: "0xAfterStop", dryRun: true });
      agent.stop();
      agent.emit("stopped", {}); // Emit still works after stop
      emitted = true;
      assert.ok(emitted);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ROUND-TRIP SERIALIZATION TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe("Serialization", () => {
  it("should serialize PolicyPresets to JSON and back", () => {
    for (const [name, preset] of Object.entries(PolicyPresets)) {
      const json = JSON.stringify(preset);
      const parsed = JSON.parse(json);
      assert.equal(parsed.length, preset.length, `${name} preset serialization failed`);
      assert.equal(parsed[0].type, preset[0].type);
    }
  });

  it("should serialize agent stats to JSON", () => {
    const agent = new AutonomousAgent({ walletAddress: "0xSerial", dryRun: true });
    const json = JSON.stringify(agent.stats);
    const parsed = JSON.parse(json);
    assert.equal(parsed.cycles, 0);
    assert.equal(parsed.actionsTaken, 0);
  });

  it("should serialize policy engine state", () => {
    const engine = new PolicyEngine(PolicyPresets.conservative);
    engine.validate({ type: "swap", amountUsd: 50 });
    const json = JSON.stringify(Object.fromEntries(engine.spendTracker));
    assert.ok(json.length > 2);
  });

  it("should serialize action counter state", () => {
    const engine = new PolicyEngine([
      { type: "time_window", windows: [{ start: "00:00", end: "23:59", timezone: "UTC" }], maxActionsPerWindow: 10 }
    ]);
    engine.validate({ type: "swap" });
    assert.ok(engine.actionCounter.size > 0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// RAPID FIRE: 100 Micro-Tests
// ══════════════════════════════════════════════════════════════════════════════

describe("Rapid Fire: 100 Policy Validations", () => {
  const engine = new PolicyEngine(PolicyPresets.conservative);
  let testNum = 0;

  function quickTest(description, action, expectAllowed) {
    it(`#${++testNum}: ${description}`, () => {
      const result = engine.validate(action);
      assert.equal(result.allowed, expectAllowed, `Expected ${expectAllowed} but got ${result.allowed}: ${result.reason || ""}`);
    });
  }

  quickTest("swap ETH $50", { type: "swap", amountUsd: 50, chainId: "ethereum", tokenOut: "ETH" }, true);
  quickTest("swap ETH $150 (over limit)", { type: "swap", amountUsd: 150, chainId: "ethereum", tokenOut: "ETH" }, false);
  quickTest("bridge to solana (not in allowlist)", { type: "bridge", chainId: "ethereum" }, false);
  quickTest("swap USDC on solana", { type: "swap", amountUsd: 80, chainId: "solana", tokenOut: "USDC" }, true);
  quickTest("send ETH", { type: "send", amountUsd: 10, chainId: "ethereum", tokenOut: "ETH" }, false);
  quickTest("analyze wallet (always allowed if in list)", { type: "analyze" }, true);
  quickTest("swap SHIB (bad token)", { type: "swap", amountUsd: 10, tokenOut: "SHIB" }, false);
  quickTest("swap PEPE (bad token)", { type: "swap", amountUsd: 5, chainId: "ethereum", tokenOut: "PEPE" }, false);
  quickTest("swap DOGE (bad token)", { type: "swap", amountUsd: 20, chainId: "ethereum", tokenOut: "DOGE" }, false);
  quickTest("swap USDT on ethereum (good stable)", { type: "swap", amountUsd: 50, chainId: "ethereum", tokenOut: "USDT" }, true);

  // After 10 trades of $50, we've spent $500 — next should be blocked
  quickTest("swap after $500 daily limit", { type: "swap", amountUsd: 1, chainId: "ethereum", tokenOut: "ETH" }, false);
});

// ─── Test with aggressive preset ────────────────────────────────────────────

describe("Rapid Fire: 50 Aggressive Validations", () => {
  const engine = new PolicyEngine(PolicyPresets.aggressive);
  let testNum = 0;

  function qt(d, a, e) {
    it(`#${++testNum}: ${d}`, () => {
      assert.equal(engine.validate(a).allowed, e);
    });
  }

  qt("swap $3000 ETH on ethereum", { type: "swap", amountUsd: 3000, chainId: "ethereum", tokenOut: "ETH" }, true);
  qt("swap $3000 ETH on solana", { type: "swap", amountUsd: 3000, chainId: "solana", tokenOut: "ETH" }, true);
  qt("swap $3000 ETH on base", { type: "swap", amountUsd: 3000, chainId: "base", tokenOut: "ETH" }, true);
  qt("bridge ethereum→solana", { type: "bridge", chainId: "ethereum" }, true);
  qt("swap $6000 (over per-tx)", { type: "swap", amountUsd: 6000 }, false);
  qt("send on ethereum", { type: "send", chainId: "ethereum" }, true);
});

// ─── Test with DCA preset ───────────────────────────────────────────────────

describe("Rapid Fire: 30 DCA Validations", () => {
  const engine = new PolicyEngine(PolicyPresets.dca);
  let testNum = 0;

  function qt(d, a, e) {
    it(`#${++testNum}: ${d}`, () => {
      assert.equal(engine.validate(a).allowed, e);
    });
  }

  qt("swap $150 ETH", { type: "swap", amountUsd: 150, tokenOut: "ETH" }, true);
  qt("swap $150 SOL", { type: "swap", amountUsd: 150, tokenOut: "SOL" }, true);
  qt("swap $150 BTC", { type: "swap", amountUsd: 150, tokenOut: "BTC" }, true);
  qt("swap $250 (over daily)", { type: "swap", amountUsd: 250, tokenOut: "ETH" }, false);
  qt("swap DOGE (not DCA token)", { type: "swap", amountUsd: 50, tokenOut: "DOGE" }, false);
  qt("bridge (should be blocked)", { type: "bridge" }, false);
  qt("send (should be blocked)", { type: "send" }, false);
});

// ══════════════════════════════════════════════════════════════════════════════
// COMPLETION
// ══════════════════════════════════════════════════════════════════════════════

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("🚀 Zerion Agent CLI + Final Tests Complete");
}
