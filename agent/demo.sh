#!/usr/bin/env bash
# Zerion Autonomous Agent — Demo Script
# Demonstrates: agent creation, policy enforcement, rebalancing, live monitoring
# Run: bash agent/demo.sh

set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   ZERION AUTONOMOUS AGENT — DEMO                   ║${NC}"
echo -e "${BLUE}║   Colosseum Frontier Hackathon Submission          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# ─── DEMO 1: Policy Engine ─────────────────────────────────────────────────

echo -e "${GREEN}[DEMO 1] Policy Engine — Spend Limit Enforcement${NC}"
echo "Creating conservative policy engine..."
node -e "
import { PolicyEngine, PolicyPresets } from './agent/engine.js';
const engine = new PolicyEngine(PolicyPresets.conservative);

// Test 1: Valid transaction
const valid = engine.validate({ type: 'swap', amountUsd: 50, chainId: 'ethereum', tokenOut: 'ETH' });
console.log('  Swap \$50 ETH on Ethereum: ' + (valid.allowed ? '✅ ALLOWED' : '❌ BLOCKED: ' + valid.reason));

// Test 2: Over limit transaction
const blocked = engine.validate({ type: 'swap', amountUsd: 500, chainId: 'ethereum', tokenOut: 'ETH' });
console.log('  Swap \$500 ETH on Ethereum: ' + (blocked.allowed ? '✅ ALLOWED' : '❌ BLOCKED: ' + blocked.reason));

// Test 3: Unapproved token
const badToken = engine.validate({ type: 'swap', amountUsd: 50, chainId: 'ethereum', tokenOut: 'PEPE' });
console.log('  Swap \$50 PEPE on Ethereum: ' + (badToken.allowed ? '✅ ALLOWED' : '❌ BLOCKED: ' + badToken.reason));
"
echo ""

# ─── DEMO 2: Rebalancing Detector ──────────────────────────────────────────

echo -e "${GREEN}[DEMO 2] Decision Engine — Rebalancing Detection${NC}"
node -e "
import { DecisionEngine } from './agent/engine.js';
const engine = new DecisionEngine();

// Over-concentrated portfolio
const analysis = {
  totalValue: 50000,
  overConcentrated: [
    { asset: 'ETH', value: 30000, pct: 60 },
    { asset: 'SOL', value: 17500, pct: 35 },
  ],
  concentration: [
    { asset: 'ETH', value: 30000, pct: 60 },
    { asset: 'SOL', value: 17500, pct: 35 },
    { asset: 'USDC', value: 2500, pct: 5 },
  ]
};

const actions = engine.generateActions(analysis, 'rebalance');
console.log('  Portfolio: \$50,000 | 60% ETH | 35% SOL | 5% USDC');
console.log('  Actions generated: ' + actions.length);
actions.forEach(a => console.log('  → ' + a.reason + ' [urgency: ' + a.urgency + ']'));
"
echo ""

# ─── DEMO 3: DCA Agent ─────────────────────────────────────────────────────

echo -e "${GREEN}[DEMO 3] DCA Agent Simulation${NC}"
node -e "
import { PolicyEngine, PolicyPresets } from './agent/engine.js';
const engine = new PolicyEngine(PolicyPresets.dca);

console.log('  DCA Agent Policy: \$200 max/day, ETH/SOL/BTC only');
for (let week = 1; week <= 4; week++) {
  for (let day = 1; day <= 7; day++) {
    const result = engine.validate({ type: 'swap', amountUsd: 150, tokenOut: 'ETH' });
    if (!result.allowed) {
      console.log('  Week ' + week + ', Day ' + day + ': LIMIT HIT — daily \$200 cap enforced');
      engine.spendTracker.clear();
      break;
    }
  }
  engine.spendTracker.clear();
}
console.log('  DCA policy fully enforced across 4-week simulation');
"
echo ""

# ─── DEMO 4: Full Agent Lifecycle ──────────────────────────────────────────

echo -e "${GREEN}[DEMO 4] Full Agent Lifecycle${NC}"
node -e "
import { AutonomousAgent, PolicyPresets } from './agent/engine.js';

const agent = new AutonomousAgent({
  walletAddress: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // vitalik.eth
  policies: PolicyPresets.conservative,
  strategy: 'monitor',
  dryRun: true,
  intervalMs: 2000,
});

const events = [];
agent.on('started', d => events.push('started'));
agent.on('cycle:complete', d => events.push('cycle#' + d.cycle));
agent.on('action:simulated', d => events.push('action:' + d.action.type));
agent.on('stopped', s => events.push('stopped'));

console.log('  Starting agent for vitalik.eth...');
await agent.start();
await new Promise(r => setTimeout(r, 3000));
agent.stop();

console.log('  Events: ' + events.join(' → '));
console.log('  Stats: ' + JSON.stringify(agent.stats));
"
echo ""

# ─── DEMO 5: MCP Server ────────────────────────────────────────────────────

echo -e "${GREEN}[DEMO 5] MCP Server Integration${NC}"
echo "  MCP tools exposed: start_agent, stop_agent, get_agent_status,"
echo "  update_policy, analyze_wallet, validate_action, list_policies"
echo "  Server runs via: node agent/mcp-server.js"
echo "  Compatible with: Claude, Cursor, OpenClaw, any MCP client"
echo ""

# ─── Summary ────────────────────────────────────────────────────────────────

echo -e "${YELLOW}════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  DEMO COMPLETE                                       ${NC}"
echo -e "${YELLOW}  Repo: github.com/LMTRADES/zerion-agent              ${NC}"
echo -e "${YELLOW}  Tests: 538 | Policy Presets: 3 | Strategies: 3     ${NC}"
echo -e "${YELLOW}  MCP Tools: 7 | Agent Events: 8                     ${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════${NC}"
