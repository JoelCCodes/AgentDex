# AgentDex + ElizaOS

Wire AgentDex into an ElizaOS agent as a custom plugin with actions that shell out to the CLI and parse JSON stdout.

## 1. Install

On the host where your agent runs:

```bash
npm install -g agentdex-trade@latest
```

Verify:

```bash
agentdex --version   # should print 0.3.3+
```

Install the ElizaOS CLI if you haven't already:

```bash
npm install -g @elizaos/cli
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

## 3. Create the AgentDex Plugin

Scaffold a new plugin project:

```bash
elizaos create plugin-agentdex --type plugin
cd plugin-agentdex
bun install
```

Replace `src/index.ts` with the plugin definition and replace the generated action files with the following.

### `src/actions/agentdex.ts`

```typescript
import { spawnSync } from "node:child_process";
import type { Action, IAgentRuntime, Memory, State } from "@elizaos/core";

function runAgentdex(args: string[]): { success: boolean; data?: unknown; error?: string; code: number } {
  const result = spawnSync("agentdex", [...args, "--json"], {
    encoding: "utf8",
    env: process.env,
  });

  const code = result.status ?? 1;

  if (code !== 0) {
    let error: string;
    try {
      const parsed = JSON.parse(result.stdout);
      error = parsed.error ?? JSON.stringify(parsed);
    } catch {
      error = result.stderr?.trim() || result.stdout?.trim() || "unknown error";
    }
    return { success: false, error, code };
  }

  try {
    return { success: true, data: JSON.parse(result.stdout), code: 0 };
  } catch {
    return { success: false, error: "failed to parse agentdex output", code };
  }
}

export const agentdexStatusAction: Action = {
  name: "AGENTDEX_STATUS",
  similes: ["CHECK_SOLANA_STATUS", "SOLANA_HEALTH_CHECK", "DEX_STATUS"],
  description: "Check AgentDex and Solana RPC health status.",

  validate: async (_runtime: IAgentRuntime, _message: Memory) => true,

  handler: async (_runtime: IAgentRuntime, _message: Memory, _state: State | undefined, _options: unknown, callback?: (response: { text: string; data?: unknown }) => Promise<unknown>) => {
    const res = runAgentdex(["status"]);
    const text = res.success
      ? `AgentDex status: ${JSON.stringify(res.data)}`
      : `AgentDex status check failed (exit ${res.code}): ${res.error}`;
    if (callback) await callback({ text, data: res.data });
    return { success: res.success, text, values: { result: res } };
  },

  examples: [[
    { name: "{{user}}", content: { text: "Check Solana RPC status" } },
    { name: "{{agent}}", content: { text: "Checking AgentDex status...", actions: ["AGENTDEX_STATUS"] } },
  ]],
};

export const agentdexBalancesAction: Action = {
  name: "AGENTDEX_BALANCES",
  similes: ["GET_SOLANA_BALANCES", "CHECK_WALLET_BALANCES", "SHOW_BALANCES"],
  description: "Get current wallet token balances via AgentDex.",

  validate: async (_runtime: IAgentRuntime, _message: Memory) => true,

  handler: async (_runtime: IAgentRuntime, _message: Memory, _state: State | undefined, _options: unknown, callback?: (response: { text: string; data?: unknown }) => Promise<unknown>) => {
    const res = runAgentdex(["balances"]);
    const text = res.success
      ? `Wallet balances: ${JSON.stringify(res.data)}`
      : `Failed to fetch balances (exit ${res.code}): ${res.error}`;
    if (callback) await callback({ text, data: res.data });
    return { success: res.success, text, values: { result: res } };
  },

  examples: [[
    { name: "{{user}}", content: { text: "What are my token balances?" } },
    { name: "{{agent}}", content: { text: "Fetching wallet balances...", actions: ["AGENTDEX_BALANCES"] } },
  ]],
};

export const agentdexQuoteAction: Action = {
  name: "AGENTDEX_QUOTE",
  similes: ["GET_SWAP_QUOTE", "TOKEN_PRICE_QUOTE", "QUOTE_SWAP"],
  description: "Get a swap quote for a token pair via AgentDex. Requires tokenIn, tokenOut, and amount.",

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content as { text?: string })?.text ?? "";
    return /\b(quote|price|how much|swap|convert)\b/i.test(text);
  },

  handler: async (_runtime: IAgentRuntime, message: Memory, _state: State | undefined, options: { tokenIn?: string; tokenOut?: string; amount?: string } | unknown, callback?: (response: { text: string; data?: unknown }) => Promise<unknown>) => {
    const opts = (options ?? {}) as { tokenIn?: string; tokenOut?: string; amount?: string };
    const tokenIn = opts.tokenIn ?? "SOL";
    const tokenOut = opts.tokenOut ?? "USDC";
    const amount = opts.amount ?? "0.01";

    const res = runAgentdex(["quote", "--in", tokenIn, "--out", tokenOut, "--amount", amount]);
    const text = res.success
      ? `Quote for ${amount} ${tokenIn} → ${tokenOut}: ${JSON.stringify(res.data)}`
      : `Quote failed (exit ${res.code}): ${res.error}`;
    if (callback) await callback({ text, data: res.data });
    return { success: res.success, text, values: { result: res } };
  },

  examples: [[
    { name: "{{user}}", content: { text: "Get a quote for swapping 0.1 SOL to USDC" } },
    { name: "{{agent}}", content: { text: "Getting swap quote...", actions: ["AGENTDEX_QUOTE"] } },
  ]],
};

export const agentdexSimulateAction: Action = {
  name: "AGENTDEX_SIMULATE",
  similes: ["SIMULATE_SWAP", "DRY_RUN_SWAP", "TEST_SWAP"],
  description: "Simulate a token swap via AgentDex without executing it. Requires tokenIn, tokenOut, and amount.",

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content as { text?: string })?.text ?? "";
    return /\b(simulate|dry.?run|test swap)\b/i.test(text);
  },

  handler: async (_runtime: IAgentRuntime, _message: Memory, _state: State | undefined, options: { tokenIn?: string; tokenOut?: string; amount?: string } | unknown, callback?: (response: { text: string; data?: unknown }) => Promise<unknown>) => {
    const opts = (options ?? {}) as { tokenIn?: string; tokenOut?: string; amount?: string };
    const tokenIn = opts.tokenIn ?? "SOL";
    const tokenOut = opts.tokenOut ?? "USDC";
    const amount = opts.amount ?? "0.01";

    const res = runAgentdex(["swap", "--in", tokenIn, "--out", tokenOut, "--amount", amount, "--simulate-only"]);
    const text = res.success
      ? `Simulation result for ${amount} ${tokenIn} → ${tokenOut}: ${JSON.stringify(res.data)}`
      : `Simulation failed (exit ${res.code}): ${res.error}`;
    if (callback) await callback({ text, data: res.data });
    return { success: res.success, text, values: { result: res } };
  },

  examples: [[
    { name: "{{user}}", content: { text: "Simulate swapping 0.5 SOL to USDC" } },
    { name: "{{agent}}", content: { text: "Simulating swap...", actions: ["AGENTDEX_SIMULATE"] } },
  ]],
};

export const agentdexSwapAction: Action = {
  name: "AGENTDEX_SWAP",
  similes: ["EXECUTE_SWAP", "DO_SWAP", "BUY_TOKEN", "SELL_TOKEN", "TRADE_TOKEN"],
  description: "Execute a real token swap via AgentDex. Always simulates first. Requires tokenIn, tokenOut, and amount.",

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content as { text?: string })?.text ?? "";
    return /\b(swap|buy|sell|trade|exchange)\b/i.test(text);
  },

  handler: async (_runtime: IAgentRuntime, _message: Memory, _state: State | undefined, options: { tokenIn?: string; tokenOut?: string; amount?: string } | unknown, callback?: (response: { text: string; data?: unknown }) => Promise<unknown>) => {
    const opts = (options ?? {}) as { tokenIn?: string; tokenOut?: string; amount?: string };
    const tokenIn = opts.tokenIn ?? "SOL";
    const tokenOut = opts.tokenOut ?? "USDC";
    const amount = opts.amount ?? "0.01";
    const baseArgs = ["--in", tokenIn, "--out", tokenOut, "--amount", amount];

    // 1. Status check
    const status = runAgentdex(["status"]);
    if (!status.success || (status.data as { rpc?: { healthy?: boolean } })?.rpc?.healthy === false) {
      const text = `Aborting swap: RPC is unhealthy. ${status.error ?? ""}`.trim();
      if (callback) await callback({ text });
      return { success: false, text, values: { result: status } };
    }

    // 2. Simulate
    const sim = runAgentdex(["swap", ...baseArgs, "--simulate-only"]);
    if (!sim.success) {
      const text = `Swap simulation failed (exit ${sim.code}): ${sim.error}`;
      if (callback) await callback({ text, data: sim.data });
      return { success: false, text, values: { result: sim } };
    }

    // 3. Execute
    const exec = runAgentdex(["swap", ...baseArgs, "--yes"]);
    const text = exec.success
      ? `Swap executed: ${amount} ${tokenIn} → ${tokenOut}. Result: ${JSON.stringify(exec.data)}`
      : `Swap execution failed (exit ${exec.code}): ${exec.error}`;
    if (callback) await callback({ text, data: exec.data });
    return { success: exec.success, text, values: { result: exec } };
  },

  examples: [[
    { name: "{{user}}", content: { text: "Swap 0.01 SOL to USDC" } },
    { name: "{{agent}}", content: { text: "Executing swap...", actions: ["AGENTDEX_SWAP"] } },
  ]],
};

export const agentdexSendAction: Action = {
  name: "AGENTDEX_SEND",
  similes: ["SEND_TOKEN", "TRANSFER_TOKEN", "SEND_SOL", "TRANSFER_SOL"],
  description: "Send tokens to an address via AgentDex. Requires toAddress, token, and amount.",

  validate: async (_runtime: IAgentRuntime, message: Memory) => {
    const text = (message.content as { text?: string })?.text ?? "";
    return /\b(send|transfer|pay)\b/i.test(text);
  },

  handler: async (_runtime: IAgentRuntime, _message: Memory, _state: State | undefined, options: { toAddress?: string; token?: string; amount?: string } | unknown, callback?: (response: { text: string; data?: unknown }) => Promise<unknown>) => {
    const opts = (options ?? {}) as { toAddress?: string; token?: string; amount?: string };
    if (!opts.toAddress) {
      const text = "Send failed: toAddress is required.";
      if (callback) await callback({ text });
      return { success: false, text, values: {} };
    }

    const token = opts.token ?? "SOL";
    const amount = opts.amount ?? "0.01";

    const res = runAgentdex(["send", "--to", opts.toAddress, "--token", token, "--amount", amount, "--yes"]);
    const text = res.success
      ? `Sent ${amount} ${token} to ${opts.toAddress}. Result: ${JSON.stringify(res.data)}`
      : `Send failed (exit ${res.code}): ${res.error}`;
    if (callback) await callback({ text, data: res.data });
    return { success: res.success, text, values: { result: res } };
  },

  examples: [[
    { name: "{{user}}", content: { text: "Send 0.01 SOL to <address>" } },
    { name: "{{agent}}", content: { text: "Sending tokens...", actions: ["AGENTDEX_SEND"] } },
  ]],
};
```

### `src/index.ts`

```typescript
import type { Plugin } from "@elizaos/core";
import {
  agentdexStatusAction,
  agentdexBalancesAction,
  agentdexQuoteAction,
  agentdexSimulateAction,
  agentdexSwapAction,
  agentdexSendAction,
} from "./actions/agentdex";

export const agentdexPlugin: Plugin = {
  name: "agentdex",
  description: "Solana DEX trading via AgentDex CLI (Jupiter-powered swaps, balances, transfers)",
  actions: [
    agentdexStatusAction,
    agentdexBalancesAction,
    agentdexQuoteAction,
    agentdexSimulateAction,
    agentdexSwapAction,
    agentdexSendAction,
  ],
};

export default agentdexPlugin;
```

Build the plugin:

```bash
bun run build
bun link
```

## 4. Wire Into an Agent Character

Create your agent project and link the plugin:

```bash
elizaos create my-trading-agent
cd my-trading-agent
bun link plugin-agentdex
```

Edit the generated character file (e.g., `src/character.ts`):

```typescript
import { agentdexPlugin } from "plugin-agentdex";

export const character = {
  name: "Solana Trader",
  bio: [
    "An autonomous Solana trading agent powered by AgentDex and Jupiter.",
    "Always simulates before executing. Never skips a health check.",
  ],
  plugins: [agentdexPlugin],
  settings: {
    // AgentDex reads these from the environment automatically.
    // Set JUPITER_API_KEY, AGENTDEX_RPC, and AGENTDEX_WALLET in your shell or .env.
  },
  system: `
You are a Solana trading agent using AgentDex (Jupiter-powered CLI).

Trading workflow — always follow this order:
1. Health check: AGENTDEX_STATUS — abort if rpc.healthy is false
2. Check balances: AGENTDEX_BALANCES — confirm sufficient funds
3. Simulate: AGENTDEX_SIMULATE — never skip; surface any errors before committing
4. Execute: AGENTDEX_SWAP or AGENTDEX_SEND
5. Verify: AGENTDEX_BALANCES — wait 5 s on public RPC before re-checking

Exit code meanings: 0=success 1=general 2=config 3=safety 4=simulation 5=send
On exit code 3, reduce trade size or slippage tolerance.
On exit code 5, retry with exponential backoff.
Always use --json (handled by the plugin). Always use --yes for real swaps/sends.
  `.trim(),
};
```

Start the agent:

```bash
elizaos dev   # development with hot reload
# or
elizaos start # production
```

## 5. Environment Variables

Set these in your agent's environment (`.env`, container secrets, or shell export):

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
