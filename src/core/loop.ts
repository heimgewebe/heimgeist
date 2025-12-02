import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { setTimeout } from 'timers/promises';
import {
  ChronikEvent,
  EventType,
  Insight,
  HeimgeistRole,
  RiskSeverity,
  PlannedAction,
  AutonomyLevel,
  ChronikClient,
} from '../types';
import { STATE_DIR, INSIGHTS_DIR, ACTIONS_DIR } from '../config/state-paths';

// Type definitions for event payloads and context
interface EventContext {
  history?: unknown[];
  repo?: string;
  branch?: string;
  [key: string]: unknown;
}

interface CIResultPayload {
  pipeline_id?: string;
  repo?: string;
  branch?: string;
  status?: string;
  trigger?: string;
  [key: string]: unknown;
}

// Ensure state directories exist
async function ensureStateDirs() {
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.mkdir(INSIGHTS_DIR, { recursive: true });
  await fs.mkdir(ACTIONS_DIR, { recursive: true });
}

// Re-export ChronikClient for backward compatibility if needed,
// though it is preferred to import from types
export { ChronikClient };

export class HeimgeistCoreLoop {
  private running = false;
  private chronik: ChronikClient;
  private autonomyLevel: AutonomyLevel;

  constructor(chronik: ChronikClient, autonomyLevel: AutonomyLevel = AutonomyLevel.Warning) {
    this.chronik = chronik;
    this.autonomyLevel = autonomyLevel;
  }

  async start() {
    this.running = true;
    await ensureStateDirs();
    console.log('Heimgeist Core Loop started.');

    while (this.running) {
      try {
        await this.tick();
        // Sleep a bit to avoid tight loop in this mock
        await setTimeout(1000);
      } catch (error) {
        console.error('Error in Core Loop tick:', error);
      }
    }
  }

  stop() {
    this.running = false;
    console.log('Heimgeist Core Loop stopping...');
  }

  async tick() {
    // 1. Pull
    const event = await this.chronik.nextEvent([
      EventType.CIResult,
      EventType.PROpened,
      EventType.PRMerged,
    ]);

    if (!event) {
      return;
    }

    console.log(`Processing event: ${event.type} (${event.id})`);

    // 2. Context (Placeholder)
    const context = await this.buildContext(event);

    // 3. Risk Assessment
    const risk = this.assessRisk(event, context);

    // 4. Generate Insights
    const insights = this.deriveInsights(event, context, risk);

    // 5. Propose Actions
    const actions = this.proposeActions(event, context, risk, insights);

    // 6. Persist & Event
    await this.persistInsights(insights);
    await this.persistActions(actions);

    // 7. Execute Safe Actions (if allowed)
    if (this.autonomyLevel >= AutonomyLevel.Warning) {
       // Filter for safe actions and execute (simulated)
       // For now, we just log them
       for (const action of actions) {
         if (this.isSafeAction(action)) {
             console.log(`[Auto-Exec] Executing safe action: ${action.id}`);
             // Logic to execute would go here
         }
       }
    }
  }

  private async buildContext(_event: ChronikEvent): Promise<EventContext> {
    // Placeholder for fetching context from semantAH or history
    return {
        // e.g. history of this repo/branch
    };
  }

  private assessRisk(event: ChronikEvent, _context: EventContext): { level: RiskSeverity; reasons: string[] } {
    const payload = event.payload as CIResultPayload;

    // Heuristic: CI Failure on main
    if (event.type === EventType.CIResult && payload.status === 'failed' && payload.branch === 'main') {
      return {
        level: RiskSeverity.Critical,
        reasons: ['CI failure on main branch - immediate attention required'],
      };
    }

    // Heuristic: CI Failure on PR
    if (event.type === EventType.CIResult && payload.status === 'failed' && payload.trigger === 'pr') {
        return {
            level: RiskSeverity.High,
            reasons: ['CI failure on PR'],
        };
    }

    return {
      level: RiskSeverity.Low,
      reasons: [],
    };
  }

  private deriveInsights(
    event: ChronikEvent,
    context: EventContext,
    risk: { level: RiskSeverity; reasons: string[] }
  ): Insight[] {
    const insights: Insight[] = [];

    if (risk.level === RiskSeverity.Critical || risk.level === RiskSeverity.High) {
      insights.push({
        id: uuidv4(),
        timestamp: new Date(),
        role: HeimgeistRole.Critic,
        type: 'risk',
        severity: risk.level,
        title: `Detected ${risk.level} risk from ${event.type}`,
        description: risk.reasons.join('; '),
        source: event,
        context: context,
      });
    }

    return insights;
  }

  private proposeActions(
    event: ChronikEvent,
    context: EventContext,
    risk: { level: RiskSeverity; reasons: string[] },
    insights: Insight[]
  ): PlannedAction[] {
    const actions: PlannedAction[] = [];
    const payload = event.payload as CIResultPayload;

    for (const insight of insights) {
      if (insight.severity === RiskSeverity.Critical) {
        // Specific logic for CI failure on main
        if (event.type === EventType.CIResult && payload.branch === 'main') {
             actions.push({
                id: uuidv4(),
                timestamp: new Date(),
                trigger: insight,
                status: 'pending', // Pending approval unless autonomy is high enough
                requiresConfirmation: this.autonomyLevel < AutonomyLevel.Operative,
                steps: [
                    {
                        order: 1,
                        tool: 'wgx',
                        parameters: { command: 'guard', target: payload.repo },
                        description: 'Run wgx guard to diagnose failure',
                        status: 'pending'
                    }
                ]
             });
        }
      }
    }

    return actions;
  }

  private async persistInsights(insights: Insight[]) {
    for (const insight of insights) {
      const filepath = path.join(INSIGHTS_DIR, `${insight.id}.json`);
      await fs.writeFile(filepath, JSON.stringify(insight, null, 2));
      console.log(`[Insight] Saved to ${filepath}`);

      // Also send back to chronik
      await this.chronik.append({
          type: EventType.HeimgeistInsight,
          payload: { insight }
      });
    }
  }

  private async persistActions(actions: PlannedAction[]) {
    for (const action of actions) {
        const filepath = path.join(ACTIONS_DIR, `${action.id}.json`);
        await fs.writeFile(filepath, JSON.stringify(action, null, 2));
        console.log(`[Action] Saved to ${filepath}`);

        await this.chronik.append({
            type: EventType.HeimgeistActions,
            payload: { action }
        });
    }
  }

  private isSafeAction(_action: PlannedAction): boolean {
      // Define what is "safe" (non-destructive)
      // e.g., triggering analysis is safe.
      // blocking merges is safe (but intrusive).
      // reverting commits is NOT safe without high autonomy.

      // For this v1, nothing is automatically "executed" in a real sense,
      // but we might mark it as 'executed' if we had the tool integration.
      return false;
  }
}
