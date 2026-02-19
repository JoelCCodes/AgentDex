# AgentDex + n8n

Wire AgentDex into an [n8n](https://n8n.io) workflow using the Execute Command node. Each node calls `agentdex <command> --json`, a Code node parses the JSON output, and an IF node branches on the exit code.

n8n is a visual workflow automation tool. You build workflows by dragging nodes onto a canvas and connecting them with edges. This guide assumes a self-hosted n8n instance — the Execute Command node is not available on n8n Cloud.

## 1. Prerequisites and Install

**Requirements:**
- Self-hosted n8n (Docker or npm), version 2.0 or later
- Node.js 18+ on the host (or inside the n8n Docker container)
- A Jupiter API key from [portal.jup.ag](https://portal.jup.ag)
- A Solana RPC endpoint (e.g., Helius, QuickNode, or the public endpoint)

**Install AgentDex on the n8n host** (or inside the container — see section 7):

```bash
npm install -g agentdex-trade@latest
```

Verify the install:

```bash
agentdex --version   # should print 0.3.3+
```

## 2. Enable the Execute Command Node

The Execute Command node is disabled by default in n8n 2.0+. You must enable it before building your workflow.

**Docker Compose** — add the environment variable to your `docker-compose.yml`:

```yaml
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    environment:
      - NODES_INCLUDE=n8n-nodes-base.executeCommand
      - JUPITER_API_KEY=your_key_here
      - AGENTDEX_RPC=https://your-rpc-endpoint
      - AGENTDEX_WALLET=/home/node/.agentdex/wallet.json
```

Restart n8n after editing the file:

```bash
docker compose down && docker compose up -d
```

**npm (non-Docker)** — set the variable in the shell before starting n8n:

```bash
export NODES_INCLUDE=n8n-nodes-base.executeCommand
n8n start
```

After enabling, you will find "Execute Command" in the node search panel inside the n8n canvas.

## 3. Run Onboarding (Non-Interactive)

Before your first workflow run, configure AgentDex. Run this once on the host machine (or inside the container via `docker exec`):

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

The `--json` flag on onboarding prints the resulting config as JSON, which is useful for confirming the values were accepted.

## 4. Configure an Execute Command Node

In the n8n canvas, click the **+** button (or press **Tab**) to open the node search panel. Type "Execute Command" and select the node.

In the node's settings panel on the right:

| Field | Value |
|---|---|
| **Command** | The full `agentdex` command, e.g. `agentdex status --json` |
| **Execute Once** | On — run once per workflow execution, not once per input item |

**Using environment variables in the Command field:**

n8n passes the host environment to Execute Command nodes. If you set `JUPITER_API_KEY` in your Docker Compose file (section 2), it is available in the command without quoting:

```
agentdex swap --in SOL --out USDC --amount 0.01 --yes --json
```

**Output fields produced by Execute Command:**

After the node runs, it exposes three fields you can reference in downstream nodes:

| Field | Description |
|---|---|
| `stdout` | Everything the command printed to standard output |
| `stderr` | Error messages (non-empty when something went wrong) |
| `exitCode` | Integer exit code — 0 means success |

## 5. Example Workflow: Health Check → Balance → Simulate → Swap

This workflow performs the safe trading sequence: verify the RPC is up, check the wallet balance, simulate the swap, then execute it, and finally re-check the balance.

**Nodes in order:**

1. **Manual Trigger** (or Schedule Trigger for recurring runs)
2. **Execute Command** — health check
3. **IF** — branch on exit code
4. **Execute Command** — check balances
5. **Code** — parse balances JSON
6. **Execute Command** — simulate swap
7. **IF** — branch on simulation exit code
8. **Execute Command** — execute swap
9. **Code** — parse swap result
10. **Execute Command** — verify balances

**To build this in the canvas:**

1. Open a new workflow (click **New Workflow** in the top menu).
2. Click **+** and add a **Manual Trigger** node. This lets you run the workflow by clicking "Test workflow."
3. Click the **+** on the right edge of the Manual Trigger to add the next node.
4. Search for **Execute Command** and select it. In the settings panel, set the Command to:
   ```
   agentdex status --json
   ```
   Turn on **Execute Once**.
5. Add an **IF** node. Set the condition to:
   - **Value 1**: `{{ $json.exitCode }}`
   - **Operation**: `Equal`
   - **Value 2**: `0`

   The True branch continues the workflow. The False branch can connect to a **Stop and Error** node (search for "Stop") to halt with a message.

6. On the True branch, add another **Execute Command** node:
   ```
   agentdex balances --json
   ```

7. Add a **Code** node to parse the balances (see section 6).

8. Continue adding Execute Command nodes for simulate and swap, each followed by an IF node on `exitCode`.

**Commands for each Execute Command node:**

```
# Node 2 — health check
agentdex status --json

# Node 4 — balances
agentdex balances --json

# Node 6 — simulate
agentdex swap --in SOL --out USDC --amount 0.01 --simulate-only --json

# Node 8 — execute swap
agentdex swap --in SOL --out USDC --amount 0.01 --yes --json

# Node 10 — verify balances
agentdex balances --json
```

Note: `--simulate-only` does not require `--yes`. Real swaps and sends require `--yes`.

## 6. Parse JSON Output in a Code Node

Every `agentdex --json` command prints a single JSON object to stdout. The Execute Command node captures this in the `stdout` field as a string. Add a **Code** node immediately after each Execute Command to parse it.

To add a Code node: click **+** on the Execute Command node's output, search for "Code," and select it. In the code editor, use **JavaScript** mode (the default).

**Parse stdout:**

```javascript
const result = JSON.parse($json.stdout);
return [{ json: result }];
```

After this Code node, downstream nodes can reference the parsed fields directly, for example `{{ $json.signature }}` or `{{ $json.output.amount }}`.

**Successful swap response:**

```json
{
  "success": true,
  "signature": "3pw18d...",
  "input": { "symbol": "SOL", "amount": "0.01" },
  "output": { "symbol": "USDC", "amount": "0.845" }
}
```

**Error response:**

```json
{
  "success": false,
  "error": "SAFETY_CHECK_FAILED",
  "message": "slippage 500 bps exceeds max 300 bps",
  "violations": ["slippage 500 bps exceeds max 300 bps"]
}
```

Always check `{{ $json.success }}` before using output values in later nodes. Add an IF node after the Code node with the condition `{{ $json.success === true }}` for extra safety on top of the exit code check.

## 7. Exit Code Handling

Use an **IF** node after every Execute Command node. Set the condition:

- **Value 1**: `{{ $json.exitCode }}`
- **Operation**: `Equal`
- **Value 2**: `0`

Route the **True** output to the next step and the **False** output to a **Stop and Error** node or a notification node (e.g., Slack, email).

| Exit Code | Meaning | Recommended workflow action |
|---|---|---|
| 0 | Success | Proceed to next node |
| 1 | General error | Stop — check stderr, fix and re-run |
| 2 | Config error | Stop — re-run onboarding to fix config |
| 3 | Safety violation | Stop — reduce amount or adjust guardrails |
| 4 | Simulation failed | Stop — try a different token pair or amount |
| 5 | Send failed | Stop — check RPC and wallet balance |

**Logging stderr:** Add a Code node on the False branch to surface the error message:

```javascript
// Access stderr from the Execute Command node two steps back
const errText = $('Execute Command').item.json.stderr;
console.log('AgentDex error:', errText);
return [{ json: { error: errText } }];
```

## 8. Environment Variables

Set these in your Docker Compose `environment` block or as host environment variables. n8n passes them to the Execute Command node automatically.

| Variable | Description |
|---|---|
| `JUPITER_API_KEY` | Jupiter API key from portal.jup.ag |
| `AGENTDEX_RPC` | Solana RPC endpoint (overrides config file) |
| `AGENTDEX_WALLET` | Path to wallet keypair JSON (overrides config file) |

**Docker Compose example:**

```yaml
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    environment:
      - NODES_INCLUDE=n8n-nodes-base.executeCommand
      - JUPITER_API_KEY=${JUPITER_API_KEY}
      - AGENTDEX_RPC=${SOLANA_RPC_URL}
      - AGENTDEX_WALLET=/home/node/.agentdex/wallet.json
    volumes:
      - n8n_data:/home/node/.n8n
      - ~/.agentdex:/home/node/.agentdex:ro

volumes:
  n8n_data:
```

The volume mount shares your AgentDex config and wallet with the container without rebuilding the image. Use `:ro` (read-only) on the wallet volume for safety.

**Installing AgentDex inside the container:**

If you prefer to install AgentDex inside the Docker container rather than on the host, extend the base image:

```dockerfile
FROM docker.n8n.io/n8nio/n8n
USER root
RUN apk add --no-cache nodejs npm && npm install -g agentdex-trade@latest
USER node
```

Build and reference this image in your Compose file instead of `docker.n8n.io/n8nio/n8n`.

## Reference

- **[AGENT.md](../AGENT.md)** — Full exit codes table, safety guardrails, and response schemas
- **[EXAMPLES.md](../EXAMPLES.md)** — CLI reference with expected JSON outputs for every command
