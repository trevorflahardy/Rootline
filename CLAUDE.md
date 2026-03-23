# Claude Code Configuration - RuFlo V3

## Behavioral Rules (Always Enforced)

- Do what has been asked; nothing more, nothing less
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (\*.md) or README files unless explicitly requested
- NEVER save working files, text/mds, or tests to the root folder
- Never continuously check status after spawning a swarm — wait for results
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files

## File Organization

- NEVER save to root folder — use the directories below
- Use `/src` for source code files
- Use `/tests` for test files
- Use `/docs` for documentation and markdown files
- Use `/config` for configuration files
- Use `/scripts` for utility scripts
- Use `/examples` for example code

## Project Architecture

- Follow Domain-Driven Design with bounded contexts
- Keep files under 500 lines
- Use typed interfaces for all public APIs
- Prefer TDD London School (mock-first) for new code
- Use event sourcing for state changes
- Ensure input validation at system boundaries

### Project Config

- **Topology**: hierarchical-mesh
- **Max Agents**: 15
- **Memory**: hybrid
- **HNSW**: Enabled
- **Neural**: Enabled

## Build & Test

```bash
# Build
npm run build

# Test
npm test

# Lint
npm run lint
```

- ALWAYS run tests after making code changes
- ALWAYS verify build succeeds before committing

## Security Rules

- NEVER hardcode API keys, secrets, or credentials in source files
- NEVER commit .env files or any file containing secrets
- Always validate user input at system boundaries
- Always sanitize file paths to prevent directory traversal
- Run `npx @ruflo/cli@latest security scan` after security-related changes

## Concurrency: 1 MESSAGE = ALL RELATED OPERATIONS

- All operations MUST be concurrent/parallel in a single message
- NEVER use Claude Code's Agent/Task tool to spawn subagents — use ruflo MCP exclusively
- ALWAYS batch ALL file reads/writes/edits in ONE message
- ALWAYS batch ALL Bash commands in ONE message

## Swarm Orchestration

- MUST initialize swarm via `mcp__ruflo__swarm_init` before spawning agents
- MUST spawn ALL agents via `mcp__ruflo__agent_spawn` — NEVER via Claude Code's Task/Agent tool
- MUST call `swarm_init` AND all `agent_spawn` calls in ONE message for parallel startup
- Use `mcp__ruflo__agent_update` to track agent status (active → completed)
- Use `mcp__ruflo__swarm_status` and `mcp__ruflo__agent_list` to monitor progress

### 3-Tier Model Routing (ADR-026)

| Tier  | Handler              | Latency | Cost         | Use Cases                                           |
| ----- | -------------------- | ------- | ------------ | --------------------------------------------------- |
| **1** | Agent Booster (WASM) | <1ms    | $0           | Simple transforms (var→const, add types) — Skip LLM |
| **2** | Haiku                | ~500ms  | $0.0002      | Simple tasks, low complexity (<30%)                 |
| **3** | Sonnet/Opus          | 2-5s    | $0.003-0.015 | Complex reasoning, architecture, security (>30%)    |

- Always check for `[AGENT_BOOSTER_AVAILABLE]` or `[TASK_MODEL_RECOMMENDATION]` before spawning agents
- Use Edit tool directly when `[AGENT_BOOSTER_AVAILABLE]`

## Swarm Configuration & Anti-Drift

- ALWAYS use hierarchical topology for coding swarms
- Keep maxAgents at 6-8 for tight coordination
- Use specialized strategy for clear role boundaries
- Use `raft` consensus for hive-mind (leader maintains authoritative state)
- Run frequent checkpoints via `post-task` hooks
- Keep shared memory namespace for all agents

```bash
npx @ruflo/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized
```

## Swarm Execution Rules

- ALWAYS call `mcp__ruflo__swarm_init` + ALL `mcp__ruflo__agent_spawn` calls in ONE message
- After spawning, STOP — do NOT add more tool calls or poll status
- Use `mcp__ruflo__agent_update` to mark agents completed when results are received
- When all agents complete, review results then proceed with next steps
- Direct file edits (Edit tool) are done by Claude itself, NOT delegated to subagents

## V3 CLI Commands

### Core Commands

| Command     | Subcommands | Description                        |
| ----------- | ----------- | ---------------------------------- |
| `init`      | 4           | Project initialization             |
| `agent`     | 8           | Agent lifecycle management         |
| `swarm`     | 6           | Multi-agent swarm coordination     |
| `memory`    | 11          | AgentDB memory with HNSW search    |
| `task`      | 6           | Task creation and lifecycle        |
| `session`   | 7           | Session state management           |
| `hooks`     | 17          | Self-learning hooks + 12 workers   |
| `hive-mind` | 6           | Byzantine fault-tolerant consensus |

### Quick CLI Examples

```bash
npx @ruflo/cli@latest init --wizard
npx @ruflo/cli@latest agent spawn -t coder --name my-coder
npx @ruflo/cli@latest swarm init --v3-mode
npx @ruflo/cli@latest memory search --query "authentication patterns"
npx @ruflo/cli@latest doctor --fix
```

## Available Agents (60+ Types)

### Core Development

`coder`, `reviewer`, `tester`, `planner`, `researcher`

### Specialized

`security-architect`, `security-auditor`, `memory-specialist`, `performance-engineer`

### Swarm Coordination

`hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`

### GitHub & Repository

`pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`

### SPARC Methodology

`sparc-coord`, `sparc-coder`, `specification`, `pseudocode`, `architecture`

## Memory Commands Reference

```bash
# Store (REQUIRED: --key, --value; OPTIONAL: --namespace, --ttl, --tags)
npx @ruflo/cli@latest memory store --key "pattern-auth" --value "JWT with refresh" --namespace patterns

# Search (REQUIRED: --query; OPTIONAL: --namespace, --limit, --threshold)
npx @ruflo/cli@latest memory search --query "authentication patterns"

# List (OPTIONAL: --namespace, --limit)
npx @ruflo/cli@latest memory list --namespace patterns --limit 10

# Retrieve (REQUIRED: --key; OPTIONAL: --namespace)
npx @ruflo/cli@latest memory retrieve --key "pattern-auth" --namespace patterns
```

## Quick Setup

```bash
claude mcp add ruflo -- npx -y @ruflo/cli@latest
npx @ruflo/cli@latest daemon start
npx @ruflo/cli@latest doctor --fix
```

## Claude Code vs ruflo MCP vs CLI Tools

- **ruflo MCP** handles ALL agent spawning and swarm coordination (`mcp__ruflo__swarm_init`, `mcp__ruflo__agent_spawn`)
- **Claude Code** (Edit/Read/Bash/Grep/Glob) handles direct file operations, builds, and tests
- **CLI tools** (via Bash) handle memory, hooks, and routing: `npx @ruflo/cli@latest ...`
- NEVER use Claude Code's Agent or Task tool to spawn subagents — ruflo MCP only

## Support

- Documentation: https://github.com/ruvnet/ruflo
- Issues: https://github.com/ruvnet/ruflo/issues
