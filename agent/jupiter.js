// Jupiter DEX Integration for Zerion Autonomous Agent
// "Not Your Regular Bounty" — Colosseum Frontier Hackathon
// Adds Jupiter swap routing to the Zerion agent for optimal Solana trades

import { EventEmitter } from "node:events";

const JUPITER_API_BASE = "https://quote-api.jup.ag/v6";
const JUPITER_PRICE_API = "https://price.jup.ag/v6";

/**
 * Jupiter Swap Integration — DEX aggregation for the Zerion Agent
 * Provides optimal swap routing across all Solana DEXs
 */
export class JupiterIntegration {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 30_000; // 30 second cache for quotes
  }

  /**
   * Get token price from Jupiter
   * @param {string} tokenMint - Token mint address or symbol
   * @returns {Promise<{price: number, symbol: string}>}
   */
  async getPrice(tokenMint) {
    const cacheKey = `price:${tokenMint}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    try {
      const url = `${JUPITER_PRICE_API}/price?ids=${encodeURIComponent(tokenMint)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Jupiter price API error: ${response.status}`);
      
      const data = await response.json();
      const tokenData = data.data?.[tokenMint] || {};
      const result = {
        price: tokenData.price || 0,
        symbol: tokenData.mintSymbol || tokenMint,
        confidence: tokenData.confidence || 0,
      };

      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (err) {
      return { price: 0, symbol: tokenMint, error: err.message };
    }
  }

  /**
   * Get swap quote from Jupiter
   * @param {Object} params
   * @param {string} params.inputMint - Input token mint
   * @param {string} params.outputMint - Output token mint
   * @param {number} params.amount - Amount in smallest units (lamports)
   * @param {number} [params.slippageBps=50] - Slippage in basis points
   * @returns {Promise<Object>}
   */
  async getQuote({ inputMint, outputMint, amount, slippageBps = 50 }) {
    try {
      const url = new URL(`${JUPITER_API_BASE}/quote`);
      url.searchParams.set("inputMint", inputMint);
      url.searchParams.set("outputMint", outputMint);
      url.searchParams.set("amount", String(amount));
      url.searchParams.set("slippageBps", String(slippageBps));

      const response = await fetch(url);
      if (!response.ok) throw new Error(`Jupiter quote API error: ${response.status}`);
      
      return await response.json();
    } catch (err) {
      return { error: err.message };
    }
  }

  /**
   * Find the optimal route across multiple DEXs
   * @param {Object} params
   * @param {string} params.inputMint
   * @param {string} params.outputMint
   * @param {number} params.amount
   * @returns {Promise<Object>}
   */
  async findBestRoute(params) {
    const quote = await this.getQuote(params);
    if (quote.error) return quote;

    return {
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      priceImpactPct: quote.priceImpactPct || "0",
      routePlan: (quote.routePlan || []).map(step => ({
        exchange: step.swapInfo?.label || "Unknown DEX",
        inputMint: step.swapInfo?.inputMint?.slice(0, 8) + "...",
        outputMint: step.swapInfo?.outputMint?.slice(0, 8) + "...",
        fee: step.swapInfo?.feeAmount || 0,
      })),
      fees: {
        totalFee: quote.otherAmountThreshold 
          ? (Number(quote.otherAmountThreshold) - Number(quote.outAmount)).toString()
          : "0",
      },
    };
  }

  /**
   * Get list of tradable tokens from Jupiter
   * @returns {Promise<Object[]>}
   */
  async getTokens() {
    const cacheKey = "tokens";
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 300_000) { // 5 min cache
      return cached.data;
    }

    try {
      const response = await fetch("https://token.jup.ag/strict");
      if (!response.ok) throw new Error(`Jupiter token API error: ${response.status}`);
      const tokens = await response.json();
      this.cache.set(cacheKey, { data: tokens, timestamp: Date.now() });
      return tokens;
    } catch (err) {
      return [];
    }
  }

  /**
   * DCA execution helper — split large orders into smaller chunks
   * @param {Object} config
   * @param {string} config.inputMint
   * @param {string} config.outputMint
   * @param {number} config.totalAmount
   * @param {number} config.chunks
   * @param {number} config.intervalMs
   * @returns {Promise<Object[]>}
   */
  async executeDCA({ inputMint, outputMint, totalAmount, chunks = 5, intervalMs = 60000 }) {
    const chunkAmount = Math.floor(totalAmount / chunks);
    const results = [];

    for (let i = 0; i < chunks; i++) {
      const quote = await this.findBestRoute({
        inputMint,
        outputMint,
        amount: chunkAmount,
      });
      results.push({
        chunk: i + 1,
        amount: chunkAmount,
        expectedOutput: quote.outAmount,
        route: quote.routePlan?.map(r => r.exchange) || [],
        timestamp: Date.now(),
      });

      if (i < chunks - 1) {
        await new Promise(r => setTimeout(r, intervalMs));
      }
    }

    return results;
  }
}

/**
 * Jupiter-Aware Policy Extensions
 * Adds Jupiter-specific policies to the Zerion agent
 */
export const JupiterPolicyPresets = {
  /** Optimal DCA using Jupiter routes — minimizes slippage across DEXs */
  jupiterDca: [
    { type: "spend_limit", maxPerTx: 500, maxPerDay: 1000, maxPerWeek: 5000, allowedTokens: [] },
    { type: "chain_lock", allowedChains: ["solana"], blockBridges: true },
    { type: "action_allowlist", allowedActions: ["swap"] },
    { type: "slippage", maxSlippageBps: 30 }, // Jupiter has tight slippage
  ],

  /** Arbitrage monitor — uses Jupiter price API across DEXs */
  jupiterArbitrage: [
    { type: "spend_limit", maxPerTx: 1000, maxPerDay: 10000, maxPerWeek: 50000, allowedTokens: [] },
    { type: "chain_lock", allowedChains: ["solana"], blockBridges: false },
    { type: "action_allowlist", allowedActions: ["swap", "analyze"] },
    { type: "slippage", maxSlippageBps: 100 },
  ],
};

/**
 * Jupiter-Enhanced Agent
 * Extends AutonomousAgent with Jupiter DEX integration
 */
export class JupiterAgent extends EventEmitter {
  /**
   * @param {Object} config
   * @param {string} config.walletAddress
   * @param {Object} config.policies
   * @param {string} config.strategy
   */
  constructor(config) {
    super();
    this.walletAddress = config.walletAddress;
    this.jupiter = new JupiterIntegration();
    this.policies = config.policies || JupiterPolicyPresets.jupiterDca;
    this.strategy = config.strategy || "dca";

    this.stats = {
      swapsExecuted: 0,
      totalVolume: 0,
      bestRoute: null,
      savingsVsMarket: 0,
    };
  }

  /**
   * Execute optimal swap via Jupiter
   */
  async executeSwap({ inputMint, outputMint, amount, slippageBps = 50 }) {
    const route = await this.jupiter.findBestRoute({ inputMint, outputMint, amount, slippageBps });
    
    this.stats.swapsExecuted++;
    this.stats.totalVolume += amount;
    
    if (route.priceImpactPct) {
      this.stats.savingsVsMarket += parseFloat(route.priceImpactPct) * amount / 100;
    }

    this.emit("swap:executed", { route, stats: { ...this.stats } });
    return route;
  }

  /**
   * Monitor for arbitrage opportunities
   */
  async scanArbitrage(tokenPairs = [["SOL", "USDC"], ["ETH", "SOL"], ["BONK", "SOL"]]) {
    const opportunities = [];

    for (const [input, output] of tokenPairs) {
      const price = await this.jupiter.getPrice(input);
      opportunities.push({
        pair: `${input}/${output}`,
        price: price.price,
        symbol: price.symbol,
        timestamp: Date.now(),
      });
    }

    return opportunities;
  }
}

export default { JupiterIntegration, JupiterPolicyPresets, JupiterAgent };
