# Heimgewebe Command Language

Heimgewebe commands are text-based control instructions that you write into PR comments. Heimgeist (and its dispatcher) parse these comments, extract commands and route them to the corresponding tools (Sichter, WGX, Heimlern, Metarepo).

The goal is: one simple language, regardless of which repo or tool you talk to.

---

## Basic syntax

`@heimgewebe/<tool> /<command> [arg1] [arg2] ...`

- `@heimgewebe/<tool>`: target tool
    - Examples: `@heimgewebe/sichter`, `@heimgewebe/wgx`, `@heimgewebe/heimlern`, `@heimgewebe/metarepo`
- `/<command>`: command for that tool
- `[arg…]`: optional arguments depending on tool/command

### Examples

```
@heimgewebe/sichter /quick
@heimgewebe/sichter /deep
@heimgewebe/wgx /guard changed
@heimgewebe/wgx /smoke staging
@heimgewebe/heimlern /pattern-bad sql-injection
@heimgewebe/metarepo /link-epic EPIC-123
```

Multiple commands in a single comment are allowed and will be processed in reading order.

---

## Tool overview

This section describes the current v1 command set that is actually supported by the CommandParser and validator logic in Heimgeist.

### 1. @heimgewebe/sichter – review and risk

- **Tool**: sichter
- **Purpose**: PR analysis, risk assessment, hints about structural issues
- **Syntax**: `@heimgewebe/sichter /<command> [args…]`

**Commands**

| Command | Args | Effect | Typical use |
|---|---|---|---|
| `quick` | – | fast, heuristic risk analysis of the PR | first impression before review |
| `deep` | – \| `area` | deeper analysis (patterns, tests, design) | before merge or critical changes |

`area` is intentionally kept open for future extensions (for example `/deep tests`, `/deep api`), but not enforced yet.

---

### 2. @heimgewebe/wgx – guard and smoke (toolchain)

- **Tool**: wgx
- **Purpose**: toolchain checks, guard and smoke runs
- **Syntax**: `@heimgewebe/wgx /<command> <scope|env>`

The valid scopes and environments are aligned with Heimgeist’s command validator.

**Commands**

| Command | Arg name | Allowed values | Meaning | Example |
|---|---|---|---|---|
| `guard` | `scope` | `all`, `changed`, `affected` | scope of guard checks | `@heimgewebe/wgx /guard changed` |
| `smoke` | `env` | `staging`, `production` | environment for smoke tests | `@heimgewebe/wgx /smoke staging` |

**Semantic hints**:

- `guard all`: run full guard suite (expensive, thorough)
- `guard changed`: limit checks to changed files (default choice for most PRs)
- `guard affected`: include transitive dependencies of changed files
- `smoke staging`: fast smoke checks in staging-like environment
- `smoke production`: careful smoke checks against production surface

---

### 3. @heimgewebe/heimlern – patterns and anti-patterns

- **Tool**: heimlern
- **Purpose**: mark good and bad code patterns
- **Syntax**: `@heimgewebe/heimlern /<command> <pattern-name>`

**Commands**

| Command | Args | Effect | Example |
|---|---|---|---|
| `pattern-good` | `<name>` | mark a positive pattern | `@heimgewebe/heimlern /pattern-good port-guard` |
| `pattern-bad` | `<name>` | mark an anti-pattern | `@heimgewebe/heimlern /pattern-bad sql-injection` |

Heimgeist can later correlate these patterns with incidents, risk levels and recommendations.

---

### 4. @heimgewebe/metarepo – epics and links

- **Tool**: metarepo
- **Purpose**: connect PRs with epics and higher-level structures
- **Syntax**: `@heimgewebe/metarepo /<command> [args…]`

**Commands (v1)**

| Command | Args | Meaning | Example |
|---|---|---|---|
| `link-epic` | `<epic-id>` | link PR to an epic | `@heimgewebe/metarepo /link-epic EPIC-123` |

Further commands like `/incident` or `/pattern-report` are possible follow-ups once schemas and flows are stable.

---

## Heimgeist CLI and API (internal commands)

Most of the command language above is designed for PR comments. Heimgeist itself exposes additional commands via CLI and HTTP API:

- **CLI examples**:

```bash
heimgeist status
heimgeist risk
heimgeist analyse --target pr:123
heimgeist insights
heimgeist actions
heimgeist serve --port 8234
```

- **HTTP API examples**:

```bash
curl http://localhost:8234/heimgeist/status
curl http://localhost:8234/heimgeist/risk
curl -X POST http://localhost:8234/heimgeist/analyse \
  -H "Content-Type: application/json" \
  -d '{ "target": "pr:123", "depth": "deep" }'
```

These CLI/API commands are meant for automation, local testing and integration. For human interaction in PRs, always prefer the `@heimgewebe/<tool> /...` language described above.

---

## Validation and error handling (conceptual)

- The `CommandParser` extracts all valid commands from a comment.
- The validator checks:
    - known tool,
    - known command for that tool,
    - arguments in the allowed range (for example `scope ∈ {all, changed, affected}`).
- Invalid commands can either be:
    - ignored, or
    - answered with a friendly error comment by the dispatcher (recommended for usability).

**Design recommendation**: prefer explicit feedback over silent failure, so that users can see immediately if a command was malformed.

---

## Status of this document

This file mirrors the currently implemented v1 behaviour of Heimgeist’s `CommandParser` and validators. Whenever new commands are added or argument rules change, this document should be updated together with code and tests.
