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
- **Coordination**: hive-mind (persistent, survives restarts)
- **Canonical Hive Queen**: `rootline-queen` ← ALWAYS reuse this queen ID

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
- Run `ruflo security scan` after security-related changes

## Concurrency: 1 MESSAGE = ALL RELATED OPERATIONS

- All operations MUST be concurrent/parallel in a single message
- ALWAYS batch ALL file reads/writes/edits in ONE message
- ALWAYS batch ALL Bash commands in ONE message

## Swarm Orchestration — Correct 4-Step Pattern

Two layers MUST both be used: **MCP hive-mind (coordination)** + **Agent tool (execution)**.

### Why hive-mind over swarm
- `hive-mind` persists across restarts (project-wide SQLite memory)
- `hive-mind_status` shows real agent counts via MCP — `swarm status` always shows 0 for MCP-spawned agents
- `swarm` is session-only (state lost on restart)

### How the two layers work

| Layer | Tools | Purpose |
|---|---|---|
| **Coordination** | `mcp__ruflo__hive-mind_init`, `hive-mind_spawn`, `agent_spawn`, `task_create` | Registers roles, tracks workers, stores persistent memory |
| **Execution** | Claude Code **`Agent` tool** | Spawns real Claude subprocesses with `Edit`/`Write`/`Bash` — **actually writes code** |

### The Correct Pattern (ALL in ONE message)

```
// ── Coordination layer (MCP hive-mind) ────────────────────────
mcp__ruflo__hive-mind_init      { topology: "hierarchical", queenId: "rootline-queen" }
mcp__ruflo__hive-mind_spawn     { agentType: "coder",    prefix: "coder",    count: 1, role: "specialist" }
mcp__ruflo__hive-mind_spawn     { agentType: "tester",   prefix: "tester",   count: 1, role: "specialist" }
mcp__ruflo__hive-mind_spawn     { agentType: "reviewer", prefix: "reviewer", count: 1, role: "specialist" }
mcp__ruflo__task_create         { title: "Implement X", agentId: "coder-1", priority: "high" }

// ── Execution layer (Agent tool — real Claude subprocesses) ───
Agent { subagent_type: "coder",    prompt: "Implement X in src/...", mode: "bypassPermissions" }
Agent { subagent_type: "tester",   prompt: "Write tests for X",      mode: "bypassPermissions" }
Agent { subagent_type: "reviewer", prompt: "Review the implementation" }

// ── Tracking ──────────────────────────────────────────────────
TodoWrite { todos: [...] }
```

### Step-by-Step

1. **`hive-mind_init`** — check `hive-mind_status` first; only init if not already active
2. **`hive-mind_spawn` × N** — spawns workers AND joins them to hive (visible in `hive-mind_status`)
3. **`task_create`** — assigns work ownership
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

## Hive-Mind Configuration

- ALWAYS use hierarchical topology
- Use Byzantine consensus (default) — fault-tolerant across restarts
- Queen ID: `rootline-queen` — reuse across sessions, persistent SQLite memory
- Run frequent checkpoints via `post-task` hooks

```bash
ruflo hive-mind status          # check before init — reuse if active
ruflo hive-mind wizard          # interactive setup for new projects
```

## Hive-Mind Execution Rules

- **Check `hive-mind_status` first** — only call `hive-mind_init` if NOT already active
- **ALWAYS reuse queen** `rootline-queen` — hive-mind persists across restarts unlike swarm
- **Health check via MCP**: `mcp__ruflo__hive-mind_status` (shows real worker counts) — NOT `ruflo swarm status` (always 0 for MCP agents)
- ALWAYS call all `hive-mind_spawn` + `task_create` + all `Agent` tool spawns in ONE message
- NEVER stop after `hive-mind_spawn` alone — without the `Agent` tool calls, no code executes
- Use `mcp__ruflo__task_create` to register what each agent owns before spawning it
- Use `mcp__ruflo__agent_update` to mark agents `active` when starting, `completed` when done
- NEVER poll status in a loop — check once after orchestration, then proceed
- For simple single-file tasks: skip the hive-mind, use Edit/Read/Bash directly (faster)
- Use hive-mind only for multi-file, multi-role tasks where parallel execution adds value

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
ruflo init --wizard
ruflo agent spawn -t coder --name my-coder
ruflo swarm init --v3-mode
ruflo memory search --query "authentication patterns"
ruflo doctor --fix
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
ruflo memory store --key "pattern-auth" --value "JWT with refresh" --namespace patterns

# Search (REQUIRED: --query; OPTIONAL: --namespace, --limit, --threshold)
ruflo memory search --query "authentication patterns"

# List (OPTIONAL: --namespace, --limit)
ruflo memory list --namespace patterns --limit 10

# Retrieve (REQUIRED: --key; OPTIONAL: --namespace)
ruflo memory retrieve --key "pattern-auth" --namespace patterns
```

## Quick Setup

```bash
claude mcp add ruflo -- ruflo mcp start
ruflo daemon start
ruflo doctor --fix
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
- **CLI tools** (via Bash) — memory, hooks, routing: `ruflo ...`

## Support

- Documentation: https://github.com/ruvnet/ruflo
- Issues: https://github.com/ruvnet/ruflo/issues
