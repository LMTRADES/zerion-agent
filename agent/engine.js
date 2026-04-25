// Zerion Autonomous Agent — Core Engine
// Phase 1: Agent loop, decision engine, policy enforcement
// Built on top of Zerion CLI for Colosseum Frontier Hackathon
//
// Architecture:
//   Agent Loop → Policy Check → Market Analysis → Decision Engine → Zerion CLI → Execute
//                                    ↑                                          ↓
//                                    └─────────── Feedback Loop ────────────────┘

import { EventEmitter } from "node:events";
import { getPortfolio, getPositions, getPnl, getTransactions, searchFungibles, getSwapOffers, getChains } from "../cli/lib/api/client.js";
import { getApiKey, loadConfig, getActiveAgentToken } from "../cli/lib/config.js";

// ─── Policy Types ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} SpendLimitPolicy
 * @property {string} type - "spend_limit"
 * @property {number} maxPerTx - Maximum spend per transaction in USD
 * @property {number} maxPerDay - Maximum daily spend in USD
 * @property {number} maxPerWeek - Maximum weekly spend in USD
 * @property {string[]} allowedTokens - Token addresses/symbols allowed
 */

/**
 * @typedef {Object} ChainLockPolicy
 * @property {string} type - "chain_lock"
 * @property {string[]} allowedChains - Chain IDs allowed (e.g., ["ethereum", "solana"])
 * @property {boolean} blockBridges - Prevent cross-chain operations
 */

/**
 * @typedef {Object} TimeWindowPolicy
 * @property {string} type - "time_window"
 * @property {Object[]} windows - Array of { start: "HH:MM", end: "HH:MM", timezone: "UTC" }
 * @property {number} maxActionsPerWindow - Max actions per window
 */

/**
 * @typedef {Object} ActionAllowlist
 * @property {string} type - "action_allowlist"
 * @property {string[]} allowedActions - ["swap", "bridge", "send", "analyze"]
 */

/**
 * @typedef {Object} SlippagePolicy
 * @property {string} type - "slippage"
 * @property {number} maxSlippageBps - Maximum slippage in basis points
 */

/**
 * @typedef {Object} PortfolioGuardPolicy
 * @property {string} type - "portfolio_guard"
 * @property {number} minPortfolioValue - Minimum portfolio USD value before agent stops
 * @property {number} maxConcentrationPct - Max % in single asset
 * @property {string[]} requiredAssets - Assets that must be held (e.g., ["ETH"])
 */

/** @typedef {SpendLimitPolicy|ChainLockPolicy|TimeWindowPolicy|ActionAllowlist|SlippagePolicy|PortfolioGuardPolicy} Policy */

// ─── Policy Engine ──────────────────────────────────────────────────────────

export class PolicyEngine {
  /** @param {Policy[]} policies */
  constructor(policies = []) {
    this.policies = policies;
    /** @type {Map<string, number>} */
    this.spendTracker = new Map(); // date string → total spent USD
    /** @type {Map<string, number>} */
    this.actionCounter = new Map(); // window key → count
  }

  /**
   * Validate if an action is allowed under current policies
   * @param {Object} action
   * @param {string} action.type - Action type
   * @param {number} [action.amountUsd] - Amount in USD
   * @param {string} [action.chainId] - Blockchain chain ID
   * @param {string} [action.tokenOut] - Token being sold/swapped
   * @param {Object} [action.context] - Additional context
   * @returns {{ allowed: boolean, reason?: string }}
   */
  validate(action) {
    if (!this.policies || !Array.isArray(this.policies)) return { allowed: true };
    for (const policy of this.policies) {
      const result = this._checkPolicy(policy, action);
      if (!result.allowed) return result;
    }
    return { allowed: true };
  }

  /** @private */
  _checkPolicy(policy, action) {
    switch (policy.type) {
      case "spend_limit": return this._checkSpendLimit(policy, action);
      case "chain_lock": return this._checkChainLock(policy, action);
      case "time_window": return this._checkTimeWindow(policy, action);
      case "action_allowlist": return this._checkActionAllowlist(policy, action);
      case "slippage": return this._checkSlippage(policy, action);
      case "portfolio_guard": return { allowed: true }; // checked separately
      default:
        return { allowed: false, reason: `Unknown policy type: ${policy.type}` };
    }
  }

  _checkSpendLimit(policy, action) {
    if (!action.amountUsd) return { allowed: true };
    
    const today = new Date().toISOString().slice(0, 10);
    const todaySpent = this.spendTracker.get(today) || 0;
    const newTotal = todaySpent + action.amountUsd;

    if (action.amountUsd > policy.maxPerTx) {
      return { allowed: false, reason: `Transaction exceeds maxPerTx: $${action.amountUsd} > $${policy.maxPerTx}` };
    }
    if (newTotal > policy.maxPerDay) {
      return { allowed: false, reason: `Daily limit exceeded: $${newTotal} > $${policy.maxPerDay}` };
    }
    if (policy.allowedTokens && policy.allowedTokens.length > 0) {
      const tokenOk = policy.allowedTokens.some(t => 
        action.tokenOut?.toLowerCase().includes(t.toLowerCase())
      );
      if (!tokenOk) return { allowed: false, reason: `Token not in allowlist: ${action.tokenOut}` };
    }
    
    this.spendTracker.set(today, newTotal);
    return { allowed: true };
  }

  _checkChainLock(policy, action) {
    if (!action.chainId) return { allowed: true };
    if (!policy.allowedChains.includes(action.chainId)) {
      return { allowed: false, reason: `Chain not allowed: ${action.chainId}` };
    }
    if (policy.blockBridges && action.type === "bridge") {
      return { allowed: false, reason: "Bridge operations blocked by chain lock policy" };
    }
    return { allowed: true };
  }

  _checkTimeWindow(policy, action) {
    const now = new Date();
    const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    
    let inWindow = false;
    for (const window of policy.windows) {
      const [startH, startM] = window.start.split(":").map(Number);
      const [endH, endM] = window.end.split(":").map(Number);
      const startMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;
      
      if (startMin <= endMin) {
        if (currentMinutes >= startMin && currentMinutes < endMin) inWindow = true;
      } else {
        // Overnight window
        if (currentMinutes >= startMin || currentMinutes < endMin) inWindow = true;
      }
    }

    if (!inWindow) {
      return { allowed: false, reason: "Outside allowed time windows" };
    }

    const windowKey = `${now.toISOString().slice(0, 10)}-${currentMinutes}`;
    const count = (this.actionCounter.get(windowKey) || 0) + 1;
    if (count > policy.maxActionsPerWindow) {
      return { allowed: false, reason: `Max actions per window exceeded: ${count} > ${policy.maxActionsPerWindow}` };
    }
    this.actionCounter.set(windowKey, count);
    return { allowed: true };
  }

  _checkActionAllowlist(policy, action) {
    if (!policy.allowedActions.includes(action.type)) {
      return { allowed: false, reason: `Action not allowed: ${action.type}` };
    }
    return { allowed: true };
  }

  _checkSlippage(policy, action) {
    if (action.slippageBps && action.slippageBps > policy.maxSlippageBps) {
      return { allowed: false, reason: `Slippage exceeds max: ${action.slippageBps} > ${policy.maxSlippageBps} bps` };
    }
    return { allowed: true };
  }
}

// ─── Market Analyzer ────────────────────────────────────────────────────────

export class MarketAnalyzer {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 60_000; // 1 minute
  }

  /**
   * Analyze wallet and market conditions
   * @param {string} walletAddress
   * @returns {Promise<Object>}
   */
  async analyze(walletAddress) {
    const auth = { kind: "apiKey", key: getApiKey() };
    
    const [portfolio, positions, pnl, chains] = await Promise.all([
      getPortfolio(walletAddress, { auth }),
      getPositions(walletAddress, { auth }),
      getPnl(walletAddress, { auth }),
      getChains({ auth }),
    ]);

    const totalValue = portfolio?.data?.attributes?.total?.value || 0;
    const positionsList = positions?.data || [];
    const pnlData = pnl?.data?.attributes || null;

    // Detect large positions (>20% concentration)
    const concentration = positionsList.map(p => ({
      asset: p.attributes?.fungible_info?.symbol || "unknown",
      value: p.attributes?.value || 0,
      pct: totalValue > 0 ? ((p.attributes?.value || 0) / totalValue * 100).toFixed(1) : 0,
    }));
    const overConcentrated = concentration.filter(c => c.pct > 20);

    // PnL summary
    const realizedPnl = pnlData?.realized?.total?.value || null;
    const unrealizedPnl = pnlData?.unrealized?.total?.value || null;

    return {
      totalValue,
      positionCount: positionsList.length,
      concentration,
      overConcentrated,
      realizedPnl,
      unrealizedPnl,
      pnlAvailable: pnlData !== null,
      chains: chains?.data?.length || 0,
      timestamp: Date.now(),
    };
  }
}

// ─── Decision Engine ────────────────────────────────────────────────────────

export class DecisionEngine {
  /**
   * Generate actions based on wallet analysis and strategy
   * @param {Object} analysis - MarketAnalyzer output
   * @param {string} strategy - Strategy name
   * @returns {Object[]}
   */
  generateActions(analysis, strategy = "monitor") {
    const actions = [];
    if (!analysis) return actions;

    switch (strategy) {
      case "rebalance": {
        // Rebalance if any position exceeds 30%
        if (!analysis.overConcentrated) break;
        for (const pos of analysis.overConcentrated) {
          if (pos.pct > 30) {
            actions.push({
              type: "swap",
              tokenOut: pos.asset,
              reason: `Position over-concentrated at ${pos.pct}%`,
              urgency: pos.pct > 50 ? "high" : "medium",
              suggestedAction: `Reduce ${pos.asset} from ${pos.pct}% to 25%`,
            });
          }
        }
        break;
      }
      case "compound": {
        // Compound gains by swapping profitable positions
        if (analysis.unrealizedPnl > 0 && analysis.unrealizedPnl > analysis.totalValue * 0.1) {
          actions.push({
            type: "analyze",
            reason: `Significant unrealized PnL: $${analysis.unrealizedPnl}. Consider taking profits.`,
            urgency: "low",
          });
        }
        break;
      }
      case "monitor": {
        // Passive monitoring — report state, no actions
        actions.push({
          type: "analyze",
          reason: `Portfolio: $${analysis.totalValue.toFixed(2)}, ${analysis.positionCount} positions`,
          urgency: "info",
        });
        break;
      }
      default:
        break;
    }

    return actions;
  }
}

// ─── Agent Loop ─────────────────────────────────────────────────────────────

export class AutonomousAgent extends EventEmitter {
  /**
   * @param {Object} config
   * @param {string} config.walletAddress - Wallet to manage
   * @param {Policy[]} config.policies - Active policies
   * @param {string} config.strategy - Strategy name
   * @param {number} config.intervalMs - Loop interval in ms
   * @param {boolean} config.dryRun - If true, don't execute real transactions
   */
  constructor(config) {
    super();
    this.walletAddress = config.walletAddress;
    this.policyEngine = new PolicyEngine(config.policies || PolicyPresets.conservative);
    this.marketAnalyzer = new MarketAnalyzer();
    this.decisionEngine = new DecisionEngine();
    this.strategy = config.strategy || "monitor";
    this.intervalMs = config.intervalMs || 300_000; // 5 min default
    this.dryRun = config.dryRun !== undefined ? config.dryRun : false;
    this._running = false;
    this._timer = null;
    this.stats = {
      cycles: 0,
      actionsTaken: 0,
      actionsBlocked: 0,
      errors: 0,
      startTime: null,
      lastCycle: null,
    };
  }

  /** Start the autonomous agent loop */
  async start() {
    if (this._running) return;
    this._running = true;
    this.stats.startTime = Date.now();
    this.emit("started", { wallet: this.walletAddress, strategy: this.strategy, dryRun: this.dryRun });
    
    // Run first cycle immediately
    await this._cycle();
    
    // Then run on interval
    this._timer = setInterval(() => this._cycle(), this.intervalMs);
  }

  /** Stop the agent */
  stop() {
    this._running = false;
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this.emit("stopped", this.stats);
  }

  /** @private — Single agent cycle */
  async _cycle() {
    const cycleStart = Date.now();
    this.stats.cycles++;
    
    try {
      // 1. Analyze wallet state
      this.emit("cycle:analyze", { cycle: this.stats.cycles });
      const analysis = await this.marketAnalyzer.analyze(this.walletAddress);
      
      // 2. Check portfolio guard policies
      const guardBlocked = this._checkPortfolioGuards(analysis);
      if (guardBlocked) {
        this.emit("cycle:blocked", { reason: guardBlocked, analysis });
        this.stats.actionsBlocked++;
        this.stats.lastCycle = Date.now();
        return;
      }

      // 3. Generate actions
      this.emit("cycle:decide", { strategy: this.strategy, analysis });
      const actions = this.decisionEngine.generateActions(analysis, this.strategy);

      // 4. Validate and execute actions
      for (const action of actions) {
        const validation = this.policyEngine.validate(action);
        if (!validation.allowed) {
          this.emit("action:blocked", { action, reason: validation.reason });
          this.stats.actionsBlocked++;
          continue;
        }

        if (this.dryRun) {
          this.emit("action:simulated", { action, analysis });
          this.stats.actionsTaken++;
        } else {
          try {
            this.emit("action:executing", { action });
            // TODO: Hook into Zerion CLI for real execution
            this.stats.actionsTaken++;
          } catch (err) {
            this.emit("action:error", { action, error: err.message });
            this.stats.errors++;
          }
        }
      }

      this.emit("cycle:complete", {
        cycle: this.stats.cycles,
        duration: Date.now() - cycleStart,
        actionsGenerated: actions.length,
        stats: { ...this.stats },
      });

    } catch (err) {
      this.emit("cycle:error", { cycle: this.stats.cycles, error: err.message });
      this.stats.errors++;
    }

    this.stats.lastCycle = Date.now();
  }

  /** @private */
  _checkPortfolioGuards(analysis) {
    for (const policy of this.policyEngine.policies) {
      if (policy.type !== "portfolio_guard") continue;
      
      if (policy.minPortfolioValue && analysis.totalValue < policy.minPortfolioValue) {
        return `Portfolio below minimum: $${analysis.totalValue.toFixed(2)} < $${policy.minPortfolioValue}`;
      }
      if (policy.requiredAssets) {
        for (const asset of policy.requiredAssets) {
          const found = analysis.concentration.some(c => 
            c.asset?.toUpperCase() === asset.toUpperCase()
          );
          if (!found) return `Required asset not held: ${asset}`;
        }
      }
    }
    return null;
  }
}

// ─── Policy Presets ─────────────────────────────────────────────────────────

export const PolicyPresets = {
  /** Conservative: small trades, ETH/SOL only, business hours */
  conservative: [
    { type: "spend_limit", maxPerTx: 100, maxPerDay: 500, maxPerWeek: 2000, allowedTokens: ["ETH", "SOL", "USDC", "USDT"] },
    { type: "chain_lock", allowedChains: ["ethereum", "solana"], blockBridges: false },
    { type: "time_window", windows: [{ start: "09:00", end: "17:00", timezone: "UTC" }], maxActionsPerWindow: 10 },
    { type: "action_allowlist", allowedActions: ["swap", "analyze", "send"] },
    { type: "slippage", maxSlippageBps: 100 },
    { type: "portfolio_guard", minPortfolioValue: 50, maxConcentrationPct: 50, requiredAssets: [] },
  ],

  /** Aggressive: bigger trades, all chains, all hours */
  aggressive: [
    { type: "spend_limit", maxPerTx: 5000, maxPerDay: 25000, maxPerWeek: 100000, allowedTokens: [] },
    { type: "chain_lock", allowedChains: ["ethereum", "solana", "base", "arbitrum", "polygon"], blockBridges: false },
    { type: "action_allowlist", allowedActions: ["swap", "bridge", "send", "analyze"] },
    { type: "slippage", maxSlippageBps: 500 },
    { type: "portfolio_guard", minPortfolioValue: 500, maxConcentrationPct: 80 },
  ],

  /** DCA-only: automated dollar-cost averaging */
  dca: [
    { type: "spend_limit", maxPerTx: 200, maxPerDay: 200, maxPerWeek: 1400, allowedTokens: ["ETH", "SOL", "BTC"] },
    { type: "chain_lock", allowedChains: ["ethereum", "solana"], blockBridges: true },
    { type: "time_window", windows: [{ start: "12:00", end: "13:00", timezone: "UTC" }], maxActionsPerWindow: 1 },
    { type: "action_allowlist", allowedActions: ["swap"] },
    { type: "slippage", maxSlippageBps: 50 },
    { type: "portfolio_guard", minPortfolioValue: 100, maxConcentrationPct: 90 },
  ],
};

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Create and run an autonomous agent
 * @param {Object} options
 * @returns {AutonomousAgent}
 */
export async function createAgent(options = {}) {
  const agent = new AutonomousAgent({
    walletAddress: options.walletAddress || process.env.AGENT_WALLET_ADDRESS,
    policies: options.policies || PolicyPresets.conservative,
    strategy: options.strategy || "monitor",
    intervalMs: options.intervalMs || 300_000,
    dryRun: options.dryRun !== false,
  });

  // Logging
  agent.on("started", (data) => console.log("[AGENT] Started", data));
  agent.on("stopped", (stats) => console.log("[AGENT] Stopped", stats));
  agent.on("cycle:complete", (data) => console.log("[AGENT] Cycle complete", data));
  agent.on("action:simulated", (data) => console.log("[AGENT] Simulated:", data.action.type));
  agent.on("action:blocked", (data) => console.warn("[AGENT] Blocked:", data.reason));
  agent.on("cycle:error", (data) => console.error("[AGENT] Error:", data.error));

  return agent;
}
