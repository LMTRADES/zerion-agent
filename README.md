# Zerion Autonomous Agent

**Colosseum Frontier Hackathon Submission**
Built on top of [zerion-ai](https://github.com/zeriontech/zerion-ai)

An autonomous onchain agent that manages wallets, enforces scoped policies, and executes real transactions across protocols — Zerion, Jupiter, Torque, and privacy-preserving layers.

## Quick Start

```bash
# Clone
git clone https://github.com/LMTRADES/zerion-agent.git
cd zerion-agent

# Set up Zerion API
export ZERION_API_KEY="zk_..."

# Run the agent (dry-run safe mode)
node agent/cli.js --wallet 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --strategy monitor

# MCP Server (for Claude/Cursor integration)
node agent/mcp-server.js

# Demo
bash agent/demo.sh

# Tests
node --test tests/unit/*.test.mjs tests/integration/*.test.mjs
```

## Architecture

```
agent/
├── engine.js      # Autonomous agent core (policy engine, market analyzer, decision engine)
├── cli.js         # CLI entry point with flags
├── mcp-server.js  # MCP stdio server (7 tools)
├── demo.sh        # 5-phase interactive demo
├── jupiter.js     # Jupiter DEX integration (swaps, routes, DCA)
├── torque.js      # Torque yield farming integration
└── privacy.js     # Privacy layer (stealth addresses, ZK proofs)
```

## Policy System

Three built-in presets with granular policy types:

| Policy | Description |
|--------|-------------|
| spend_limit | Max per-tx, daily, weekly USD limits + token allowlists |
| chain_lock | Restrict to specific chains, block bridges |
| time_window | Restrict trading to specific hours |
| action_allowlist | Only allow specific actions (swap/bridge/send/analyze) |
| slippage | Maximum slippage in basis points |
| portfolio_guard | Minimum portfolio value, max concentration, required assets |

### Presets

- **conservative**: $100/tx, $500/day, ETH/SOL/USDC only, business hours
- **aggressive**: $5,000/tx, $25,000/day, all chains, all hours
- **dca**: $200/day, DCA into ETH/SOL/BTC, auto-enforced

## Protocol Integrations

| Integration | Capabilities | API Verified |
|-------------|-------------|--------------|
| Zerion | Wallet analysis, portfolio, PnL, 62 chains | ✅ $2.5M test portfolio |
| Jupiter | DEX aggregation, optimal routing, arbitrage | ✅ Real quotes |
| Torque | Yield farming, strategy optimization | ✅ Pool discovery |
| Privacy | Stealth addresses, ZK proofs, audit | ✅ Local crypto |

## MCP Tools (7)

- `start_agent` — Start agent for a wallet
- `stop_agent` — Stop and get stats
- `get_agent_status` — Current state
- `update_policy` — Change policies at runtime
- `analyze_wallet` — One-time analysis
- `validate_action` — Check if action is allowed
- `list_policies` — List active policies

## Agent Events (8)

- `started`, `stopped`
- `cycle:analyze`, `cycle:decide`, `cycle:complete`, `cycle:error`
- `action:simulated`, `action:blocked`, `action:executing`, `action:error`

## Test Suite

620 tests across 7 files. Run with:

```bash
node --test tests/unit/agent-engine.test.mjs      # 116 tests
node --test tests/unit/cli-and-final.test.mjs       # 99 tests
node --test tests/unit/final-batch.test.mjs         # 78 tests
node --test tests/unit/final-push.test.mjs          # 157 tests
node --test tests/unit/privacy.test.mjs             # 40 tests
node --test tests/integration/agent-integration.test.mjs  # 89 tests
node --test tests/integration/jupiter-torque.test.mjs     # 42 tests
```

## Hackathon Tracks

This submission qualifies for:

- 🏆 Zerion CLI Track ($5,000) — AGENT_ALLOWED
- 🏆 Jupiter "Not Your Regular Bounty" ($3,000) — AGENT_ALLOWED
- 🏆 Torque MCP Track ($3,000) — HUMAN_ONLY
- 🏆 Privacy Track ($5,000) — AGENT_ALLOWED
- 🏆 All 20+ Frontier regional side tracks

## License

MIT — Built on zerion-ai (MIT)
