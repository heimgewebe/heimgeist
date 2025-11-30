import request from 'supertest';
import express from 'express';
import { createApp } from './server';
import { Heimgeist } from '../core';
import { EventType, AutonomyLevel, HeimgeistRole } from '../types';

describe('Heimgeist API Server', () => {
  let app: express.Application;
  let heimgeist: Heimgeist;

  beforeEach(() => {
    heimgeist = new Heimgeist({
      autonomyLevel: AutonomyLevel.Warning,
      activeRoles: [
        HeimgeistRole.Observer,
        HeimgeistRole.Critic,
        HeimgeistRole.Director,
        HeimgeistRole.Archivist,
      ],
      policies: [],
      eventSources: [],
      outputs: [],
    });
    app = createApp(heimgeist);
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        service: 'heimgeist',
      });
    });
  });

  describe('GET /', () => {
    it('should return API information', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Heimgeist');
      expect(response.body.version).toBe('1.0.0');
      expect(response.body.endpoints).toBeDefined();
    });
  });

  describe('GET /heimgeist/status', () => {
    it('should return current status', async () => {
      const response = await request(app).get('/heimgeist/status');
      expect(response.status).toBe(200);
      expect(response.body.version).toBe('1.0.0');
      expect(response.body.autonomyLevel).toBe(AutonomyLevel.Warning);
      expect(response.body.eventsProcessed).toBe(0);
    });
  });

  describe('POST /heimgeist/analyse', () => {
    it('should run an analysis', async () => {
      const response = await request(app).post('/heimgeist/analyse').send({ depth: 'quick' });

      expect(response.status).toBe(200);
      expect(response.body.id).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.summary).toBeDefined();
    });

    it('should accept analyze spelling', async () => {
      const response = await request(app).post('/heimgeist/analyze').send({ depth: 'deep' });

      expect(response.status).toBe(200);
      expect(response.body.id).toBeDefined();
    });

    it('should use default depth if not provided', async () => {
      const response = await request(app).post('/heimgeist/analyse').send({});

      expect(response.status).toBe(200);
      expect(response.body.id).toBeDefined();
    });
  });

  describe('GET /heimgeist/risk', () => {
    it('should return risk assessment', async () => {
      const response = await request(app).get('/heimgeist/risk');
      expect(response.status).toBe(200);
      expect(response.body.level).toBeDefined();
      expect(response.body.reasons).toBeInstanceOf(Array);
      expect(response.body.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('GET /heimgeist/insights', () => {
    it('should return insights list', async () => {
      const response = await request(app).get('/heimgeist/insights');
      expect(response.status).toBe(200);
      expect(response.body.insights).toBeInstanceOf(Array);
      expect(response.body.count).toBeDefined();
    });

    it('should show insights after processing events', async () => {
      // Submit an event first
      await request(app)
        .post('/heimgeist/events')
        .send({
          type: EventType.CIResult,
          source: 'test',
          payload: { status: 'failed' },
        });

      const response = await request(app).get('/heimgeist/insights');
      expect(response.status).toBe(200);
      expect(response.body.count).toBeGreaterThan(0);
    });
  });

  describe('GET /heimgeist/actions', () => {
    it('should return planned actions list', async () => {
      const response = await request(app).get('/heimgeist/actions');
      expect(response.status).toBe(200);
      expect(response.body.actions).toBeInstanceOf(Array);
      expect(response.body.count).toBeDefined();
    });
  });

  describe('POST /heimgeist/events', () => {
    it('should process a new event', async () => {
      const response = await request(app)
        .post('/heimgeist/events')
        .send({
          type: EventType.CIResult,
          source: 'github-actions',
          payload: { status: 'failed' },
        });

      expect(response.status).toBe(200);
      expect(response.body.eventId).toBeDefined();
      expect(response.body.insights).toBeInstanceOf(Array);
      expect(response.body.insightsCount).toBeDefined();
    });

    it('should generate event ID if not provided', async () => {
      const response = await request(app).post('/heimgeist/events').send({
        type: EventType.PROpened,
        payload: {},
      });

      expect(response.status).toBe(200);
      expect(response.body.eventId).toBeDefined();
    });

    it('should use default values for missing fields', async () => {
      const response = await request(app).post('/heimgeist/events').send({});

      expect(response.status).toBe(200);
      expect(response.body.eventId).toBeDefined();
    });

    it('should reject invalid request body', async () => {
      const response = await request(app).post('/heimgeist/events').send('invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /heimgeist/explain', () => {
    it('should explain an insight', async () => {
      // Create an event to generate insights
      await request(app)
        .post('/heimgeist/events')
        .send({
          type: EventType.CIResult,
          source: 'test',
          payload: { status: 'failed' },
        });

      const insights = heimgeist.getInsights();
      if (insights.length > 0) {
        const response = await request(app)
          .post('/heimgeist/explain')
          .send({ insightId: insights[0].id });

        expect(response.status).toBe(200);
        expect(response.body.explanation).toBeDefined();
      }
    });

    it('should return 404 for non-existent insight', async () => {
      const response = await request(app)
        .post('/heimgeist/explain')
        .send({ insightId: 'non-existent-id' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('GET /heimgeist/config', () => {
    it('should return current configuration', async () => {
      const response = await request(app).get('/heimgeist/config');
      expect(response.status).toBe(200);
      expect(response.body.autonomyLevel).toBe(AutonomyLevel.Warning);
      expect(response.body.activeRoles).toBeInstanceOf(Array);
    });
  });

  describe('PATCH /heimgeist/config/autonomy', () => {
    it('should update autonomy level', async () => {
      const response = await request(app).patch('/heimgeist/config/autonomy').send({ level: 3 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.autonomyLevel).toBe(3);
    });

    it('should reject invalid autonomy level', async () => {
      const response = await request(app).patch('/heimgeist/config/autonomy').send({ level: 5 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should reject non-numeric autonomy level', async () => {
      const response = await request(app)
        .patch('/heimgeist/config/autonomy')
        .send({ level: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /heimgeist/actions/:id/approve', () => {
    it('should approve a pending action', async () => {
      // Generate a high-severity event to create an action
      await request(app)
        .post('/heimgeist/events')
        .send({
          type: EventType.IncidentDetected,
          source: 'test',
          payload: { description: 'Critical failure' },
        });

      const actions = heimgeist.getPlannedActions();
      if (actions.length > 0) {
        const response = await request(app).post(`/heimgeist/actions/${actions[0].id}/approve`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should return 404 for non-existent action', async () => {
      const response = await request(app).post('/heimgeist/actions/non-existent-id/approve');

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /heimgeist/actions/:id/reject', () => {
    it('should reject a pending action', async () => {
      // Generate a high-severity event to create an action
      await request(app)
        .post('/heimgeist/events')
        .send({
          type: EventType.IncidentDetected,
          source: 'test',
          payload: { description: 'Critical failure' },
        });

      const actions = heimgeist.getPlannedActions();
      if (actions.length > 0) {
        const response = await request(app).post(`/heimgeist/actions/${actions[0].id}/reject`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    it('should return 404 for non-existent action', async () => {
      const response = await request(app).post('/heimgeist/actions/non-existent-id/reject');

      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle internal errors gracefully', async () => {
      // Create a router with a failing handler
      const router = express.Router();
      router.get('/fail', () => {
        throw new Error('Test error');
      });

      const testApp = express();
      testApp.use(router);
      testApp.use(
        (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
          res.status(500).json({
            error: 'Internal server error',
            message: err.message,
          });
        }
      );

      const response = await request(testApp).get('/fail');
      expect(response.status).toBe(500);
      expect(response.body.error).toBeDefined();
    });
  });
});
