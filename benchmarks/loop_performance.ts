
import { HeimgeistCoreLoop } from '../src/core/loop';
import { MockChronikClient } from '../src/core/chronik-mock';
import { AutonomyLevel, HeimgeistRole, RiskSeverity, PlannedAction } from '../src/types';
import { Heimgeist } from '../src/core/heimgeist';

class BenchmarkLoop extends HeimgeistCoreLoop {
    public async runTick() {
        return await this.tick();
    }

    public getHeimgeist(): Heimgeist {
        return (this as any).heimgeist;
    }
}

async function runBenchmark() {
    console.log("Setting up benchmark...");
    const chronik = new MockChronikClient();
    const loop = new BenchmarkLoop(chronik, AutonomyLevel.Operative);
    const heimgeist = loop.getHeimgeist();

    const ACTION_COUNT = 10;
    const DELAY_MS = 100;

    // Mock executeAction with a delay
    heimgeist.executeAction = async (id: string) => {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        return true;
    };

    // Mock other slow things
    heimgeist.refreshState = () => { /* console.log("[Bench] refreshState skipped"); */ };
    heimgeist.updateSelfModel = async () => { /* console.log("[Bench] updateSelfModel skipped"); */ };

    // Mock getPlannedActions to return ACTION_COUNT approved actions
    const mockActions: PlannedAction[] = [];
    for (let i = 0; i < ACTION_COUNT; i++) {
        mockActions.push({
            id: `action-${i}`,
            timestamp: new Date(),
            trigger: {
                id: `trigger-${i}`,
                timestamp: new Date(),
                role: HeimgeistRole.Critic,
                type: 'risk',
                severity: RiskSeverity.High,
                title: `Mock Risk ${i}`,
                description: `Mock Description ${i}`
            },
            steps: [],
            requiresConfirmation: false,
            status: 'approved'
        });
    }

    heimgeist.getPlannedActions = () => mockActions;

    console.log(`Running benchmark with ${ACTION_COUNT} actions, each taking ~${DELAY_MS}ms...`);

    const start = performance.now();
    await loop.runTick();
    const end = performance.now();

    const duration = end - start;
    console.log(`Tick duration: ${duration.toFixed(2)}ms`);

    process.exit(0);
}

runBenchmark().catch(err => {
    console.error(err);
    process.exit(1);
});
