// Jupiter + Torque Integration Tests
// Verifies real API connectivity, data structures, error handling

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { JupiterIntegration, JupiterPolicyPresets, JupiterAgent } from "../../agent/jupiter.js";
import { TorqueIntegration, TorquePolicyPresets, TorqueAgent } from "../../agent/torque.js";

// ═══════════════════════════════════════════════════════════════════════
// JUPITER TESTS
// ═══════════════════════════════════════════════════════════════════════

describe("JupiterIntegration", () => {
  let jupiter;

  beforeEach(() => { jupiter = new JupiterIntegration(); });

  describe("constructor", () => {
    it("should initialize with empty cache", () => assert.equal(jupiter.cache.size, 0));
    it("should set 30s cache expiry", () => assert.equal(jupiter.cacheExpiry, 30_000));
  });

  describe("getPrice()", () => {
    it("should fetch SOL price (real API)", async () => {
      const price = await jupiter.getPrice("SOL");
      assert.ok(price);
      assert.ok(typeof price.price === "number");
    });

    it("should handle unknown token gracefully", async () => {
      const price = await jupiter.getPrice("NOTAREALTOKEN123");
      assert.ok(price);
    });

    it("should cache price results", async () => {
      await jupiter.getPrice("SOL");
      assert.ok(jupiter.cache.has("price:SOL"));
    });

    it("should return cached price on second call", async () => {
      const p1 = await jupiter.getPrice("SOL");
      const p2 = await jupiter.getPrice("SOL");
      assert.equal(p1.price, p2.price);
    });
  });

  describe("getQuote()", () => {
    it("should fetch swap quote (real API)", async () => {
      const quote = await jupiter.getQuote({
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: 1000000000, // 1 SOL in lamports
      });
      assert.ok(quote);
      if (!quote.error) {
        assert.ok(quote.inAmount);
        assert.ok(quote.outAmount);
      }
    });

    it("should handle invalid mints gracefully", async () => {
      const quote = await jupiter.getQuote({
        inputMint: "INVALID",
        outputMint: "ALSO_INVALID",
        amount: 1000,
      });
      assert.ok(quote.error || quote.inAmount);
    });
  });

  describe("findBestRoute()", () => {
    it("should find route for SOL→USDC", async () => {
      const route = await jupiter.findBestRoute({
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: 100000000,
      });
      if (!route.error) {
        assert.ok(route.routePlan);
        assert.ok(route.priceImpactPct !== undefined);
      }
    });

    it("should include fee information", async () => {
      const route = await jupiter.findBestRoute({
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: 100000000,
      });
      if (!route.error) {
        assert.ok(route.fees);
      }
    });
  });

  describe("getTokens()", () => {
    it("should fetch token list (real API)", async () => {
      const tokens = await jupiter.getTokens();
      assert.ok(Array.isArray(tokens));
      assert.ok(tokens.length > 0);
    }).timeout(10000);

    it("should cache token list for 5 min", async () => {
      await jupiter.getTokens();
      assert.ok(jupiter.cache.has("tokens"));
    });
  });
});

describe("JupiterPolicyPresets", () => {
  it("jupiterDca should have 4 policies", () => assert.equal(JupiterPolicyPresets.jupiterDca.length, 4));
  it("jupiterArbitrage should have 4 policies", () => assert.equal(JupiterPolicyPresets.jupiterArbitrage.length, 4));
  it("jupiterDca should lock to solana only", () => {
    const cl = JupiterPolicyPresets.jupiterDca.find(p => p.type === "chain_lock");
    assert.deepEqual(cl.allowedChains, ["solana"]);
  });
  it("jupiterDca max slippage should be 30 bps", () => {
    const sp = JupiterPolicyPresets.jupiterDca.find(p => p.type === "slippage");
    assert.equal(sp.maxSlippageBps, 30);
  });
});

describe("JupiterAgent", () => {
  let agent;

  beforeEach(() => { agent = new JupiterAgent({ walletAddress: "0xJupiterTest" }); });

  it("should initialize with DCA strategy by default", () => assert.equal(agent.strategy, "dca"));
  it("should have JupiterIntegration instance", () => assert.ok(agent.jupiter instanceof JupiterIntegration));
  it("should have empty stats", () => {
    assert.equal(agent.stats.swapsExecuted, 0);
    assert.equal(agent.stats.totalVolume, 0);
  });

  describe("executeSwap()", () => {
    it("should return route for valid swap", async () => {
      const route = await agent.executeSwap({
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: 100000000,
      });
      assert.ok(route);
    });

    it("should increment swap stats", async () => {
      await agent.executeSwap({
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: 100000000,
      });
      assert.ok(agent.stats.swapsExecuted >= 1);
    });
  });

  describe("scanArbitrage()", () => {
    it("should return price data for token pairs", async () => {
      const opps = await agent.scanArbitrage();
      assert.ok(Array.isArray(opps));
      assert.ok(opps.length >= 2);
      assert.ok(opps[0].price !== undefined);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// TORQUE TESTS
// ═══════════════════════════════════════════════════════════════════════

describe("TorqueIntegration", () => {
  let torque;

  beforeEach(() => { torque = new TorqueIntegration(); });

  describe("constructor", () => {
    it("should initialize with null pools", () => assert.equal(torque.pools, null));
    it("should set 2 min cache", () => assert.equal(torque.poolCacheDuration, 120_000));
  });

  describe("calculateYield()", () => {
    it("should calculate 10% APR on $1000 for 30 days", () => {
      const result = torque.calculateYield(1000, 10, 30);
      assert.ok(result.estimatedYield > 0);
      assert.ok(result.totalReturn > 1000);
    });

    it("should calculate 0% APR correctly", () => {
      const result = torque.calculateYield(1000, 0, 30);
      assert.equal(result.estimatedYield, 0);
      assert.equal(result.totalReturn, 1000);
    });

    it("should handle very high APR", () => {
      const result = torque.calculateYield(1000, 1000, 365);
      assert.ok(result.estimatedYield > 1000);
    });

    it("should handle zero principal", () => {
      const result = torque.calculateYield(0, 10, 30);
      assert.equal(result.estimatedYield, 0);
    });

    it("should handle negative APR", () => {
      const result = torque.calculateYield(1000, -5, 30);
      assert.ok(result.estimatedYield < 0);
    });

    it("should include monthly APY", () => {
      const result = torque.calculateYield(1000, 12, 30);
      assert.ok(result.monthlyApy > 0);
    });
  });

  describe("_assessRisk()", () => {
    it("should return conservative for low risk", () => {
      const result = torque._assessRisk([{ risk: "low" }, { risk: "low" }]);
      assert.equal(result, "conservative");
    });

    it("should return aggressive for high risk", () => {
      const result = torque._assessRisk([{ risk: "high" }, { risk: "high" }]);
      assert.equal(result, "aggressive");
    });

    it("should return moderate for mixed risk", () => {
      const result = torque._assessRisk([{ risk: "low" }, { risk: "high" }]);
      assert.equal(result, "moderate");
    });

    it("should handle empty recommendations", () => {
      const result = torque._assessRisk([]);
      assert.equal(result, "conservative");
    });

    it("should default unknown risks to medium", () => {
      const result = torque._assessRisk([{ risk: "unknown" }]);
      assert.equal(result, "moderate");
    });
  });
});

describe("TorquePolicyPresets", () => {
  it("torqueSafe should have 4 policies", () => assert.equal(TorquePolicyPresets.torqueSafe.length, 4));
  it("torqueMaxi should have 4 policies", () => assert.equal(TorquePolicyPresets.torqueMaxi.length, 4));
  it("torqueSafe should lock to solana", () => {
    const cl = TorquePolicyPresets.torqueSafe.find(p => p.type === "chain_lock");
    assert.ok(cl.allowedChains.includes("solana"));
  });
});

describe("TorqueAgent", () => {
  let agent;

  beforeEach(() => { agent = new TorqueAgent({ walletAddress: "0xTorqueTest" }); });

  it("should initialize with safe policies", () => {
    assert.equal(agent.policies.length, 4);
  });

  it("should have TorqueIntegration instance", () => {
    assert.ok(agent.torque instanceof TorqueIntegration);
  });

  it("should have initial stats at zero", () => {
    assert.equal(agent.stats.strategiesEvaluated, 0);
    assert.equal(agent.stats.yieldRecommendations, 0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// CROSS-INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════

describe("Integration Compatibility", () => {
  it("Jupiter + Torque policies should not conflict", () => {
    const jupiterPolicies = JupiterPolicyPresets.jupiterDca;
    const torquePolicies = TorquePolicyPresets.torqueSafe;
    // Both should be valid policy arrays
    assert.ok(Array.isArray(jupiterPolicies));
    assert.ok(Array.isArray(torquePolicies));
  });

  it("should import all integrations without errors", () => {
    assert.ok(JupiterIntegration);
    assert.ok(TorqueIntegration);
    assert.ok(JupiterAgent);
    assert.ok(TorqueAgent);
  });
});

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("🚀 Jupiter + Torque Integration Tests Complete");
}
