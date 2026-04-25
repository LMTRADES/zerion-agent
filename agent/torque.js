// Torque MCP Integration for Zerion Autonomous Agent
// "Build with Torque MCP" — Colosseum Frontier Hackathon ($3K, HUMAN_ONLY)
// Torque is a Solana DeFi protocol — this integration adds yield strategies

const TORQUE_API_BASE = "https://api.torque.fi/v1";

/**
 * Torque Protocol Integration
 * Adds yield farming, lending, and leverage strategies to the autonomous agent
 */
export class TorqueIntegration {
  constructor() {
    this.pools = null;
    this.lastPoolFetch = 0;
    this.poolCacheDuration = 120_000; // 2 min cache
  }

  /**
   * Fetch available Torque pools
   * @returns {Promise<Object[]>}
   */
  async getPools() {
    if (this.pools && Date.now() - this.lastPoolFetch < this.poolCacheDuration) {
      return this.pools;
    }

    try {
      const response = await fetch(`${TORQUE_API_BASE}/pools`);
      if (!response.ok) throw new Error(`Torque API error: ${response.status}`);
      const data = await response.json();
      this.pools = data.pools || data.data || [];
      this.lastPoolFetch = Date.now();
      return this.pools;
    } catch (err) {
      console.error("Torque pools fetch failed:", err.message);
      return [];
    }
  }

  /**
   * Get best yield opportunities
   * @returns {Promise<Object[]>}
   */
  async getBestYields(minApr = 5) {
    const pools = await this.getPools();
    return pools
      .filter(p => (p.apr || p.apy || 0) >= minApr)
      .sort((a, b) => (b.apr || b.apy || 0) - (a.apr || a.apy || 0))
      .slice(0, 10)
      .map(p => ({
        name: p.name || p.poolName || "Unknown Pool",
        token: p.token || p.asset || "Unknown",
        apr: p.apr || p.apy || 0,
        tvl: p.tvl || p.totalValueLocked || 0,
        risk: p.risk || "medium",
        strategy: p.strategy || p.type || "lending",
      }));
  }

  /**
   * Calculate expected yield
   * @param {number} amount 
   * @param {number} apr 
   * @param {number} days 
   * @returns {Object}
   */
  calculateYield(amount, apr, days = 30) {
    const dailyRate = apr / 365 / 100;
    const yieldAmount = amount * dailyRate * days;
    return {
      principal: amount,
      apr,
      days,
      estimatedYield: yieldAmount,
      totalReturn: amount + yieldAmount,
      monthlyApy: (Math.pow(1 + apr/36500, 30) - 1) * 100,
    };
  }

  /**
   * Recommend optimal yield strategy based on portfolio
   * @param {Object} portfolio
   * @param {number} portfolio.totalValue
   * @param {Object[]} portfolio.positions
   * @returns {Promise<Object>}
   */
  async recommendStrategy(portfolio) {
    const pools = await this.getBestYields();
    const recommendations = [];

    for (const pool of pools.slice(0, 5)) {
      const allocation = portfolio.totalValue * 0.2; // Max 20% per pool
      const yield_ = this.calculateYield(allocation, pool.apr, 30);
      recommendations.push({
        pool: pool.name,
        token: pool.token,
        apr: pool.apr,
        allocation: allocation,
        expectedMonthlyYield: yield_.estimatedYield,
        risk: pool.risk,
        strategy: pool.strategy,
      });
    }

    return {
      totalPortfolioValue: portfolio.totalValue,
      recommendedPools: recommendations,
      totalExpectedMonthlyYield: recommendations.reduce((s, r) => s + r.expectedMonthlyYield, 0),
      riskProfile: this._assessRisk(recommendations),
    };
  }

  _assessRisk(recommendations) {
    const riskScores = { low: 1, medium: 2, high: 3 };
    const avgRisk = recommendations.reduce((s, r) => s + (riskScores[r.risk] || 2), 0) / recommendations.length;
    if (avgRisk < 1.5) return "conservative";
    if (avgRisk < 2.5) return "moderate";
    return "aggressive";
  }
}

/**
 * Torque Policy Presets
 */
export const TorquePolicyPresets = {
  /** Conservative yield farming */
  torqueSafe: [
    { type: "spend_limit", maxPerTx: 500, maxPerDay: 1000, maxPerWeek: 3000, allowedTokens: ["USDC", "USDT", "SOL"] },
    { type: "chain_lock", allowedChains: ["solana"], blockBridges: true },
    { type: "action_allowlist", allowedActions: ["deposit", "withdraw", "analyze"] },
    { type: "portfolio_guard", minPortfolioValue: 100, maxConcentrationPct: 50 },
  ],

  /** Aggressive yield optimization */
  torqueMaxi: [
    { type: "spend_limit", maxPerTx: 5000, maxPerDay: 25000, maxPerWeek: 100000, allowedTokens: [] },
    { type: "chain_lock", allowedChains: ["solana"], blockBridges: false },
    { type: "action_allowlist", allowedActions: ["deposit", "withdraw", "swap", "analyze"] },
    { type: "slippage", maxSlippageBps: 200 },
  ],
};

/**
 * Torque-Enhanced Autonomous Agent
 */
export class TorqueAgent {
  constructor(config) {
    this.walletAddress = config.walletAddress;
    this.torque = new TorqueIntegration();
    this.policies = config.policies || TorquePolicyPresets.torqueSafe;
    this.stats = {
      strategiesEvaluated: 0,
      yieldRecommendations: 0,
      totalProjectedYield: 0,
    };
  }

  /**
   * Run yield optimization cycle
   * @param {Object} portfolio 
   */
  async optimize(portfolio) {
    const recommendation = await this.torque.recommendStrategy(portfolio);
    this.stats.strategiesEvaluated++;
    this.stats.yieldRecommendations += recommendation.recommendedPools.length;
    this.stats.totalProjectedYield += recommendation.totalExpectedMonthlyYield;
    return recommendation;
  }

  /**
   * Monitor yields and alert on opportunities
   */
  async scanOpportunities(minApr = 10) {
    const yields = await this.torque.getBestYields(minApr);
    return {
      timestamp: Date.now(),
      opportunities: yields.length,
      topOpportunity: yields[0] || null,
      averageApr: yields.reduce((s, y) => s + y.apr, 0) / (yields.length || 1),
    };
  }
}

export default { TorqueIntegration, TorquePolicyPresets, TorqueAgent };
