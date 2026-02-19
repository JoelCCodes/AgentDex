# AgentDex + CrewAI

Wire AgentDex into a CrewAI multi-agent crew as a shared `BaseTool` that shells out to the CLI and parses JSON stdout. A natural fit is two specialized agents: an **Analyst** that reads market state and an **Trader** that executes swaps — both sharing the same AgentDex tool.

## 1. Install

On the host where your crew runs:

```bash
npm install -g agentdex-trade@latest
```

Verify:

```bash
agentdex --version   # should print 0.3.3+
```

Install the Python packages:

```bash
pip install crewai
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

## 3. Define the Tool

Use `BaseTool` with a Pydantic `args_schema` for input validation. The tool runs any AgentDex subcommand and returns parsed JSON.

```python
import json
import subprocess
from typing import Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field


class AgentDexInput(BaseModel):
    """Input schema for AgentDexTool."""
    args: str = Field(
        ...,
        description=(
            "AgentDex CLI arguments (everything after 'agentdex'). "
            "Always include --json. Include --yes for real swaps and sends. "
            "Examples: "
            "'status --json', "
            "'balances --json', "
            "'quote --in SOL --out USDC --amount 0.01 --json', "
            "'swap --in SOL --out USDC --amount 0.01 --simulate-only --json', "
            "'swap --in SOL --out USDC --amount 0.01 --yes --json', "
            "'send --to <address> --token SOL --amount 0.01 --yes --json'"
        ),
    )


class AgentDexTool(BaseTool):
    name: str = "AgentDex"
    description: str = (
        "Run a AgentDex CLI command against the Solana blockchain. "
        "Supports status, balances, quote, swap, and send. "
        "Always pass --json. Pass --yes for real swaps and sends (not needed for --simulate-only). "
        "Returns parsed JSON output."
    )
    args_schema: Type[BaseModel] = AgentDexInput

    def _run(self, args: str) -> str:
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

        return result.stdout  # JSON string; CrewAI passes it to the next agent as context


agentdex_tool = AgentDexTool()
```

## 4. Wire Into a Crew

Define an Analyst agent and a Trader agent that share the AgentDex tool, then chain their tasks so the Analyst's output feeds the Trader as context.

```python
from crewai import Agent, Crew, Process, Task

# --- Agents ---

analyst = Agent(
    role="Market Analyst",
    goal=(
        "Assess current Solana wallet state and evaluate whether a swap is safe to execute. "
        "Check network health, balances, and get a quote. Report findings as structured JSON."
    ),
    backstory=(
        "You are a cautious on-chain analyst. You never execute trades — you only gather "
        "data and produce recommendations for the Trader to act on."
    ),
    tools=[agentdex_tool],
    verbose=True,
    allow_delegation=False,
)

trader = Agent(
    role="Solana Trader",
    goal=(
        "Execute swaps on Solana using AgentDex. "
        "Always simulate before executing. Verify balances after the trade."
    ),
    backstory=(
        "You are a disciplined trader. You trust the Analyst's assessment and follow the "
        "standard workflow: simulate → execute → verify. You never skip simulation."
    ),
    tools=[agentdex_tool],
    verbose=True,
    allow_delegation=False,
)

# --- Tasks ---

analysis_task = Task(
    description=(
        "Use AgentDex to:\n"
        "1. Check network health: agentdex status --json (abort if rpc.healthy is false)\n"
        "2. Check wallet balances: agentdex balances --json\n"
        "3. Get a quote: agentdex quote --in SOL --out USDC --amount 0.01 --json\n"
        "Return a summary with health status, SOL balance, and quoted output amount."
    ),
    expected_output=(
        "JSON summary containing: rpc_healthy (bool), sol_balance (float), "
        "quoted_usdc_out (float), and a recommendation field (proceed or abort)."
    ),
    agent=analyst,
)

trade_task = Task(
    description=(
        "Using the Analyst's findings, execute the swap if recommended:\n"
        "1. Simulate: agentdex swap --in SOL --out USDC --amount 0.01 --simulate-only --json\n"
        "2. If simulation succeeds, execute: agentdex swap --in SOL --out USDC --amount 0.01 --yes --json\n"
        "3. Verify balances: agentdex balances --json\n"
        "If the Analyst recommended abort, do not execute — report the reason instead."
    ),
    expected_output=(
        "JSON result containing: simulated (bool), executed (bool), "
        "tx_signature (str or null), final_sol_balance (float), final_usdc_balance (float)."
    ),
    agent=trader,
    context=[analysis_task],  # Analyst output is injected here
)

# --- Crew ---

trading_crew = Crew(
    agents=[analyst, trader],
    tasks=[analysis_task, trade_task],
    process=Process.sequential,
    verbose=True,
)

# --- Run ---

result = trading_crew.kickoff()
print(result)
```

## 5. Environment Variables

Set these in your agent's environment (container, `.env`, CI secrets):

| Variable | Description |
|---|---|
| `JUPITER_API_KEY` | Jupiter API key from portal.jup.ag |
| `AGENTDEX_RPC` | Solana RPC endpoint (overrides config file) |
| `AGENTDEX_WALLET` | Path to wallet keypair JSON (overrides config file) |

Example `.env`:

```bash
JUPITER_API_KEY=your_key_here
AGENTDEX_RPC=https://mainnet.helius-rpc.com/?api-key=...
AGENTDEX_WALLET=~/.agentdex/wallet.json
```

Load with `python-dotenv` or export before running:

```bash
export $(cat .env | xargs) && python crew.py
```

## 6. Exit Code Handling

AgentDex uses structured exit codes. The `AgentDexTool._run` method raises `RuntimeError` on any non-zero exit, which CrewAI surfaces as a tool error and retries or escalates per agent config.

| Code | Meaning | Suggested agent response |
|---|---|---|
| 0 | Success | Continue |
| 1 | General error | Check error message, may be transient — retry |
| 2 | Config error | Stop; re-run onboarding before retrying |
| 3 | Safety violation | Reduce amount or adjust `max_trade_sol` / `max_slippage_bps` in config |
| 4 | Simulation failed | Try a different pair or amount |
| 5 | Send failed | Retry with exponential backoff |

To surface the code explicitly, inspect the error message string (it includes `agentdex exited <N>`):

```python
import re

def handle_agentdex_error(exc: RuntimeError) -> None:
    match = re.search(r"agentdex exited (\d+)", str(exc))
    code = int(match.group(1)) if match else -1
    if code == 2:
        raise SystemExit("AgentDex config missing — run onboarding first")
    elif code == 3:
        print("Safety limit hit — reduce trade size")
    elif code == 5:
        print("Send failed — retry after delay")
    else:
        raise exc
```

## Reference

- **[AGENT.md](../AGENT.md)** — Full integration guide with safety guardrails and response schemas
- **[EXAMPLES.md](../EXAMPLES.md)** — CLI reference with expected JSON outputs
