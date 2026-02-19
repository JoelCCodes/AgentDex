# Get Started with AgentDex

AgentDex is a Solana DEX CLI built for agents — JSON output, deterministic exit codes, and non-interactive flags that make it easy to wire into any AI platform. Swap any token, send transfers, and check balances from a single command.

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 18+ | `node --version` to check |
| Jupiter API key | Get one at [portal.jup.ag/api-keys](https://portal.jup.ag/api-keys) |
| Solana wallet | Existing keypair JSON, or use `--generate-wallet` during onboarding |

## Platform Guides

| Platform | Integration method | Guide |
|---|---|---|
| Claude Code | Bash tool (auto) | [claude-code.md](claude-code.md) |
| Cursor / Windsurf | IDE rules file | [cursor-windsurf.md](cursor-windsurf.md) |
| Goose | Shell tool (auto) | [goose.md](goose.md) |
| OpenAI Agents SDK | Shell subprocess tool | [openai-agents.md](openai-agents.md) |
| LangChain / LangGraph | Shell subprocess tool | [langchain.md](langchain.md) |
| CrewAI | Shell subprocess tool | [crewai.md](crewai.md) |
| Eliza / ElizaOS | Custom plugin | [eliza.md](eliza.md) |
| n8n | Execute Command node | [n8n.md](n8n.md) |
| OpenClaw | Bash tool (auto) | [openclaw.md](openclaw.md) |
| automaton | Shell subprocess | [automaton.md](automaton.md) |

## Full Reference

- **[AGENT.md](../AGENT.md)** — Integration guide: trading loop, error handling, exit codes, safety guardrails
- **[EXAMPLES.md](../EXAMPLES.md)** — Full CLI reference with expected JSON outputs
