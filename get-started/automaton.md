# AgentDex + automaton

Wire AgentDex into a [Conway-Research/automaton](https://github.com/Conway-Research/automaton) workflow as a shell step. Each step calls `agentdex <command> --json`, parses the output, and branches on the exit code.

## 1. Install on the Host

On the machine where automaton runs:

```bash
npm install -g agentdex-trade@latest
```

Verify:

```bash
agentdex --version   # should print 0.3.3+
```

## 2. Run Onboarding (Non-Interactive)

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

## 3. Configure a Shell Step

In your automaton workflow, define shell steps that call `agentdex` with `--json`. Parse stdout as JSON and check the exit code for branching logic.

Example minimal workflow — health-check → balance → simulate → swap:

```yaml
steps:
  - name: health_check
    type: shell
    command: agentdex status --json
    on_failure: abort   # exit code non-zero = RPC down, stop here

  - name: check_balances
    type: shell
    command: agentdex balances --json
    parse_json: true    # expose fields to subsequent steps

  - name: simulate_swap
    type: shell
    command: agentdex swap --in SOL --out USDC --amount 0.01 --simulate-only --json
    parse_json: true
    on_failure: abort   # simulation failed — bad route or safety violation

  - name: execute_swap
    type: shell
    command: agentdex swap --in SOL --out USDC --amount 0.01 --yes --json
    parse_json: true

  - name: verify_balances
    type: shell
    command: agentdex balances --json
    delay_seconds: 5    # wait for RPC to catch up
```

## 4. Parse JSON Output

Every `agentdex --json` command writes a single JSON object to stdout. Errors go to stderr.

**Success:**

```json
{
  "success": true,
  "signature": "3pw18d...",
  "input": { "symbol": "SOL", "amount": "0.01" },
  "output": { "symbol": "USDC", "amount": "0.845" }
}
```

**Error:**

```json
{
  "success": false,
  "error": "SAFETY_CHECK_FAILED",
  "message": "slippage 500 bps exceeds max 300 bps",
  "violations": ["slippage 500 bps exceeds max 300 bps"]
}
```

Check `success: true` before using output values.

## 5. Exit Code Handling

| Code | Meaning | Workflow action |
|---|---|---|
| 0 | Success | Proceed to next step |
| 1 | General error | Log and retry once, then abort |
| 2 | Config error | Abort — re-run onboarding to fix |
| 3 | Safety violation | Abort — reduce amount or adjust guardrails |
| 4 | Simulation failed | Abort — try different pair or amount |
| 5 | Send failed | Retry with exponential backoff |

## 6. Environment Variables

Set these in automaton's environment config or the host shell:

| Variable | Description |
|---|---|
| `JUPITER_API_KEY` | Jupiter API key from portal.jup.ag |
| `AGENTDEX_RPC` | Solana RPC endpoint (overrides config file) |
| `AGENTDEX_WALLET` | Path to wallet keypair JSON (overrides config file) |

## Reference

- **[AGENT.md](../AGENT.md)** — Full exit codes table, safety guardrails, and response schemas
- **[EXAMPLES.md](../EXAMPLES.md)** — CLI reference with expected JSON outputs
