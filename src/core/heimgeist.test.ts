import { Heimgeist, createHeimgeist } from './heimgeist';
import { AutonomyLevel, HeimgeistRole, RiskSeverity, EventType, ChronikEvent } from '../types';
import { Logger } from './logger';

class MockLogger implements Logger {
  log = jest.fn();
  warn = jest.fn();
  error = jest.fn();
}

describe('Heimgeist', () => {
  let heimgeist: Heimgeist;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockLogger = new MockLogger();
    heimgeist = createHeimgeist(undefined, mockLogger);
  });

  describe('status', () => {
    it('should return initial status', () => {
      const status = heimgeist.getStatus();

      expect(status.version).toBe('1.0.0');
      expect(status.autonomyLevel).toBe(AutonomyLevel.Warning);
      expect(status.activeRoles).toContain(HeimgeistRole.Observer);
      expect(status.activeRoles).toContain(HeimgeistRole.Critic);
      expect(status.activeRoles).toContain(HeimgeistRole.Director);
      expect(status.activeRoles).toContain(HeimgeistRole.Archivist);
      expect(status.eventsProcessed).toBe(0);
      expect(status.insightsGenerated).toBe(0);
      expect(status.actionsExecuted).toBe(0);
    });

    it('should track uptime', () => {
      const status = heimgeist.getStatus();
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('configuration', () => {
    it('should return current configuration', () => {
      const config = heimgeist.getConfig();

      expect(config.autonomyLevel).toBe(AutonomyLevel.Warning);
      expect(config.activeRoles.length).toBe(4);
      expect(config.policies.length).toBeGreaterThan(0);
    });

    it('should allow changing autonomy level', () => {
      heimgeist.setAutonomyLevel(AutonomyLevel.Operative);
      expect(heimgeist.getConfig().autonomyLevel).toBe(AutonomyLevel.Operative);

      heimgeist.setAutonomyLevel(AutonomyLevel.Passive);
      expect(heimgeist.getConfig().autonomyLevel).toBe(AutonomyLevel.Passive);
    });

    it('should protect internal configuration from external mutation', () => {
      const config = heimgeist.getConfig();

      config.activeRoles.push(HeimgeistRole.Observer);
      config.policies[0].name = 'mutated-policy';

      const freshConfig = heimgeist.getConfig();

      expect(freshConfig.activeRoles.length).toBe(4);
      expect(freshConfig.policies[0].name).not.toBe('mutated-policy');
    });
  });

  describe('event processing', () => {
    it('should process CI failure events', async () => {
      const event: ChronikEvent = {
        id: 'test-event-1',
        type: EventType.CIResult,
        timestamp: new Date(),
        source: 'github-actions',
        payload: { status: 'failed', workflow: 'build' },
      };

      const insights = await heimgeist.processEvent(event);

      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].role).toBe(HeimgeistRole.Observer);
      expect(insights[0].type).toBe('risk');
      expect(insights[0].title).toContain('CI Build Failed');
    });

    it('should process deployment failure events', async () => {
      const event: ChronikEvent = {
        id: 'test-event-2',
        type: EventType.DeployFailed,
        timestamp: new Date(),
        source: 'kubernetes',
        payload: { cluster: 'production', reason: 'image pull failed' },
      };

      const insights = await heimgeist.processEvent(event);

      expect(insights.length).toBeGreaterThan(0);
      const deployInsight = insights.find((i) => i.title === 'Deployment Failed');
      expect(deployInsight).toBeDefined();
      expect(deployInsight?.severity).toBe(RiskSeverity.High);
    });

    it('should process incident detection events', async () => {
      const event: ChronikEvent = {
        id: 'test-event-3',
        type: EventType.IncidentDetected,
        timestamp: new Date(),
        source: 'monitoring',
        payload: { description: 'Database connection timeout' },
      };

      const insights = await heimgeist.processEvent(event);

      const incidentInsight = insights.find((i) => i.title === 'Incident Detected');
      expect(incidentInsight).toBeDefined();
      expect(incidentInsight?.severity).toBe(RiskSeverity.Critical);
    });

    it('should track processed events count', async () => {
      const event: ChronikEvent = {
        id: 'test-event-4',
        type: EventType.Custom,
        timestamp: new Date(),
        source: 'test',
        payload: {},
      };

      await heimgeist.processEvent(event);
      await heimgeist.processEvent({ ...event, id: 'test-event-5' });

      const status = heimgeist.getStatus();
      expect(status.eventsProcessed).toBe(2);
    });

    it('should log to console output', async () => {
      const event: ChronikEvent = {
        id: 'test-event-log',
        type: EventType.CIResult,
        timestamp: new Date(),
        source: 'ci',
        payload: { status: 'failed' },
      };

      await heimgeist.processEvent(event);

      expect(mockLogger.log).toHaveBeenCalled();
    });
  });

  describe('risk assessment', () => {
    it('should return low risk when no issues', () => {
      const assessment = heimgeist.getRiskAssessment();

      expect(assessment.level).toBe(RiskSeverity.Low);
      expect(assessment.reasons).toContain('No significant issues detected');
    });

    it('should return high risk after high-severity event', async () => {
      const event: ChronikEvent = {
        id: 'test-event-6',
        type: EventType.DeployFailed,
        timestamp: new Date(),
        source: 'production',
        payload: {},
      };

      await heimgeist.processEvent(event);
      const assessment = heimgeist.getRiskAssessment();

      expect(assessment.level).toBe(RiskSeverity.High);
    });

    it('should return critical risk after critical event', async () => {
      const event: ChronikEvent = {
        id: 'test-event-7',
        type: EventType.IncidentDetected,
        timestamp: new Date(),
        source: 'alertmanager',
        payload: { description: 'Major outage' },
      };

      await heimgeist.processEvent(event);
      const assessment = heimgeist.getRiskAssessment();

      expect(assessment.level).toBe(RiskSeverity.Critical);
    });

    it('should return medium risk after medium-severity event', async () => {
      const event: ChronikEvent = {
        id: 'test-event-medium',
        type: EventType.CIResult,
        timestamp: new Date(),
        source: 'ci-build',
        payload: { status: 'failed' },
      };

      await heimgeist.processEvent(event);
      const assessment = heimgeist.getRiskAssessment();

      expect(assessment.level).toBe(RiskSeverity.Medium);
      expect(assessment.reasons.some((r) => r.includes('medium-severity'))).toBe(true);
    });
  });

  describe('analysis', () => {
    it('should run analysis and return results', async () => {
      const result = await heimgeist.analyse({ depth: 'quick' });

      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.insights).toBeDefined();
      expect(result.plannedActions).toBeDefined();
    });

    it('should generate summary insight', async () => {
      const result = await heimgeist.analyse({});

      expect(result.insights.length).toBeGreaterThan(0);
      const summaryInsight = result.insights.find((i) => i.title === 'Analysis Summary');
      expect(summaryInsight).toBeDefined();
    });
  });

  describe('explanation', () => {
    it('should explain insights', async () => {
      const event: ChronikEvent = {
        id: 'test-event-8',
        type: EventType.CIResult,
        timestamp: new Date(),
        source: 'ci',
        payload: { status: 'failed' },
      };

      const insights = await heimgeist.processEvent(event);
      const insightId = insights[0].id;

      const explanation = heimgeist.explain({ insightId });

      expect(explanation).toBeDefined();
      expect(explanation?.subject.type).toBe('insight');
      expect(explanation?.subject.id).toBe(insightId);
      expect(explanation?.explanation).toBeDefined();
    });

    it('should return null for unknown IDs', () => {
      const explanation = heimgeist.explain({ insightId: 'unknown-id' });
      expect(explanation).toBeNull();
    });
  });

  describe('planned actions', () => {
    it('should plan actions for critical events', async () => {
      const event: ChronikEvent = {
        id: 'test-event-9',
        type: EventType.IncidentDetected,
        timestamp: new Date(),
        source: 'monitoring',
        payload: { description: 'Critical system failure' },
      };

      await heimgeist.processEvent(event);
      const actions = heimgeist.getPlannedActions();

      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0].requiresConfirmation).toBe(true);
      expect(actions[0].status).toBe('pending');
    });

    it('should approve pending actions', async () => {
      const event: ChronikEvent = {
        id: 'test-event-10',
        type: EventType.IncidentDetected,
        timestamp: new Date(),
        source: 'monitoring',
        payload: {},
      };

      await heimgeist.processEvent(event);
      const actions = heimgeist.getPlannedActions();
      const actionId = actions[0].id;

      const success = heimgeist.approveAction(actionId);

      expect(success).toBe(true);
      expect(heimgeist.getPlannedActions().find((a) => a.id === actionId)?.status).toBe('approved');
    });

    it('should reject pending actions', async () => {
      const event: ChronikEvent = {
        id: 'test-event-11',
        type: EventType.IncidentDetected,
        timestamp: new Date(),
        source: 'monitoring',
        payload: {},
      };

      await heimgeist.processEvent(event);
      const actions = heimgeist.getPlannedActions();
      const actionId = actions[0].id;

      const success = heimgeist.rejectAction(actionId);

      expect(success).toBe(true);
      expect(heimgeist.getPlannedActions().find((a) => a.id === actionId)?.status).toBe('rejected');
    });

    it('should not plan actions at lower autonomy levels', async () => {
      heimgeist.setAutonomyLevel(AutonomyLevel.Observing);

      const event: ChronikEvent = {
        id: 'test-event-12',
        type: EventType.IncidentDetected,
        timestamp: new Date(),
        source: 'monitoring',
        payload: {},
      };

      await heimgeist.processEvent(event);
      const actions = heimgeist.getPlannedActions();

      expect(actions.length).toBe(0);
    });
  });

  describe('insights listing', () => {
    it('should list all insights', async () => {
      const event1: ChronikEvent = {
        id: 'test-event-13',
        type: EventType.CIResult,
        timestamp: new Date(),
        source: 'ci-1',
        payload: { status: 'failed' },
      };

      const event2: ChronikEvent = {
        id: 'test-event-14',
        type: EventType.DeployFailed,
        timestamp: new Date(),
        source: 'deploy-1',
        payload: {},
      };

      await heimgeist.processEvent(event1);
      await heimgeist.processEvent(event2);

      const insights = heimgeist.getInsights();

      expect(insights.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('createHeimgeist', () => {
  it('should create a new Heimgeist instance', () => {
    const hg = createHeimgeist();
    expect(hg).toBeInstanceOf(Heimgeist);
  });

  it('should accept custom configuration', () => {
    const hg = createHeimgeist({
      autonomyLevel: AutonomyLevel.Operative,
      activeRoles: [HeimgeistRole.Observer],
      policies: [],
      eventSources: [],
      outputs: [],
    });

    const config = hg.getConfig();
    expect(config.autonomyLevel).toBe(AutonomyLevel.Operative);
    expect(config.activeRoles).toEqual([HeimgeistRole.Observer]);
  });
});
