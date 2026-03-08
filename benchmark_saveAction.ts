import { Heimgeist, createHeimgeist } from './src/core/heimgeist';
import { AutonomyLevel, HeimgeistRole, EventType, PlannedAction, RiskSeverity } from './src/types';
import * as fs from 'fs';
import * as path from 'path';

async function benchmark() {
  const heimgeist = createHeimgeist({
    autonomyLevel: AutonomyLevel.Warning,
    activeRoles: [HeimgeistRole.Observer, HeimgeistRole.Critic, HeimgeistRole.Director, HeimgeistRole.Archivist],
    policies: [],
    eventSources: [],
    outputs: [],
    persistenceEnabled: true,
  });

  const iterations = 1000;

  const action: PlannedAction = {
    id: "test-action-id",
    timestamp: new Date(),
    trigger: {
      id: "trigger-id",
      timestamp: new Date(),
      role: HeimgeistRole.Critic,
      type: "risk",
      severity: RiskSeverity.Medium,
      title: "Test risk",
      description: "Test description"
    },
    steps: [{
      order: 1,
      tool: "test-tool",
      parameters: {},
      description: "Test step",
      status: "pending"
    }],
    requiresConfirmation: false,
    status: "approved"
  };

  const start = process.hrtime.bigint();

  for (let i = 0; i < iterations; i++) {
    action.id = `test-action-id-${i}`;
    await heimgeist.saveAction(action);
  }

  const end = process.hrtime.bigint();
  const timeTakenMs = Number(end - start) / 1000000;

  console.log(`Executed ${iterations} iterations.`);
  console.log(`Total time: ${timeTakenMs.toFixed(2)}ms`);
  console.log(`Time per iteration: ${(timeTakenMs / iterations).toFixed(2)}ms`);

  // Cleanup
  for (let i = 0; i < iterations; i++) {
    const file = path.join('./heimgeist_state/actions', `test-action-id-${i}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

benchmark().catch(console.error);
