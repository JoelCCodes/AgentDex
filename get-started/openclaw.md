# AgentDex + OpenClaw

OpenClaw agents have the Bash tool available by default, so AgentDex works without any extra wiring. Install it on your agent's host and it's ready to call.

## 1. Ensure Bash Tool Access

Confirm your OpenClaw agent has the Bash tool enabled. If you're using a VM or container, SSH into it first:

```bash
ssh user@your-vm
```

## 2. Install

```bash
npm install -g agentdex-trade@latest
```

Verify:

```bash
agentdex --version   # should print 0.3.3+
```

## 3. Run Onboarding

**With an existing wallet:**

```bash
agentdex onboarding \
  --jupiter-api-key "$JUPITER_API_KEY" \
  --rpc "$SOLANA_RPC_URL" \
  --wallet ~/.config/solana/id.json \
  --max-slippage-bps 300 \
  --max-trade-sol 1 \
  --json
```

**Generate a fresh wallet:**

```bash
agentdex onboarding \
  --jupiter-api-key "$JUPITER_API_KEY" \
  --rpc "$SOLANA_RPC_URL" \
  --generate-wallet \
  --wallet-output ~/.agentdex/wallet.json \
  --json
```

Save the output — it includes your new wallet pubkey.

## 4. Set Environment Variables

Add these to the agent's environment so AgentDex can find credentials without reading config files:

```bash
export JUPITER_API_KEY="your-key-here"
export AGENTDEX_RPC="https://api.mainnet-beta.solana.com"
export AGENTDEX_WALLET="$HOME/.agentdex/wallet.json"
```

For persistent agents, add them to `~/.bashrc` or your container's env config.

## 5. Verify

```bash
agentdex status --json
```

Expected output:

```json
{
  "rpc": { "healthy": true, "latency_ms": 150 },
  "wallet": { "configured": true, "pubkey": "..." },
  "token_list": { "loaded": true }
}
```

If `rpc.healthy` is `false`, check your `AGENTDEX_RPC` endpoint.

## 6. The Agent Calls AgentDex Directly

No adapter code needed. The agent uses Bash tool calls like:

```bash
agentdex status --json
agentdex balances --json
agentdex swap --in SOL --out USDC --amount 0.01 --simulate-only --json
agentdex swap --in SOL --out USDC --amount 0.01 --yes --json
agentdex send --to <address> --token SOL --amount 0.01 --yes --json
```

## Reference

- **[AGENT.md](../AGENT.md)** — Full trading loop, exit codes, safety guardrails, and response schemas
- **[EXAMPLES.md](../EXAMPLES.md)** — CLI reference with expected JSON outputs
