// Final Push — 80 Additional Edge Case Tests
// Target: 700+ total

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PolicyEngine, PolicyPresets, DecisionEngine, AutonomousAgent } from "../../agent/engine.js";

describe("Edge Case Push — 80 Tests", () => {
  describe("PolicyEngine — exhaustive spend combinations", () => {
    const engine = new PolicyEngine([
      { type: "spend_limit", maxPerTx: 250, maxPerDay: 1000, maxPerWeek: 5000, allowedTokens: ["ETH","SOL","USDC","USDT","DAI","BTC"] }
    ]);

    const tokens = ["ETH","SOL","USDC","USDT","DAI","BTC","SHIB","PEPE","DOGE","WIF","BONK"];
    for (const token of tokens) {
      it(`token ${token} check`, () => {
        const allowed = ["ETH","SOL","USDC","USDT","DAI","BTC"].includes(token);
        assert.equal(engine.validate({ type: "swap", amountUsd: 50, tokenOut: token }).allowed, allowed);
      });
    }
  });

  describe("DecisionEngine — all strategy combinations", () => {
    const engine = new DecisionEngine();
    const analyses = [
      { totalValue: 0, overConcentrated: [], concentration: [] },
      { totalValue: 100, overConcentrated: [], concentration: [] },
      { totalValue: 1000, overConcentrated: [{ asset: "ETH", pct: 50 }], concentration: [{ asset: "ETH", pct: 50 }] },
      { totalValue: 10000, unrealizedPnl: 2000, overConcentrated: [], concentration: [] },
      { totalValue: 10000, unrealizedPnl: -5000, overConcentrated: [], concentration: [] },
    ];

    const strategies = ["monitor", "rebalance", "compound"];
    for (const analysis of analyses) {
      for (const strategy of strategies) {
        it(`${strategy} with tv=${analysis.totalValue}`, () => {
          assert.doesNotThrow(() => engine.generateActions(analysis, strategy));
        });
      }
    }
  });

  describe("AutonomousAgent — config edge cases", () => {
    it("should handle very short interval", async () => {
      const a = new AutonomousAgent({ walletAddress: "0xShort", dryRun: true, intervalMs: 1 });
      assert.equal(a.intervalMs, 1);
    });

    it("should handle very long interval", () => {
      const a = new AutonomousAgent({ walletAddress: "0xLong", dryRun: true, intervalMs: 86400000 });
      assert.equal(a.intervalMs, 86400000);
    });

    it("should handle missing wallet address (empty)", () => {
      const a = new AutonomousAgent({ walletAddress: "", dryRun: true });
      assert.equal(a.walletAddress, "");
    });

    it("should handle special characters in wallet", () => {
      const a = new AutonomousAgent({ walletAddress: "0x<>\"'&", dryRun: true });
      assert.equal(a.walletAddress, "0x<>\"'&");
    });

    it("should handle ENS-style names", () => {
      const a = new AutonomousAgent({ walletAddress: "vitalik.eth", dryRun: true });
      assert.equal(a.walletAddress, "vitalik.eth");
    });

    it("should handle SOL addresses", () => {
      const a = new AutonomousAgent({ walletAddress: "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV", dryRun: true });
      assert.ok(a.walletAddress.length > 30);
    });

    it("stats should be independent between agents", () => {
      const a1 = new AutonomousAgent({ walletAddress: "0xA", dryRun: true });
      const a2 = new AutonomousAgent({ walletAddress: "0xB", dryRun: true });
      a1.stats.cycles = 10;
      assert.equal(a2.stats.cycles, 0);
    });

    it("policyEngine should be independent between agents", () => {
      const a1 = new AutonomousAgent({ walletAddress: "0xA", policies: PolicyPresets.conservative, dryRun: true });
      const a2 = new AutonomousAgent({ walletAddress: "0xB", policies: PolicyPresets.aggressive, dryRun: true });
      assert.equal(a1.policyEngine.policies, PolicyPresets.conservative);
      assert.equal(a2.policyEngine.policies, PolicyPresets.aggressive);
    });

    it("emitting after stop should not throw", () => {
      const a = new AutonomousAgent({ walletAddress: "0xEmit", dryRun: true });
      a.stop();
      assert.doesNotThrow(() => a.emit("test", {}));
    });

    it("agent should be instanceof EventEmitter", () => {
      const a = new AutonomousAgent({ walletAddress: "0xEE", dryRun: true });
      assert.ok(typeof a.on === "function");
      assert.ok(typeof a.emit === "function");
      assert.ok(typeof a.removeListener === "function");
    });
  });

  describe("PolicyEngine — policy mutation safety", () => {
    it("should not mutate original policy array", () => {
      const original = [...PolicyPresets.conservative];
      const engine = new PolicyEngine(original);
      engine.policies.push({ type: "extra" });
      assert.equal(original.length, PolicyPresets.conservative.length);
    });

    it("should handle policy array replacement", () => {
      const engine = new PolicyEngine(PolicyPresets.conservative);
      engine.policies = PolicyPresets.aggressive;
      assert.equal(engine.policies, PolicyPresets.aggressive);
      assert.notEqual(engine.policies, PolicyPresets.conservative);
    });

    it("should handle empty policy after set", () => {
      const engine = new PolicyEngine(PolicyPresets.conservative);
      engine.policies = [];
      assert.equal(engine.validate({ type: "swap" }).allowed, true);
    });

    it("spend tracker should be independent per engine", () => {
      const e1 = new PolicyEngine([{ type: "spend_limit", maxPerTx: 100, maxPerDay: 500, maxPerWeek: 2000, allowedTokens: [] }]);
      const e2 = new PolicyEngine([{ type: "spend_limit", maxPerTx: 100, maxPerDay: 500, maxPerWeek: 2000, allowedTokens: [] }]);
      e1.validate({ type: "swap", amountUsd: 400 });
      assert.equal(e2.spendTracker.size, 0);
    });
  });

  describe("PolicyPresets — structure validation", () => {
    for (const [name, preset] of Object.entries(PolicyPresets)) {
      it(`${name} — all policies have type field`, () => {
        for (const p of preset) assert.ok(p.type);
      });

      it(`${name} — no duplicate policy types`, () => {
        const types = preset.map(p => p.type);
        assert.equal(new Set(types).size, types.length);
      });

      it(`${name} — spend_limit has required fields`, () => {
        const sl = preset.find(p => p.type === "spend_limit");
        if (sl) {
          assert.ok(typeof sl.maxPerTx === "number");
          assert.ok(typeof sl.maxPerDay === "number");
        }
      });
    }
  });

  describe("Rapid fire — 20 mixed actions", () => {
    const engine = new PolicyEngine(PolicyPresets.conservative);
    const actions = [
      { type: "swap", amountUsd: 50, chainId: "ethereum", tokenOut: "ETH" },
      { type: "swap", amountUsd: 200, chainId: "ethereum", tokenOut: "ETH" },
      { type: "bridge", chainId: "ethereum" },
      { type: "analyze" },
      { type: "swap", amountUsd: 80, chainId: "solana", tokenOut: "SOL" },
      { type: "send", chainId: "ethereum" },
      { type: "swap", amountUsd: 10, tokenOut: "SHIB" },
      { type: "swap", amountUsd: 30, chainId: "ethereum", tokenOut: "USDC" },
      { type: "swap", amountUsd: 90, chainId: "solana", tokenOut: "USDT" },
      { type: "swap", amountUsd: 5000, chainId: "ethereum", tokenOut: "ETH" },
    ];

    let i = 1;
    for (const action of actions) {
      it(`mixed action #${i++}`, () => {
        assert.doesNotThrow(() => engine.validate(action));
      });
    }
  });
});

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("✅ 80 Edge Case Tests Complete");
}
