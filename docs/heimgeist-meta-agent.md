# Heimgeist – Der Meta-Agent

**Beobachter, Kritiker, Regisseur und Archivar für das gesamte Heimgewebe-Ökosystem**

## Positionierung

Heimgeist ist **KEIN** weiterer Agent, der Code schreibt oder PRs reviewed.

Heimgeist ist der **Meta-Agent**, der:
- Andere Agenten beobachtet
- Systemweite Muster erkennt
- Tool-Ketten orchestriert
- Wissen archiviert

**Analogie**: Wenn hausKI, wgx und sichter die Organe sind, ist Heimgeist das Nervensystem.

## Die vier Rollen

### 1. Observer (Beobachter)

**Aufgabe**: Liest chronik-Events und extrahiert Kontext

```typescript
// Beispiel: Event-Stream Processing
heimgeist.on('event', async (event) => {
  // Kontext abrufen
  const context = await semantAH.getContext({
    event: event.id,
    depth: 'shallow',
    includeRelated: true
  });
  
  // Beobachtung erstellen
  const observation = {
    event,
    context,
    timestamp: Date.now(),
    metadata: extractMetadata(event, context)
  };
  
  // Zur weiteren Analyse
  await processObservation(observation);
});
```

**Datenquellen**:
- chronik (Events: CI, PR, Deploy, Incident)
- semantAH (Wissensgraph, Embeddings)
- GitHub (PRs, Issues, Commits)
- Monitoring (Metrics, Logs, Traces)

**Output**:
- Strukturierte Beobachtungen
- Zeitstempel und Kontext
- Metadaten für Korrelation

### 2. Critic (Kritiker)

**Aufgabe**: Erkennt Drift, Risiken, Muster und Widersprüche

```typescript
// Beispiel: Drift-Detection
const observations = heimgeist.getRecentObservations({ window: '24h' });

// Repetitive Fehler?
const failurePattern = detectRepetition(observations, {
  type: 'ci.result',
  status: 'failed',
  threshold: 3
});

if (failurePattern) {
  heimgeist.createInsight({
    type: 'pattern',
    severity: 'medium',
    title: 'Repetitive CI Failures',
    description: `${failurePattern.count} failures in ${failurePattern.source}`,
    recommendations: [
      'Investigate root cause',
      'Consider adding monitoring',
      'Document pattern for future reference'
    ]
  });
}

// Risiko-Eskalation?
const highSeverityCount = observations.filter(
  o => o.severity === 'high' || o.severity === 'critical'
).length;

if (highSeverityCount > 2) {
  heimgeist.createInsight({
    type: 'risk',
    severity: 'critical',
    title: 'Multiple High-Severity Issues',
    description: 'System may be destabilizing',
    recommendations: [
      'Halt deployments',
      'Prioritize issues by impact',
      'Coordinate parallel resolution'
    ]
  });
}
```

**Erkennungslogik**:
- **Drift**: Konfiguration weicht von Policy ab
- **Repetition**: Gleicher Fehler mehrfach in kurzer Zeit
- **Correlation**: Mehrere Events zeigen auf ein Problem
- **Anomaly**: Verhalten weicht von Historie ab
- **Policy Violation**: Regel wurde nicht eingehalten

**Output**:
- Insights (Typ: pattern, risk, drift, contradiction, policy_violation)
- Severity-Level (low, medium, high, critical)
- Recommendations (konkrete nächste Schritte)

### 3. Director (Regisseur)

**Aufgabe**: Plant Tool-Ketten und entscheidet, wann gehandelt wird

```typescript
// Beispiel: Action Planning
heimgeist.on('insight', async (insight) => {
  // Bei kritischem Risiko: Action-Chain planen
  if (insight.severity === 'critical') {
    const action = {
      id: uuid(),
      trigger: insight,
      steps: [
        {
          order: 1,
          tool: 'sichter-quick',
          parameters: { target: insight.source },
          description: 'Quick analysis of affected component'
        },
        {
          order: 2,
          tool: 'wgx-guard',
          parameters: { scope: 'affected' },
          description: 'Run guard checks on affected areas'
        },
        {
          order: 3,
          tool: 'report-generate',
          parameters: { format: 'markdown', include: ['insights', 'recommendations'] },
          description: 'Generate incident report'
        }
      ],
      requiresConfirmation: heimgeist.config.autonomyLevel < AutonomyLevel.Operative,
      status: 'pending'
    };
    
    await heimgeist.planAction(action);
  }
});
```

**Entscheidungslogik**:
- **Autonomy Level 0 (Passive)**: Nur dokumentieren, keine Aktionen
- **Autonomy Level 1 (Observing)**: Notizen anlegen, auf Anfrage berichten
- **Autonomy Level 2 (Warning)**: Aktionen vorschlagen, Confirmation nötig
- **Autonomy Level 3 (Operative)**: Aktionen ausführen innerhalb Policy

**Tool-Chains**:
```yaml
# Beispiel: Definierte Tool-Chain für CI-Failure
ci_failure_chain:
  trigger:
    event_type: ci.result
    status: failed
    repetition: >= 2
  steps:
    - tool: sichter
      command: /deep
      params:
        target: $source
        focus: [logs, recent_changes]
    - tool: semantAH
      command: similar
      params:
        event: $event_id
        limit: 5
    - tool: heimgeist
      command: synthesize
      params:
        inputs: [sichter_result, semantAH_result]
        output: recommendation
    - tool: wgx
      command: /guard
      params:
        scope: affected
      conditional: recommendation.includes('run_guards')
```

### 4. Archivist (Archivar)

**Aufgabe**: Schreibt Erkenntnisse zurück ins System

```typescript
// Beispiel: Archivierung
async function archive(insights: Insight[]) {
  for (const insight of insights) {
    // 1. Zu chronik als Event
    await chronik.write({
      type: 'heimgeist.insight.v1',
      payload: {
        insight_id: insight.id,
        role: insight.role,
        type: insight.type,
        severity: insight.severity,
        title: insight.title,
        description: insight.description,
        recommendations: insight.recommendations
      },
      metadata: {
        source_event: insight.source?.id
      }
    });
    
    // 2. Zu semantAH als Knoten
    await semantAH.addNode({
      type: 'insight',
      id: insight.id,
      properties: {
        severity: insight.severity,
        title: insight.title
      }
    });
    
    // 3. Kante zu Quell-Event
    if (insight.source) {
      await semantAH.addEdge({
        from: insight.id,
        to: insight.source.id,
        type: 'derived_from'
      });
    }
    
    // 4. Bei Pattern: zu heimlern
    if (insight.type === 'pattern') {
      await heimlern.recordPattern({
        pattern_type: insight.severity === 'high' ? 'bad' : 'good',
        description: insight.description,
        examples: [insight.source?.id],
        recommendation: insight.recommendations?.[0]
      });
    }
  }
}
```

**Ziele**:
- chronik: Vollständige Audit-Trail
- semantAH: Wissensgraph für Kontext-Retrieval
- heimlern: Pattern-DB für Learning-Loops
- leitstand: Real-time Dashboard-Updates

## Autonomy Levels im Detail

### Level 0: Passive

```yaml
behavior:
  observe: yes
  critique: no
  direct: no
  archive: yes (nur Observations)
  
use_case: "Initial Setup, Testing, Debugging"
```

Heimgeist **reagiert nur auf direkte Anfragen**:
- `heimgeist status` → Zeigt Zustand
- `heimgeist analyse` → Führt Analyse durch
- Keine proaktiven Aktionen

### Level 1: Observing

```yaml
behavior:
  observe: yes
  critique: yes (intern)
  direct: no
  archive: yes (Observations + Insights)
  
use_case: "Learning Phase, Low-Risk Repos"
```

Heimgeist **notiert Probleme**, pingt aber nur wenn explizit gefragt:
- Events werden analysiert
- Insights werden erstellt
- Keine automatischen Kommentare/Aktionen
- Nur auf `heimgeist insights` sichtbar

### Level 2: Warning (Default)

```yaml
behavior:
  observe: yes
  critique: yes
  direct: yes (mit Confirmation)
  archive: yes (alles)
  
use_case: "Production, Standard Workflows"
```

Heimgeist **analysiert proaktiv** und schlägt Aktionen vor:
- Kommentiert auf PRs mit Warnungen
- Plant Actions, braucht aber Approval
- Schreibt Reports nach chronik
- Benachrichtigt bei kritischen Insights

**Beispiel**:
```
[Heimgeist] ⚠️  High-Risk PR Detected

This PR modifies the authentication layer, which was involved in 3 
recent incidents. 

Recommended actions:
1. Run guard checks: @heimgewebe/wgx /guard auth
2. Deep review: @heimgewebe/sichter /deep
3. Compare with PR #42 (similar changes)

React with 👍 to approve these actions.
```

### Level 3: Operative

```yaml
behavior:
  observe: yes
  critique: yes
  direct: yes (automatisch innerhalb Policy)
  archive: yes (alles)
  
use_case: "Mature Systems, Well-Defined Policies"
```

Heimgeist **führt Aktionen automatisch aus** innerhalb definierter Grenzen:
- Startet Guards/Smoke-Tests bei Risiko-PRs
- Triggert Deep-Analyses bei Anomalien
- Generiert Reports automatisch
- **KEINE** destruktiven Operationen (merge, revert, deploy)

**Grenzen**:
- ✅ Analyse-Tools starten (sichter, wgx)
- ✅ Reports generieren
- ✅ Kommentare schreiben
- ✅ Labels setzen (wenn Policy erlaubt)
- ❌ Code ändern
- ❌ PRs mergen
- ❌ Deployments starten
- ❌ Datenbank-Migrationen

## Event-orientierte Architektur

Heimgeist ist **host-unabhängig** durch Events:

```typescript
// Heimgeist-Core ist agnostisch
class Heimgeist {
  async processEvent(event: ChronikEvent): Promise<Insight[]> {
    // Logik hängt nicht von GitHub API ab
    const insights = await this.analyze(event);
    return insights;
  }
}

// Adapter für GitHub
class GitHubAdapter {
  async onPRComment(comment: GitHubComment) {
    // Übersetze zu Event
    const event = {
      type: 'heimgewebe.command.v1',
      payload: parseComment(comment)
    };
    
    // Sende an Heimgeist
    const insights = await heimgeist.processEvent(event);
    
    // Übersetze zurück zu GitHub
    await this.postComment(insights);
  }
}

// Adapter für Forgejo (Zukunft)
class ForgejoAdapter {
  async onPRComment(comment: ForgejoComment) {
    // Gleiche Event-Struktur
    const event = {
      type: 'heimgewebe.command.v1',
      payload: parseComment(comment)
    };
    
    const insights = await heimgeist.processEvent(event);
    await this.postComment(insights);
  }
}
```

## Risiko-Perspektive

Heimgeist denkt **immer in Risiken, Annahmen und Alternativen**:

```typescript
// Jede Empfehlung enthält:
interface Recommendation {
  action: string;                    // Was tun
  rationale: string;                 // Warum
  risks: string[];                   // Was könnte schiefgehen
  assumptions: string[];             // Wovon gehen wir aus
  alternatives: Alternative[];       // Was sonst noch möglich ist
  confidence: number;                // Wie sicher sind wir (0-1)
}

// Beispiel
const recommendation = {
  action: "Run guard checks on authentication layer",
  rationale: "This PR modifies auth code similar to 3 previous incidents",
  risks: [
    "Guard checks might take 10+ minutes",
    "False positives could block valid changes"
  ],
  assumptions: [
    "Auth layer is critical path",
    "Historical pattern is still relevant"
  ],
  alternatives: [
    {
      action: "Manual review by security team",
      pros: ["More thorough", "Fewer false positives"],
      cons: ["Slower", "Requires human availability"]
    },
    {
      action: "Smoke test in staging first",
      pros: ["Tests real integration"],
      cons: ["Requires staging deployment"]
    }
  ],
  confidence: 0.75
};
```

## Integration mit anderen Komponenten

### Mit chronik
- **Input**: Events (CI, PR, Deploy, Incident)
- **Output**: Insights, Actions, Reports als Events

### Mit semantAH
- **Input**: Kontext, ähnliche Events, Wissensgraph
- **Output**: Neue Knoten (Insights), neue Kanten (Kausalität)

### Mit sichter
- **Delegation**: "Analysiere diesen PR tiefergehend"
- **Feedback**: Nutzt sichter-Reports für eigene Bewertung

### Mit wgx
- **Delegation**: "Führe Guard-Checks aus"
- **Feedback**: Nutzt Guard-Ergebnisse für Risiko-Assessment

### Mit hausKI
- **Delegation**: "Führe lokale Aktion X aus"
- **Feedback**: Nutzt Execution-Status

### Mit heimlern
- **Output**: Patterns (good/bad) für Learning-Loops
- **Input**: Historische Patterns für Mustererkennung

## Praktische Nutzung

### CLI

```bash
# Status abrufen
heimgeist status

# Risiko-Assessment
heimgeist risk

# Analyse anstoßen
heimgeist analyse --target repo:heimgewebe/metarepo --depth deep

# Insights anzeigen
heimgeist insights --severity critical

# Geplante Aktionen
heimgeist actions --pending

# Aktion genehmigen
heimgeist approve action-uuid-123

# Erklärung
heimgeist why insight-uuid-456
```

### API

```bash
# Status
curl http://localhost:3000/heimgeist/status

# Event submitten
curl -X POST http://localhost:3000/heimgeist/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "ci.result",
    "source": "github-actions",
    "payload": { "status": "failed" }
  }'

# Insights
curl http://localhost:3000/heimgeist/insights?severity=high

# Actions
curl http://localhost:3000/heimgeist/actions?status=pending
```

### Als Library

```typescript
import { createHeimgeist } from 'heimgeist';

const heimgeist = createHeimgeist({
  autonomyLevel: AutonomyLevel.Warning,
  activeRoles: ['observer', 'critic', 'director', 'archivist']
});

// Event-Processing
heimgeist.on('event', async (event) => {
  const insights = await heimgeist.processEvent(event);
  console.log(`Generated ${insights.length} insights`);
});

// Periodische Analyse
setInterval(async () => {
  const risk = heimgeist.getRiskAssessment();
  if (risk.level === 'critical') {
    await notifyTeam(risk);
  }
}, 60000); // Jede Minute
```

## Zusammenfassung

Heimgeist ist:

✅ **Meta-Agent**: Orchestriert andere Agenten
✅ **Event-Driven**: Host-unabhängig über chronik
✅ **Risk-Aware**: Denkt in Risiken, Annahmen, Alternativen
✅ **Learning-Oriented**: Archiviert Wissen für Zukunft
✅ **Graduell Autonom**: Level 0-3 mit klaren Grenzen
✅ **Transparent**: Jede Entscheidung nachvollziehbar

Heimgeist ist NICHT:

❌ Ein Code-Generator
❌ Ein PR-Reviewer
❌ Ein Deployment-Tool
❌ Ein Allzweck-AI-Assistant

**Heimgeist ist das Nervensystem des Heimgewebe-Organismus.**
