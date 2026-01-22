# Heimgeist

**System Self-Reflection Engine** - A tool that thinks about your system so you don't have to (but you should).

Heimgeist is the meta-agent of the heimgewebe ecosystem, designed to analyze, monitor, and provide insights about your systems, repositories, CI pipelines, and processes. It's like having a skeptical colleague who loves to point out "this will explode later" before it actually does.

## What Makes Heimgeist Different

Heimgeist is not just another CI/CD tool with LLM features. It's a **meta-agent** that:
- **Orchestrates** other agents (sichter, wgx, hausKI, heimlern)
- **Learns** from patterns over time via event-driven architecture
- **Tracks** Epics, Incidents, and Patterns as first-class entities
- **Operates** host-independently through events (GitHub today, Forgejo tomorrow)

See [Heimgewebe as Organism](docs/heimgewebe-organismus.md) for the full vision.

## Character

Heimgeist has a distinct personality:
- **Tone**: Dry, slightly ironic, analytical
- **Focus**: Code, repos, CI, processes, knowledge
- **Attitude**: Skeptical of "it works", loves contradictions, drift, and inconsistencies

## Features

### Autonomy Levels

Heimgeist can operate at four different autonomy levels:

| Level | Name | Description |
|-------|------|-------------|
| 0 | Passive | Reacts only to direct requests |
| 1 | Observing | Notes issues, only pings when explicitly asked |
| 2 | Warning (Default) | Proactively analyzes, writes hints/suggestions, needs confirmation for actions |
| 3 | Operative | Can trigger guards, analyses, reports, and propose changes within defined policies |

### Role Model

Heimgeist operates with four core roles:

1. **Observer** - Reads events (CI results, PRs, commits, errors, metrics) and extracts context
2. **Critic** - Detects drift, repetition errors, risky patterns, policy violations
3. **Director** - Plans tool chains and decides when to act vs. when to just note issues
4. **Archivist** - Writes insights back to chronik, semantAH, and heimlern

## Installation

```bash
npm install
npm run build
```

## Usage

### CLI Commands

```bash
# Get current status
heimgeist status

# Get risk assessment
heimgeist risk

# Run analysis
heimgeist analyse [--target <target>] [--depth quick|deep|full]

# List insights
heimgeist insights [--severity low|medium|high|critical]

# Explain an insight or action
heimgeist why [id]

# List planned actions
heimgeist actions [--pending]

# Approve or reject actions
heimgeist approve <action-id>
heimgeist reject <action-id>

# View/update configuration
heimgeist config [--level 0-3]

# Submit test events
heimgeist event <type> [--source <source>] [--status <status>]

# Start HTTP server
heimgeist serve [--port 3000]
```

### HTTP API

Start the server with `heimgeist serve`, then use these endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/heimgeist/status` | Get current status |
| POST | `/heimgeist/analyse` | Run an analysis |
| POST | `/heimgeist/explain` | Explain an insight/action/event |
| GET | `/heimgeist/risk` | Get risk assessment |
| GET | `/heimgeist/insights` | List all insights |
| GET | `/heimgeist/actions` | List planned actions |
| POST | `/heimgeist/actions/:id/approve` | Approve an action |
| POST | `/heimgeist/actions/:id/reject` | Reject an action |
| POST | `/heimgeist/events` | Submit an event |
| GET | `/heimgeist/config` | Get configuration |
| PATCH | `/heimgeist/config/autonomy` | Update autonomy level |

### Programmatic Usage

```typescript
import { createHeimgeist, EventType } from 'heimgeist';

const heimgeist = createHeimgeist();

// Process an event
const insights = await heimgeist.processEvent({
  id: 'event-1',
  type: EventType.CIResult,
  timestamp: new Date(),
  source: 'github-actions',
  payload: { status: 'failed' }
});

// Run analysis
const result = await heimgeist.analyse({ depth: 'deep' });

// Get risk assessment
const risk = heimgeist.getRiskAssessment();

// Get status
const status = heimgeist.getStatus();
```

## Configuration

Create a `.heimgeist/config.yml` file in your project root:

```yaml
# Autonomy level (0-3)
autonomyLevel: 2

# Active roles
activeRoles:
  - observer
  - critic
  - director
  - archivist

# Custom policies
policies:
  - name: custom-policy
    description: My custom policy
    minAutonomyLevel: 2
    allowedActions:
      - analyze
      - report

# Event sources
eventSources:
  - name: chronik
    type: chronik
    enabled: true

# Output destinations
outputs:
  - name: console
    type: console
    enabled: true
```

## Event Types

Heimgeist can process these event types:

### Core Events
- `heimgewebe.command.v1` - Commands from heimgewebe (@mentions in PRs)
- `ci.result` - CI/CD build results
- `pr.opened` / `pr.merged` / `pr.closed` - Pull request lifecycle
- `deploy.failed` / `deploy.succeeded` - Deployment events

### Advanced Events
- `incident.detected` / `incident.resolved` - Incident tracking
- `epic.linked` / `epic.completed` - Epic tracking for large projects
- `pattern.good` / `pattern.bad` - Pattern learning for best/anti-patterns
- `sichter.report.v1` - Analysis reports from sichter
- `wgx.guard.completed` - Guard check results from wgx
- `heimgeist.insight.v1` - Insights generated by Heimgeist
- `custom` - Custom events

See [Event Schema](docs/heimgewebe-vektor-blaupause.md#event-schema) for details.

## Development

```bash
# Run in development mode
npm run dev -- <command>

# Build
npm run build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run lint
```

## Integration with Chronik

Heimgeist connects to Chronik via the configured environment variables:
- `CHRONIK_INGEST_URL`: Base URL of the Chronik service (default: `http://localhost:3000`). Heimgeist appends `/v1/ingest` and `/v1/events` automatically.
- `CHRONIK_API_URL`: Optional override for the events endpoint if it differs from the ingest base.
- `CHRONIK_INGEST_DOMAIN`: Domain for event filtering/ingestion (default: `heimgeist.events`).

Heimgeist manages its own event cursor in `heimgeist_state/chronik.cursor`.
**Note:** Heimgeist consumes events from this domain exclusively. Skipped events (due to type mismatch) are considered "consumed" to advance the cursor. Do not share this domain/cursor with other independent consumers unless they are compatible replicas.

## Artifact Validation

Heimgeist employs a "Validation Gate" for external artifacts.
- **Strict Contracts** are loaded from `src/contracts/vendor/` and enforced using `Ajv`.
- These contracts are **manually vendored snapshots** from the Metarepo (Gate Light). Do not edit them manually.
- `scripts/sync-contracts.sh` is provided as a placeholder/template for future automated syncing.
- Artifacts are only ingested if they originate from allowed hosts (e.g., GitHub, localhost) and pass strict schema validation.

### Security & Validation Rules

- **Host Allowlist**:
    - **Production** (default): Strict allowlist (`github.com`, `objects.githubusercontent.com`, `raw.githubusercontent.com`). HTTPS required. `localhost` is blocked.
    - **Test/Dev**: If `NODE_ENV=test` or `ALLOW_UNSAFE_ARTIFACTS=1` is set, `localhost` and `127.0.0.1` are allowed (via HTTP or HTTPS).
- **Schema Ref (`schema_ref`)**:
    - Optional in the event payload.
    - If present, it must strictly match the `$id` of the contract used for internal validation.
    - Used to prevent "schema confusion" attacks where an event claims to be one type but targets another validator.

## Architecture

```
src/
├── api/         # HTTP API (Express)
├── cli/         # CLI (Commander.js)
├── config/      # Configuration loading and validation
├── core/        # Core Heimgeist engine
│   ├── heimgeist.ts      # Main meta-agent class
│   └── command-parser.ts # PR comment command parser
└── types/       # TypeScript type definitions
```

### The Heimgewebe Pipeline

Heimgeist is part of a larger event-driven pipeline:

```
GitHub PR Comments → Dispatcher → chronik (Events) 
    ↓                                      ↓
semantAH (Knowledge Graph) ← Heimgeist (Meta-Agent)
    ↓                                      ↓
sichter/wgx/hausKI (Tools) ← Actions → Reports
```

See the [complete architecture documentation](docs/heimgewebe-vektor-blaupause.md).

## PR Command Syntax

You can trigger Heimgeist and other tools via PR comments:

```markdown
@heimgewebe/sichter /quick           # Quick risk analysis
@heimgewebe/sichter /deep            # Deep analysis with patterns
@heimgewebe/wgx /guard changed       # Run guard checks for changed files
@heimgewebe/heimlern /pattern-bad    # Mark as anti-pattern
@heimgewebe/metarepo /link-epic EPIC-123  # Link to epic
```

For a complete overview of the command syntax across all tools, see:

- [docs/command-language.md](docs/command-language.md)

See [Pipeline Usage Guide](docs/pipeline-usage.md) for practical examples.

## Documentation

- **[Heimgewebe Vector Blueprint](docs/heimgewebe-vektor-blaupause.md)** - Technical architecture of the 5-layer pipeline
- **[Heimgewebe as Organism](docs/heimgewebe-organismus.md)** - Vision and philosophy
- **[Heimgeist Meta-Agent](docs/heimgeist-meta-agent.md)** - Detailed role definitions
- **[Pipeline Usage](docs/pipeline-usage.md)** - Practical usage patterns
- **[API Reference](docs/api.md)** - HTTP API documentation
- **[Examples](docs/examples/)** - Workflow examples

## License

MIT

## Organismus-Kontext

Dieses Repository ist Teil des **Heimgewebe-Organismus**.

Die übergeordnete Architektur, Achsen, Rollen und Contracts sind zentral beschrieben im  
👉 [`metarepo/docs/heimgewebe-organismus.md`](https://github.com/heimgewebe/metarepo/blob/main/docs/heimgewebe-organismus.md)  
👉 [`metarepo/docs/heimgewebe-zielbild.md`](https://github.com/heimgewebe/metarepo/blob/main/docs/heimgewebe-zielbild.md).

Alle Rollen-Definitionen, Datenflüsse und Contract-Zuordnungen dieses Repos
sind dort verankert.
