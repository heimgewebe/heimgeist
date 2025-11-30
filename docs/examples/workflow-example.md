# Heimgewebe Pipeline Workflow Examples

## Example 1: High-Risk PR Review Workflow

### Scenario
A developer opens a PR that modifies authentication-related code. The pipeline automatically detects this as high-risk and triggers comprehensive checks.

### Flow

```typescript
// 1. PR opened
const prEvent = {
  type: 'pr.opened',
  timestamp: new Date(),
  source: 'github',
  payload: {
    pr_number: 142,
    repo: 'heimgewebe/metarepo',
    title: 'Update auth token validation',
    files_changed: ['src/auth/validator.ts'],
    author: 'developer1'
  }
};

// 2. Heimgeist processes event
heimgeist.processEvent(prEvent);
// Observer: "PR modifies auth layer"
// Critic: "This file was involved in 3 incidents"
// Director: Plans action chain

// 3. User can also manually trigger analysis
// PR Comment: @heimgewebe/sichter /deep

// 4. Sichter performs deep analysis
const sichterReport = {
  pr: 142,
  risk_level: 'high',
  affected_layers: ['auth', 'api'],
  similar_prs: [38, 42, 87],
  recommendations: [
    'Run comprehensive security tests',
    'Review token expiration logic',
    'Compare with PR #42 which had similar issues'
  ]
};
```

## Example 2: Using Commands in PR Comments

```markdown
<!-- In a GitHub PR comment -->

@heimgewebe/sichter /quick
@heimgewebe/wgx /guard auth
@heimgewebe/heimlern /pattern-bad sql-injection
@heimgewebe/metarepo /link-epic EPIC-123
```

## Running Examples

To try these examples:

```bash
# 1. Start Heimgeist
npm run serve

# 2. Submit events via API
curl -X POST http://localhost:3000/heimgeist/events \
  -H "Content-Type: application/json" \
  -d '{"type":"pr.opened","source":"github","payload":{"pr":142}}'

# 3. Check insights
heimgeist insights --severity high
```
