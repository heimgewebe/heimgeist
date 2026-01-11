import { setTimeout } from 'timers/promises';
import {
  EventType,
  AutonomyLevel,
  ChronikClient,
} from '../types';
import { Heimgeist, createHeimgeist } from './heimgeist';
import { loadConfig } from '../config';
import { defaultLogger, Logger } from './logger';

// Re-export ChronikClient for backward compatibility if needed,
// though it is preferred to import from types
export { ChronikClient };

export class HeimgeistCoreLoop {
  private running = false;
  private chronik: ChronikClient;
  private heimgeist: Heimgeist;
  private logger: Logger;

  constructor(chronik: ChronikClient, autonomyLevel: AutonomyLevel = AutonomyLevel.Warning) {
    this.chronik = chronik;
    this.logger = defaultLogger;

    const config = loadConfig();
    // Override autonomy level with CLI arg
    config.autonomyLevel = autonomyLevel;

    // Create a Heimgeist instance to act as the single source of truth for logic and state
    this.heimgeist = createHeimgeist(config, this.logger, this.chronik);
  }

  async start() {
    this.running = true;
    this.logger.log('Heimgeist Core Loop started.');

    while (this.running) {
      try {
        await this.tick();
        // Sleep a bit to avoid tight loop in this mock
        await setTimeout(1000);
      } catch (error) {
        // Safe to use toString on unknown here
        this.logger.error(`Error in Core Loop tick: ${error}`);
      }
    }
  }

  stop() {
    this.running = false;
    this.logger.log('Heimgeist Core Loop stopping...');
  }

  async tick() {
    // 0. Meta-Cognitive Update
    // Fetch signals (mocked for now, in real impl would come from HausKI/Metrics)
    // "vor Analyse: self_model.update(signals)"
    const mockSignals = {
        // Simple mock: stable load to prevent self-state noise
        cpu_load: 20,
        memory_pressure: 40,
        // We could calculate failure rate from heimgeist stats if exposed
    };
    this.heimgeist.updateSelfModel(mockSignals);

    // 1. Pull
    const event = await this.chronik.nextEvent([
      EventType.Command, // Added Command
      EventType.CIResult,
      EventType.PROpened,
      EventType.PRMerged,
      EventType.DeployFailed,
      EventType.IncidentDetected,
      EventType.KnowledgeObservatoryPublished,
    ]);

    if (event) {
      this.logger.log(`Processing event: ${event.type} (${event.id})`);

      // 2. Delegate processing to Heimgeist Core
      // This handles Context, Risk Assessment, Insights, Actions, and Persistence
      const insights = await this.heimgeist.processEvent(event);

      this.logger.log(`Generated ${insights.length} insights from event.`);
    }

    // 3. Check for auto-execution of actions
    // In a real implementation, we might want to have a separate "Actuator" loop,
    // but for now, we check the planned actions immediately.
    const plannedActions = this.heimgeist.getPlannedActions();

    // Check for actions ready to execute (approved) or pending but auto-approvable
    const actionsToExecute = plannedActions.filter(
        a => a.status === 'approved' || (a.status === 'pending' && !a.requiresConfirmation)
    );

    for (const action of actionsToExecute) {
        this.logger.log(`[Auto-Exec] Executing action: ${action.id} (${action.trigger.title})`);

        // In a real system, we would execute the tool steps here.
        // For simulation, we mark it as executed.
        const success = await this.heimgeist.executeAction(action.id);

        if (!success) {
            this.logger.warn(`Failed to execute action ${action.id}`);
        }
    }
  }
}
