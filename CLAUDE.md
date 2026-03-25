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

- **Topology**: hierarchical
- **Max Agents**: 8
- **Strategy**: specialized
- **Memory**: hybrid
- **HNSW**: Enabled
- **Neural**: Enabled
- **Canonical Swarm ID**: `swarm-1774441906884-3icr71` ← ALWAYS reuse this, never create a new one

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
- ALWAYS batch ALL file reads/writes/edits in ONE message
- ALWAYS batch ALL Bash commands in ONE message

## Swarm Orchestration — Correct 4-Step Pattern

The swarm has two layers that MUST both be used: **MCP (coordination)** + **Task tool (execution)**.
Agents DO write code — but only via the Task tool spawning real Claude subprocesses.

### How the two layers work

| Layer | Tools | Purpose |
|---|---|---|
| **Coordination** | `mcp__ruflo__swarm_init`, `agent_spawn`, `coordination_orchestrate`, `task_create` | Registers roles, routes tasks, tracks ownership, stores memory |
| **Execution** | Claude Code **`Agent` / `Task` tool** | Spawns real Claude subprocesses with `Edit`/`Write`/`Bash` — **actually writes code** |

> *Per Ruflo docs: "CLI coordinates, Task tool agents do the actual work."*
> *"MCP tools are strictly for coordination... rely on the Claude Code Task tool for all real-world execution."*

### The Correct Pattern (ALL in ONE message)

```
// ── Coordination layer (MCP) ──────────────────────────────────
mcp__ruflo__swarm_init          { topology: "hierarchical", maxAgents: 8, strategy: "specialized" }
mcp__ruflo__agent_spawn         { agentType: "coder",    agentId: "coder-1",    model: "sonnet" }
mcp__ruflo__agent_spawn         { agentType: "tester",   agentId: "tester-1",   model: "haiku"  }
mcp__ruflo__agent_spawn         { agentType: "reviewer", agentId: "reviewer-1", model: "haiku"  }
mcp__ruflo__coordination_orchestrate { task: "...", strategy: "parallel" }
mcp__ruflo__task_create         { title: "Implement X", agentId: "coder-1", priority: "high" }

// ── Execution layer (Task/Agent tool — real Claude subprocesses) ──
Agent { subagent_type: "coder",    prompt: "Implement X in src/...", mode: "bypassPermissions" }
Agent { subagent_type: "tester",   prompt: "Write tests for X",      mode: "bypassPermissions" }
Agent { subagent_type: "reviewer", prompt: "Review the implementation" }

// ── Tracking ──────────────────────────────────────────────────
TodoWrite { todos: [...] }
```

### Step-by-Step

1. **`swarm_init`** — creates coordination namespace and swarm ID
2. **`agent_spawn` × N** — registers role metadata (does NOT execute code)
3. **`coordination_orchestrate` + `task_create`** — assigns work ownership
4. **`Agent` tool × N** — spawns real Claude subprocesses that edit files, run bash, write tests
5. **`agent_update`** — mark `active` when starting, `completed` when done

### Role Division

| Responsibility | MCP (coordination) | Agent/Task tool (execution) |
|---|---|---|
| Register agent roles | ✅ | ❌ |
| Track task ownership | ✅ | ❌ |
| Cross-session memory | ✅ | ❌ |
| Read / write files | ❌ | ✅ |
| Run bash commands | ❌ | ✅ |
| Generate + edit code | ❌ | ✅ |

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

- **ALWAYS reuse the canonical swarm** (`swarm-1774441906884-3icr71`) — NEVER call `swarm_init` again unless it is shut down
- Check swarm is running first: `mcp__ruflo__swarm_status` — if `status: "running"` skip init entirely
- ALWAYS call all `agent_spawn` + `coordination_orchestrate` + all `Agent` tool spawns in ONE message
- NEVER stop after `agent_spawn` alone — without the `Agent` tool calls, no code executes
- Use `mcp__ruflo__task_create` to register what each agent owns before spawning it
- Use `mcp__ruflo__agent_update` to mark agents `active` when starting, `completed` when done
- NEVER poll swarm status in a loop — check once after orchestration, then proceed
- For simple single-file tasks: skip the swarm, use Edit/Read/Bash directly (faster)
- Use swarms only for multi-file, multi-role tasks where parallel execution adds value

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

- **ruflo MCP** — coordination only:
  - `mcp__ruflo__swarm_init` → create swarm namespace
  - `mcp__ruflo__agent_spawn` → register role metadata (no execution)
  - `mcp__ruflo__coordination_orchestrate` → assign task ownership
  - `mcp__ruflo__task_create` / `mcp__ruflo__task_assign` → route work to agents
  - `mcp__ruflo__agent_update` → lifecycle tracking (active → completed)
  - `mcp__ruflo__memory_store` / `mcp__ruflo__memory_retrieve` → cross-session memory
- **Claude Code `Agent` tool** — real execution (spawns Claude subprocesses):
  - Pass `subagent_type` matching the spawned role (`coder`, `tester`, `reviewer`, etc.)
  - Subagent has its own context and can call Edit/Write/Read/Bash independently
  - Use `mode: "bypassPermissions"` for automated swarm execution
  - Use `isolation: "worktree"` for isolated parallel file edits
- **Claude Code direct tools** (Edit/Read/Bash/Grep/Glob) — for simple tasks not needing a swarm
- **CLI tools** (via Bash) — memory, hooks, routing: `npx @ruflo/cli@latest ...`

## Support

- Documentation: https://github.com/ruvnet/ruflo
- Issues: https://github.com/ruvnet/ruflo/issues
