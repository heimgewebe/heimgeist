# Heimgeist Examples

This document provides practical examples of using Heimgeist in various scenarios.

## Table of Contents

- [Getting Started](#getting-started)
- [CLI Examples](#cli-examples)
- [Programmatic Usage](#programmatic-usage)
- [HTTP API Examples](#http-api-examples)
- [Event Processing](#event-processing)
- [Integration Examples](#integration-examples)

## Getting Started

First, install and build Heimgeist:

```bash
npm install
npm run build
```

## CLI Examples

### Check System Status

View the current status of Heimgeist:

```bash
heimgeist status
```

Example output:
```
=== Heimgeist Status ===

Version:         1.0.0
Autonomy Level:  Warning (2)
Active Roles:    observer, critic, director, archivist
Uptime:          42s
Events Processed: 5
Insights:        3
Actions Executed: 0
Last Activity:   2024-11-30T10:30:45.123Z
```

### Run Analysis

Perform a quick analysis of your system:

```bash
heimgeist analyse --depth quick
```

For a deep analysis:

```bash
heimgeist analyse --depth deep --target repo:myorg/myrepo
```

### Check Risk Assessment

Get a risk assessment of your system:

```bash
heimgeist risk
```

Example output with issues:
```
=== Risk Assessment ===

Risk Level: HIGH

Reasons:
  • 3 failed CI builds in the last 24 hours
  • 1 deployment failure detected
  • Increasing error rate in production

Recommendations:
  → Investigate recent CI failures
  → Review deployment logs
  → Check error monitoring dashboards

⚠️  High risk detected. You might want to look into this before it gets worse.
```

### List Insights

View all insights:

```bash
heimgeist insights
```

Filter by severity:

```bash
heimgeist insights --severity high
heimgeist insights --severity critical
```

### Explain an Insight

Get detailed explanation of a specific insight:

```bash
heimgeist why <insight-id>
```

Or list recent insights to explain:

```bash
heimgeist why
```

### Manage Planned Actions

List all planned actions:

```bash
heimgeist actions
```

Show only pending actions:

```bash
heimgeist actions --pending
```

Approve or reject an action:

```bash
heimgeist approve <action-id>
heimgeist reject <action-id>
```

### Configure Autonomy Level

View current configuration:

```bash
heimgeist config
```

Change autonomy level:

```bash
# Set to Passive (0) - only reacts to direct requests
heimgeist config --level 0

# Set to Observing (1) - notes issues, only pings when asked
heimgeist config --level 1

# Set to Warning (2) - proactively analyzes, needs confirmation
heimgeist config --level 2

# Set to Operative (3) - can trigger actions within policies
heimgeist config --level 3
```

### Submit Test Events

Submit a CI result event:

```bash
heimgeist event ci.result --source github-actions --status failed
```

Submit a deployment failure:

```bash
heimgeist event deploy.failed --source kubernetes --status error
```

Submit a PR event:

```bash
heimgeist event pr.opened --source github
```

### Start HTTP Server

Start the Heimgeist server on default port (3000):

```bash
heimgeist serve
```

Start on a custom port:

```bash
heimgeist serve --port 8080
```

## Programmatic Usage

### Basic Setup

```typescript
import { createHeimgeist, EventType } from 'heimgeist';

// Create a Heimgeist instance with default configuration
const heimgeist = createHeimgeist();

// Or with custom configuration
const heimgeist = createHeimgeist({
  autonomyLevel: 2,
  activeRoles: ['observer', 'critic', 'director', 'archivist'],
  policies: [],
  eventSources: [],
  outputs: [],
});
```

### Processing Events

```typescript
import { createHeimgeist, EventType } from 'heimgeist';

const heimgeist = createHeimgeist();

// Process a CI failure
const insights = await heimgeist.processEvent({
  id: 'ci-1',
  type: EventType.CIResult,
  timestamp: new Date(),
  source: 'github-actions',
  payload: {
    status: 'failed',
    repository: 'myorg/myrepo',
    branch: 'main',
    commit: 'abc123',
  },
});

console.log(`Generated ${insights.length} insights`);
insights.forEach((insight) => {
  console.log(`[${insight.severity}] ${insight.title}`);
  console.log(`  ${insight.description}`);
});
```

### Running Analysis

```typescript
const result = await heimgeist.analyse({
  target: 'repo:myorg/myrepo',
  depth: 'deep',
  scope: ['ci', 'deployments'],
  focus: ['errors', 'patterns'],
});

console.log(result.summary);
console.log(`Found ${result.insights.length} insights`);
console.log(`Planned ${result.plannedActions.length} actions`);
```

### Managing Actions

```typescript
// Get all planned actions
const actions = heimgeist.getPlannedActions();

// Approve an action
const approved = heimgeist.approveAction(actions[0].id);

// Reject an action
const rejected = heimgeist.rejectAction(actions[1].id);
```

### Getting Status and Risk

```typescript
// Get current status
const status = heimgeist.getStatus();
console.log(`Uptime: ${status.uptime}ms`);
console.log(`Events processed: ${status.eventsProcessed}`);

// Get risk assessment
const risk = heimgeist.getRiskAssessment();
console.log(`Risk level: ${risk.level}`);
risk.reasons.forEach((reason) => console.log(`  - ${reason}`));
```

### Explaining Insights

```typescript
// Explain a specific insight
const explanation = heimgeist.explain({ insightId: 'insight-123' });
if (explanation) {
  console.log(explanation.explanation);
  console.log('Reasoning:');
  explanation.reasoning.forEach((r) => console.log(`  - ${r}`));
}

// Explain an action
const actionExplanation = heimgeist.explain({ actionId: 'action-456' });
```

## HTTP API Examples

### Using curl

Check server health:

```bash
curl http://localhost:3000/health
```

Get status:

```bash
curl http://localhost:3000/heimgeist/status
```

Submit an event:

```bash
curl -X POST http://localhost:3000/heimgeist/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "ci.result",
    "source": "github-actions",
    "payload": {
      "status": "failed",
      "repository": "myorg/myrepo"
    }
  }'
```

Run an analysis:

```bash
curl -X POST http://localhost:3000/heimgeist/analyse \
  -H "Content-Type: application/json" \
  -d '{
    "depth": "deep",
    "target": "repo:myorg/myrepo"
  }'
```

Get risk assessment:

```bash
curl http://localhost:3000/heimgeist/risk
```

Get insights:

```bash
curl http://localhost:3000/heimgeist/insights
```

Approve an action:

```bash
curl -X POST http://localhost:3000/heimgeist/actions/<action-id>/approve
```

Update autonomy level:

```bash
curl -X PATCH http://localhost:3000/heimgeist/config/autonomy \
  -H "Content-Type: application/json" \
  -d '{"level": 3}'
```

### Using JavaScript/TypeScript

```typescript
import axios from 'axios';

const baseURL = 'http://localhost:3000/heimgeist';

// Submit an event
const response = await axios.post(`${baseURL}/events`, {
  type: 'ci.result',
  source: 'github-actions',
  payload: { status: 'failed' },
});

console.log(`Event processed: ${response.data.eventId}`);
console.log(`Generated ${response.data.insightsCount} insights`);

// Get insights
const insights = await axios.get(`${baseURL}/insights`);
console.log(`Total insights: ${insights.data.count}`);

// Run analysis
const analysis = await axios.post(`${baseURL}/analyse`, {
  depth: 'quick',
});
console.log(analysis.data.summary);
```

## Event Processing

### CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Notify Heimgeist

on:
  push:
  pull_request:
  workflow_run:
    workflows: ['CI']
    types: [completed]

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Notify Heimgeist of CI Result
        if: always()
        run: |
          curl -X POST $HEIMGEIST_URL/heimgeist/events \
            -H "Content-Type: application/json" \
            -d '{
              "type": "ci.result",
              "source": "github-actions",
              "payload": {
                "status": "${{ job.status }}",
                "repository": "${{ github.repository }}",
                "workflow": "${{ github.workflow }}",
                "run_id": "${{ github.run_id }}"
              }
            }'
        env:
          HEIMGEIST_URL: ${{ secrets.HEIMGEIST_URL }}
```

### Monitoring Integration

Example integration with monitoring system:

```typescript
import { createHeimgeist, EventType } from 'heimgeist';

const heimgeist = createHeimgeist();

// Monitor error rate
async function checkErrorRate() {
  const errorRate = await getErrorRateFromMonitoring();

  if (errorRate > threshold) {
    await heimgeist.processEvent({
      id: `error-rate-${Date.now()}`,
      type: EventType.Custom,
      timestamp: new Date(),
      source: 'monitoring',
      payload: {
        metric: 'error_rate',
        value: errorRate,
        threshold: threshold,
      },
    });
  }
}

setInterval(checkErrorRate, 60000); // Check every minute
```

## Integration Examples

### Express.js Integration

```typescript
import express from 'express';
import { createHeimgeist, createApiRouter } from 'heimgeist';

const app = express();
const heimgeist = createHeimgeist();

// Mount Heimgeist API
app.use('/heimgeist', createApiRouter(heimgeist));

// Custom endpoint to trigger analysis
app.post('/analyze-system', async (req, res) => {
  const result = await heimgeist.analyse({ depth: 'quick' });
  res.json(result);
});

app.listen(3000);
```

### Scheduled Analysis

```typescript
import { createHeimgeist } from 'heimgeist';
import { CronJob } from 'cron';

const heimgeist = createHeimgeist();

// Run analysis every hour
new CronJob('0 * * * *', async () => {
  console.log('Running scheduled analysis...');
  const result = await heimgeist.analyse({ depth: 'quick' });
  console.log(result.summary);

  // Check for critical insights
  const critical = result.insights.filter((i) => i.severity === 'critical');
  if (critical.length > 0) {
    // Send alerts
    console.log(`⚠️  ${critical.length} critical issues found!`);
  }
}).start();
```

### Custom Event Handler

```typescript
import { createHeimgeist, EventType } from 'heimgeist';

const heimgeist = createHeimgeist();

// Process multiple events in batch
async function processBatch(events: any[]) {
  const allInsights = [];

  for (const event of events) {
    const insights = await heimgeist.processEvent({
      id: event.id,
      type: event.type as EventType,
      timestamp: new Date(event.timestamp),
      source: event.source,
      payload: event.payload,
    });
    allInsights.push(...insights);
  }

  return allInsights;
}

// Example batch processing
const events = [
  { id: '1', type: 'ci.result', source: 'ci', payload: { status: 'failed' } },
  { id: '2', type: 'deploy.failed', source: 'k8s', payload: {} },
  { id: '3', type: 'incident.detected', source: 'monitoring', payload: {} },
];

const insights = await processBatch(events);
console.log(`Batch processed: ${insights.length} total insights`);
```

## Configuration Examples

### Custom Configuration File

Create `.heimgeist/config.yml`:

```yaml
autonomyLevel: 2

activeRoles:
  - observer
  - critic
  - director
  - archivist

policies:
  - name: ci-monitoring
    description: Monitor CI failures and suggest fixes
    minAutonomyLevel: 2
    allowedActions:
      - analyze
      - report
      - suggest_fix

  - name: deployment-guard
    description: Prevent risky deployments
    minAutonomyLevel: 3
    allowedActions:
      - block_deployment
      - request_approval

eventSources:
  - name: github-actions
    type: ci
    enabled: true
    config:
      webhook_url: https://api.github.com

  - name: kubernetes
    type: deployment
    enabled: true

outputs:
  - name: console
    type: console
    enabled: true

  - name: slack
    type: webhook
    enabled: false
    config:
      webhook_url: ${SLACK_WEBHOOK_URL}
```

### Loading Custom Configuration

```typescript
import { loadConfig, createHeimgeist } from 'heimgeist';

// Load configuration from file
const config = loadConfig();

// Create Heimgeist with custom config
const heimgeist = createHeimgeist(config);
```

## Best Practices

1. **Start with lower autonomy levels** (0-1) to understand how Heimgeist works
2. **Monitor insights regularly** to catch issues early
3. **Use event filtering** to avoid noise from unimportant events
4. **Review and approve actions** before increasing autonomy level
5. **Configure policies** to limit what Heimgeist can do automatically
6. **Integrate with CI/CD** to get real-time feedback
7. **Set up monitoring** for critical insights
8. **Document custom event types** for your team

## Troubleshooting

### No Insights Generated

- Check that events are being processed: `heimgeist status`
- Verify autonomy level is appropriate
- Ensure active roles include 'observer' and 'critic'

### Actions Not Being Planned

- Increase autonomy level to at least 2 (Warning)
- Ensure 'director' role is active
- Check that insights have high or critical severity

### Server Not Starting

- Check if port is available: `lsof -i :3000`
- Verify configuration file is valid
- Check logs for error messages

## Additional Resources

- [README](../README.md) - Main documentation
- [API Documentation](./api.md) - API reference
- [Context](./context.md) - Heimgeist philosophy and context
