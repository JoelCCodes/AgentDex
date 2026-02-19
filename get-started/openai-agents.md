# AgentDex + OpenAI Agents SDK

Wire AgentDex into an OpenAI Agents SDK agent as a `function_tool` that shells out to the CLI and parses JSON stdout.

## 1. Install

On the host where your agent runs:

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

## 3. Define the Tool in Python

```python
import subprocess
import json
from agents import function_tool

@function_tool
def run_agentdex(args: str) -> dict:
    """
    Run a AgentDex CLI command and return the parsed JSON output.
    Always pass --json. For swaps and sends, pass --yes.
    Example args: "balances --json"
    Example args: "swap --in SOL --out USDC --amount 0.01 --simulate-only --json"
    Example args: "swap --in SOL --out USDC --amount 0.01 --yes --json"
    """
    cmd = ["agentdex"] + args.split()
    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.returncode != 0:
        try:
            error_data = json.loads(result.stdout)
        except json.JSONDecodeError:
            error_data = {"error": result.stderr.strip() or "unknown error"}
        raise RuntimeError(
            f"agentdex exited {result.returncode}: {json.dumps(error_data)}"
        )

    return json.loads(result.stdout)
```

## 4. Wire Into an Agent

```python
from agents import Agent, Runner
import asyncio

trading_agent = Agent(
    name="Solana Trader",
    instructions="""
    You are a Solana trading agent using AgentDex.

    Trading workflow:
    1. Health check: run_agentdex("status --json") — abort if rpc.healthy is false
    2. Check balances: run_agentdex("balances --json")
    3. Simulate: run_agentdex("swap --in SOL --out USDC --amount 0.01 --simulate-only --json")
    4. Execute: run_agentdex("swap --in SOL --out USDC --amount 0.01 --yes --json")
    5. Verify: run_agentdex("balances --json") — wait 5s if on public RPC

    Exit code meanings: 0=success, 1=general, 2=config, 3=safety, 4=simulation, 5=send
    Always use --json. Always use --yes for real swaps. Never skip simulate.
    """,
    tools=[run_agentdex],
)

async def main():
    result = await Runner.run(trading_agent, "Check my SOL balance and simulate swapping 0.01 SOL to USDC")
    print(result.final_output)

asyncio.run(main())
```

## 5. Environment Variables

Set these in your agent's environment (container, `.env`, CI secrets):

| Variable | Description |
|---|---|
| `JUPITER_API_KEY` | Jupiter API key from portal.jup.ag |
| `AGENTDEX_RPC` | Solana RPC endpoint (overrides config file) |
| `AGENTDEX_WALLET` | Path to wallet keypair JSON (overrides config file) |

## 6. Exit Code Handling

| Code | Meaning | Suggested action |
|---|---|---|
| 0 | Success | Continue |
| 1 | General error | Check error message, may be transient |
| 2 | Config error | Re-run onboarding |
| 3 | Safety violation | Reduce amount or adjust `max_trade_sol` / `max_slippage_bps` |
| 4 | Simulation failed | Try a different pair or amount |
| 5 | Send failed | Retry with exponential backoff |

## Reference

- **[AGENT.md](../AGENT.md)** — Full integration guide with safety guardrails and response schemas
- **[EXAMPLES.md](../EXAMPLES.md)** — CLI reference with expected JSON outputs
