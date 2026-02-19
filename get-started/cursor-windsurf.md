# AgentDex + Cursor / Windsurf

Cursor and Windsurf both support rules files that inject instructions into every agent conversation. Add a AgentDex rules snippet and the IDE agent will know how to call it correctly.

## 1. Install

```bash
npm install -g agentdex-trade@latest
```

Verify:

```bash
agentdex --version   # should print 0.3.3+
```

## 2. Run Onboarding

```bash
agentdex onboarding \
  --jupiter-api-key "$JUPITER_API_KEY" \
  --rpc "$SOLANA_RPC_URL" \
  --wallet ~/.config/solana/id.json \
  --json
```

Check the `success` field in the output before proceeding.

## 3. Add a Rules File

### Cursor — `.cursorrules`

Create `.cursorrules` in your project root:

```
AgentDex is installed at `agentdex` for Solana trading.
See AGENT.md in the AgentDex repo for the full CLI reference.

Rules:
- Always use --json and --yes flags for non-interactive execution.
- Never skip --simulate-only before a real swap.
- Check exit codes: 0=success, 1=general, 2=config, 3=safety, 4=simulation, 5=send.
- Parse `balance` fields as strings, not numbers (preserves decimal precision).
- Abort if `agentdex status --json` shows `rpc.healthy: false`.
```

### Windsurf — `.windsurfrules`

Create `.windsurfrules` in your project root with the same content.

## 4. Set Environment Variables

Configure your IDE to expose these env vars in the agent shell:

| Variable | Description |
|---|---|
| `JUPITER_API_KEY` | Jupiter API key from portal.jup.ag |
| `AGENTDEX_RPC` | Solana RPC endpoint (overrides config file) |
| `AGENTDEX_WALLET` | Path to wallet keypair JSON (overrides config file) |

In Cursor: **Settings → Environment Variables**
In Windsurf: **Settings → AI → Environment**

## 5. Verify

Ask the IDE agent: "What is my SOL balance?"

It should call `agentdex balances --json` and parse the result. If you see a config error, run `agentdex status --json` to diagnose.

## Reference

- **[AGENT.md](../AGENT.md)** — Full integration guide with trading loop and exit codes
- **[EXAMPLES.md](../EXAMPLES.md)** — CLI reference with expected JSON outputs
