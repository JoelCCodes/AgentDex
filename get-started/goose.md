# AgentDex + Goose

Goose (by Block) uses the Developer extension's `shell` tool natively, so AgentDex works out of the box — just install it and run `agentdex onboarding`. No adapter code needed.

## 1. Install AgentDex

```bash
npm install -g agentdex-trade@latest
```

Verify:

```bash
agentdex --version   # should print 0.3.3+
```

## 2. Run Onboarding

**Interactive** (recommended for first-time setup):

```bash
agentdex onboarding
```

AgentDex will prompt for your Jupiter API key, RPC URL, and wallet path.

**Non-interactive** (for scripted or headless setup):

```bash
agentdex onboarding \
  --jupiter-api-key "$JUPITER_API_KEY" \
  --rpc "$SOLANA_RPC_URL" \
  --wallet ~/.config/solana/id.json \
  --max-slippage-bps 300 \
  --max-trade-sol 1 \
  --json
```

Or generate a fresh wallet:

```bash
agentdex onboarding \
  --jupiter-api-key "$JUPITER_API_KEY" \
  --rpc "$SOLANA_RPC_URL" \
  --generate-wallet \
  --wallet-output ~/.agentdex/wallet.json \
  --json
```

## 3. Configure Goose

Goose reads a `.goosehints` file from the root of the directory where you start a session. Create one to teach Goose the AgentDex workflow:

```bash
cat > .goosehints << 'EOF'
AgentDex is a Solana DEX CLI. Always use these conventions:
- Every agentdex command must include --json for structured output
- Real swaps and sends require --yes; --simulate-only does not
- Trading workflow: status → balances → simulate → execute → verify balances
- Exit codes: 0=success, 1=general, 2=config, 3=safety, 4=simulation, 5=send
- Never skip simulation before executing a real swap
EOF
```

Goose's Developer extension shell tool runs with your full user privileges and autonomous mode by default, so AgentDex commands execute directly without additional approval steps.

**Optional: set env vars for the session**

Export these before starting `goose session` so AgentDex picks them up automatically:

```bash
export JUPITER_API_KEY="your-key-here"
export AGENTDEX_RPC="https://your-rpc-url"
export AGENTDEX_WALLET="$HOME/.agentdex/wallet.json"
```

## 4. Verify

Start a Goose session and confirm AgentDex is reachable:

```bash
goose session
```

Then ask Goose:

> "Run `agentdex status --json` and show me the result."

Goose will call the `shell` tool, execute `agentdex status --json`, and return structured output confirming your RPC connection and wallet.

## 5. Example Prompts

Once configured, ask Goose:

- "Check my SOL and USDC balances using agentdex."
- "Get a quote for swapping 0.1 SOL to USDC."
- "Simulate swapping 0.01 SOL to USDC and show the fees."
- "Swap 0.01 SOL to USDC — simulate first, then execute if the fee looks reasonable."
- "Send 0.005 SOL to `<address>`."

Goose will follow the trading workflow using `--json` and `--yes` flags automatically given the `.goosehints` instructions.

## 6. Headless / Automated Use

For non-interactive automation, use `goose run` with the Developer extension:

```bash
GOOSE_MODE=auto goose run \
  --with-builtin developer \
  -t "Check agentdex status, get my balances, then simulate swapping 0.01 SOL to USDC. Use --json on every command."
```

Or write a task file and run it:

```bash
# trade-task.md
# Check balances and simulate a SOL → USDC swap for 0.05 SOL.
# Use: agentdex balances --json, then agentdex swap --in SOL --out USDC --amount 0.05 --simulate-only --json
# Report the estimated output and fee.

GOOSE_MODE=auto goose run --with-builtin developer -i trade-task.md
```

Key env vars for headless runs:

| Variable | Purpose |
|---|---|
| `GOOSE_MODE=auto` | Skip per-tool approval prompts |
| `GOOSE_DISABLE_SESSION_NAMING=true` | Suppress background model calls (CI-friendly) |
| `GOOSE_MAX_TURNS` | Cap the number of agent steps |
| `JUPITER_API_KEY` | AgentDex: Jupiter API key |
| `AGENTDEX_RPC` | AgentDex: Solana RPC URL |
| `AGENTDEX_WALLET` | AgentDex: path to wallet keypair file |

## Reference

- **[AGENT.md](../AGENT.md)** — Full integration guide with error handling and safety guardrails
- **[EXAMPLES.md](../EXAMPLES.md)** — CLI reference with expected JSON outputs
