# Heimgeist

**System Self-Reflection Engine** - A tool that thinks about your system so you don't have to (but you should).

Heimgeist is the first component of the heimgewebe ecosystem, designed to analyze, monitor, and provide insights about your systems, repositories, CI pipelines, and processes. It's like having a skeptical colleague who loves to point out "this will explode later" before it actually does.

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

- `heimgewebe.command.v1` - Commands from heimgewebe
- `ci.result` - CI/CD build results
- `pr.opened` - Pull request opened
- `pr.merged` - Pull request merged
- `deploy.failed` - Deployment failure
- `incident.detected` - Incident detection
- `custom` - Custom events

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

## Architecture

```
src/
├── api/         # HTTP API (Express)
├── cli/         # CLI (Commander.js)
├── config/      # Configuration loading and validation
├── core/        # Core Heimgeist engine
└── types/       # TypeScript type definitions
```

## License

MIT