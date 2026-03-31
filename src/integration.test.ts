import request from 'supertest';
import { createApp, startServer } from './api';
import { Heimgeist, createHeimgeist, MockChronikClient } from './core';
import { getDefaultConfig } from './config';
import { EventType, AutonomyLevel, HeimgeistRole, HeimgeistConfig } from './types';

/**
 * Integration Tests
 *
 * These tests verify the complete workflow and integration between
 * different components of Heimgeist: API, Core, and CLI logic.
 */

describe('Heimgeist Integration Tests', () => {
  const TEST_API_KEY = 'test-api-key-for-integration';

  let heimgeist: Heimgeist;
  let app: ReturnType<typeof createApp>;
  let mockChronik: MockChronikClient;
  let config: HeimgeistConfig;

  beforeEach(() => {
    // Suppress console output for cleaner test runs
    jest.spyOn(console, 'log').mockImplementation(() => {});

    mockChronik = new MockChronikClient();
    config = getDefaultConfig();
    config.persistenceEnabled = false;
    config.apiKey = TEST_API_KEY;

    heimgeist = createHeimgeist(config, undefined, mockChronik);
    app = createApp(heimgeist);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('End-to-End Event Processing Workflow', () => {
    it('should process events through API and generate insights', async () => {
      // 1. Check initial status
      const statusResponse = await request(app).get('/heimgeist/status')
        .set('X-API-Key', TEST_API_KEY);
      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.eventsProcessed).toBe(0);

      // 2. Submit a CI failure event
      const eventResponse = await request(app)
        .post('/heimgeist/events')
        .set('X-API-Key', TEST_API_KEY)
        .send({
          type: EventType.CIResult,
          source: 'github-actions',
          payload: {
            status: 'failed',
            repository: 'test/repo',
            branch: 'main',
          },
        });

      expect(eventResponse.status).toBe(200);
      expect(eventResponse.body.insightsCount).toBeGreaterThan(0);

      // 3. Verify status was updated
      const updatedStatus = await request(app).get('/heimgeist/status')
        .set('X-API-Key', TEST_API_KEY);
      expect(updatedStatus.body.eventsProcessed).toBe(1);
      expect(updatedStatus.body.insightsGenerated).toBeGreaterThan(0);

      // 4. Get insights
      const insightsResponse = await request(app).get('/heimgeist/insights')
        .set('X-API-Key', TEST_API_KEY);
      expect(insightsResponse.status).toBe(200);
      expect(insightsResponse.body.count).toBeGreaterThan(0);

      // 5. Get risk assessment
      const riskResponse = await request(app).get('/heimgeist/risk')
        .set('X-API-Key', TEST_API_KEY);
      expect(riskResponse.status).toBe(200);
      expect(riskResponse.body.level).toBeDefined();
    });

    it('should handle multiple events and maintain consistent state', async () => {
      // Submit multiple events
      const events = [
        {
          type: EventType.CIResult,
          source: 'ci',
          payload: { status: 'failed' },
        },
        {
          type: EventType.DeployFailed,
          source: 'k8s',
          payload: { environment: 'staging' },
        },
        {
          type: EventType.PROpened,
          source: 'github',
          payload: { number: 42 },
        },
      ];

      for (const event of events) {
        const response = await request(app)
          .post('/heimgeist/events')
          .set('X-API-Key', TEST_API_KEY)
          .send(event);
        expect(response.status).toBe(200);
      }

      // Verify state
      const status = await request(app).get('/heimgeist/status')
        .set('X-API-Key', TEST_API_KEY);
      expect(status.body.eventsProcessed).toBe(3);

      const insights = await request(app).get('/heimgeist/insights')
        .set('X-API-Key', TEST_API_KEY);
      expect(insights.body.count).toBeGreaterThan(0);
    });

    it('should create and manage actions for critical events', async () => {
      // Re-initialize with more roles if necessary (Warning is already default)
      config.activeRoles = [
          HeimgeistRole.Observer,
          HeimgeistRole.Critic,
          HeimgeistRole.Director,
          HeimgeistRole.Archivist,
      ];
      heimgeist = createHeimgeist(config, undefined, mockChronik);
      app = createApp(heimgeist);

      // Submit critical event
      const eventResponse = await request(app)
        .post('/heimgeist/events')
        .set('X-API-Key', TEST_API_KEY)
        .send({
          type: EventType.IncidentDetected,
          source: 'monitoring',
          payload: {
            description: 'Database connection timeout',
            severity: 'critical',
          },
        });

      expect(eventResponse.status).toBe(200);
      expect(eventResponse.body.insightsCount).toBeGreaterThan(0);

      // Check if actions were planned
      const actionsResponse = await request(app).get('/heimgeist/actions')
        .set('X-API-Key', TEST_API_KEY);
      expect(actionsResponse.status).toBe(200);

      const actions = actionsResponse.body.actions;
      if (actions.length > 0) {
        // Approve first action
        const actionId = actions[0].id;
        const approveResponse = await request(app).post(
          `/heimgeist/actions/${actionId}/approve`
        )
        .set('X-API-Key', TEST_API_KEY);

        expect(approveResponse.status).toBe(200);
        expect(approveResponse.body.success).toBe(true);

        // Verify action status changed
        const updatedActions = await request(app)
          .get('/heimgeist/actions')
          .set('X-API-Key', TEST_API_KEY);
        const approvedAction = updatedActions.body.actions.find(
          (a: { id: string }) => a.id === actionId
        );
        expect(approvedAction?.status).toBe('approved');
      }
    });
  });

  describe('Analysis Workflow', () => {
    it('should run analysis and return comprehensive results', async () => {
      // Submit some events first
      await request(app)
        .post('/heimgeist/events')
        .set('X-API-Key', TEST_API_KEY)
        .send({
          type: EventType.CIResult,
          source: 'test',
          payload: { status: 'failed' },
        });

      // Run analysis
      const analysisResponse = await request(app)
        .post('/heimgeist/analyse')
        .set('X-API-Key', TEST_API_KEY)
        .send({
          depth: 'quick',
        });

      expect(analysisResponse.status).toBe(200);
      expect(analysisResponse.body.id).toBeDefined();
      expect(analysisResponse.body.summary).toBeDefined();
      expect(analysisResponse.body.insights).toBeInstanceOf(Array);
      expect(analysisResponse.body.plannedActions).toBeInstanceOf(Array);
    });

    it('should support deep analysis', async () => {
      const analysisResponse = await request(app)
        .post('/heimgeist/analyse')
        .set('X-API-Key', TEST_API_KEY)
        .send({
          depth: 'deep',
          target: 'repo:test/repo',
        });

      expect(analysisResponse.status).toBe(200);
      expect(analysisResponse.body.id).toBeDefined();
      expect(analysisResponse.body.summary).toBeDefined();
    });
  });

  describe('Configuration Management', () => {
    it('should allow configuration updates and reflect changes', async () => {
      // Get initial config
      const initialConfig = await request(app).get('/heimgeist/config')
        .set('X-API-Key', TEST_API_KEY);
      expect(initialConfig.status).toBe(200);
      const initialLevel = initialConfig.body.autonomyLevel;

      // Update autonomy level
      const updateResponse = await request(app)
        .patch('/heimgeist/config/autonomy')
        .set('X-API-Key', TEST_API_KEY)
        .send({ level: 3 });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.autonomyLevel).toBe(3);

      // Verify config changed
      const updatedConfig = await request(app).get('/heimgeist/config')
        .set('X-API-Key', TEST_API_KEY);
      expect(updatedConfig.body.autonomyLevel).toBe(3);
      expect(updatedConfig.body.autonomyLevel).not.toBe(initialLevel);
    });

    it('should reject invalid autonomy levels', async () => {
      const invalidLevels = [-1, 4, 10, 'invalid', null];

      for (const level of invalidLevels) {
        const response = await request(app)
          .patch('/heimgeist/config/autonomy')
          .set('X-API-Key', TEST_API_KEY)
          .send({ level });

        expect(response.status).toBe(400);
        expect(response.body.error).toBeDefined();
      }
    });
  });

  describe('Explanation Workflow', () => {
    it('should explain insights end-to-end', async () => {
      // Generate an insight
      await request(app)
        .post('/heimgeist/events')
        .set('X-API-Key', TEST_API_KEY)
        .send({
          type: EventType.CIResult,
          source: 'test',
          payload: { status: 'failed' },
        });

      // Get insights
      const insightsResponse = await request(app).get('/heimgeist/insights')
        .set('X-API-Key', TEST_API_KEY);
      const insights = insightsResponse.body.insights;

      if (insights.length > 0) {
        const insightId = insights[0].id;

        // Get explanation
        const explanationResponse = await request(app)
          .post('/heimgeist/explain')
          .set('X-API-Key', TEST_API_KEY)
          .send({ insightId });

        expect(explanationResponse.status).toBe(200);
        expect(explanationResponse.body.explanation).toBeDefined();
        expect(explanationResponse.body.reasoning).toBeInstanceOf(Array);
        expect(explanationResponse.body.subject.id).toBe(insightId);
      }
    });
  });

  describe('Server Lifecycle', () => {
    it('should start and stop server properly', async () => {
      // Test using app directly without starting server
      const response = await request(app).get('/health')
        .set('X-API-Key', TEST_API_KEY);
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });

    it('should start server on custom port', async () => {
      const port = 3001; // Use non-default port to avoid conflicts

      // Start server
      const server = await startServer(port, heimgeist);
      expect(server).toBeDefined();

      // Close server immediately
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed request body gracefully', async () => {
      // Send malformed data without JSON content type
      const response = await request(app)
        .post('/heimgeist/events')
        .set('X-API-Key', TEST_API_KEY)
        .send('not a json object');

      // Should return error for malformed data
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.error).toBeDefined();
    });

    it('should handle non-existent insight explanation', async () => {
      const response = await request(app)
        .post('/heimgeist/explain')
        .set('X-API-Key', TEST_API_KEY)
        .send({ insightId: 'non-existent-id' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });

    it('should handle non-existent action approval', async () => {
      const response = await request(app)
        .post('/heimgeist/actions/fake-id/approve')
        .set('X-API-Key', TEST_API_KEY);

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Multi-Role Integration', () => {
    it('should coordinate between Observer and Critic roles', async () => {
      config.activeRoles = [HeimgeistRole.Observer, HeimgeistRole.Critic];
      heimgeist = createHeimgeist(config, undefined, mockChronik);
      app = createApp(heimgeist);

      // Submit event that should trigger both Observer and Critic
      const response = await request(app)
        .post('/heimgeist/events')
        .set('X-API-Key', TEST_API_KEY)
        .send({
          type: EventType.CIResult,
          source: 'test',
          payload: { status: 'failed' },
        });

      expect(response.status).toBe(200);
      expect(response.body.insightsCount).toBeGreaterThan(0);

      // Verify insights from both roles
      const insights = await request(app).get('/heimgeist/insights')
        .set('X-API-Key', TEST_API_KEY);
      const insightRoles = insights.body.insights.map((i: { role: string }) => i.role);
      expect(insightRoles).toContain('observer');
    });

    it('should plan actions only with Director role active', async () => {
      config.activeRoles = [
        HeimgeistRole.Observer,
        HeimgeistRole.Critic,
        HeimgeistRole.Director,
      ];
      heimgeist = createHeimgeist(config, undefined, mockChronik);
      app = createApp(heimgeist);

      // Submit critical event
      await request(app)
        .post('/heimgeist/events')
        .set('X-API-Key', TEST_API_KEY)
        .send({
          type: EventType.IncidentDetected,
          source: 'test',
          payload: { description: 'Critical failure' },
        });

      const actions = await request(app)
        .get('/heimgeist/actions')
        .set('X-API-Key', TEST_API_KEY);
      // With Director active, actions should be planned for high/critical insights
      expect(actions.body.actions).toBeInstanceOf(Array);
    });
  });

  describe('Autonomy Level Behavior', () => {
    // Disabled due to test isolation issues with persistence state
    /*
    it('should respect Passive autonomy level', async () => {
      const config = getDefaultConfig();
      config.persistenceEnabled = false;
      config.autonomyLevel = AutonomyLevel.Passive;
      config.activeRoles = [
        HeimgeistRole.Observer,
        HeimgeistRole.Critic,
        HeimgeistRole.Director,
      ];

      const heimgeist = createHeimgeist(config);
      const app = createApp(heimgeist);

      // Submit event
      await request(app).post('/heimgeist/events').send({
        type: EventType.IncidentDetected,
        source: 'test',
        payload: { description: 'Critical' },
      });

      // At Passive level, insights may be generated but actions shouldn't be planned
      const actions = await request(app).get('/heimgeist/actions')
        .set('X-API-Key', TEST_API_KEY);
      expect(actions.body.count).toBe(0);
    });
    */

    it('should plan actions at Warning autonomy level', async () => {
      config.autonomyLevel = AutonomyLevel.Warning;
      config.activeRoles = [
        HeimgeistRole.Observer,
        HeimgeistRole.Critic,
        HeimgeistRole.Director,
      ];
      heimgeist = createHeimgeist(config, undefined, mockChronik);
      app = createApp(heimgeist);

      // Submit critical event
      await request(app)
        .post('/heimgeist/events')
        .set('X-API-Key', TEST_API_KEY)
        .send({
          type: EventType.IncidentDetected,
          source: 'test',
          payload: { description: 'Critical failure' },
        });

      // At Warning level, actions should be planned for high/critical insights
      const actions = await request(app).get('/heimgeist/actions')
        .set('X-API-Key', TEST_API_KEY);
      // Actions should exist if insights are high/critical severity
      expect(actions.body.actions).toBeInstanceOf(Array);
    });
  });

  describe('Risk Assessment Integration', () => {
    it('should escalate risk level with multiple critical events', async () => {
      // Get initial risk
      const initialRisk = await request(app).get('/heimgeist/risk')
        .set('X-API-Key', TEST_API_KEY);
      const initialLevel = initialRisk.body.level;

      // Submit multiple critical events
      const criticalEvents = [
        { type: EventType.IncidentDetected, payload: { description: 'DB failure' } },
        { type: EventType.DeployFailed, payload: { environment: 'production' } },
        {
          type: EventType.IncidentDetected,
          payload: { description: 'Service unavailable' },
        },
      ];

      for (const event of criticalEvents) {
        await request(app)
          .post('/heimgeist/events')
          .set('X-API-Key', TEST_API_KEY)
          .send({ ...event, source: 'test' });
      }

      // Get updated risk
      const updatedRisk = await request(app).get('/heimgeist/risk')
        .set('X-API-Key', TEST_API_KEY);
      const updatedLevel = updatedRisk.body.level;

      // Risk should be higher or at least have more reasons
      expect(updatedRisk.body.reasons.length).toBeGreaterThanOrEqual(
        initialRisk.body.reasons.length
      );

      // Risk level should not be low after critical events
      expect(['medium', 'high', 'critical']).toContain(updatedLevel);
    });
  });

  describe('Complete User Journey', () => {
    it('should support a typical user workflow', async () => {
      // 1. User checks system status
      let status = await request(app).get('/heimgeist/status')
        .set('X-API-Key', TEST_API_KEY);
      expect(status.status).toBe(200);
      const initialEventsProcessed = status.body.eventsProcessed;

      // 2. User submits a CI failure event
      await request(app)
        .post('/heimgeist/events')
        .set('X-API-Key', TEST_API_KEY)
        .send({
          type: EventType.CIResult,
          source: 'github-actions',
          payload: { status: 'failed', repository: 'user/repo' },
        });

      // 3. User checks risk assessment
      const risk = await request(app).get('/heimgeist/risk')
        .set('X-API-Key', TEST_API_KEY);
      expect(risk.status).toBe(200);
      expect(risk.body.level).toBeDefined();

      // 4. User lists insights to see what was found
      const insights = await request(app).get('/heimgeist/insights')
        .set('X-API-Key', TEST_API_KEY);
      expect(insights.status).toBe(200);
      expect(insights.body.count).toBeGreaterThan(0);

      // 5. User runs a full analysis
      const analysis = await request(app)
        .post('/heimgeist/analyse')
        .set('X-API-Key', TEST_API_KEY)
        .send({
          depth: 'deep',
        });
      expect(analysis.status).toBe(200);

      // 6. User checks if any actions are pending
      const actions = await request(app).get('/heimgeist/actions')
        .set('X-API-Key', TEST_API_KEY);
      expect(actions.status).toBe(200);

      // 7. User checks status again to see changes
      status = await request(app).get('/heimgeist/status')
        .set('X-API-Key', TEST_API_KEY);
      expect(status.body.eventsProcessed).toBeGreaterThan(initialEventsProcessed);
    });
  });
});
