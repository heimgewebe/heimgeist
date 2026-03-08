import request from 'supertest';
import express from 'express';
import { createApp } from './server';
import { Heimgeist } from '../core';
import { AutonomyLevel, HeimgeistRole } from '../types';

describe('Heimgeist API Authentication', () => {
  describe('No API key configured (Fail-Closed)', () => {
    let app: express.Application;

    beforeEach(() => {
      const heimgeist = new Heimgeist({
        autonomyLevel: AutonomyLevel.Warning,
        activeRoles: [HeimgeistRole.Observer],
        policies: [],
        eventSources: [],
        outputs: [],
        persistenceEnabled: false,
        apiKey: undefined,
      });
      app = createApp(heimgeist);
    });

    it('should deny access to /heimgeist/status when no key is configured (401)', async () => {
      const response = await request(app).get('/heimgeist/status');
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized');
      expect(response.body.message).toBe('Invalid or missing API key');
    });
  });

  describe('API key configured', () => {
    let app: express.Application;
    const VALID_KEY = 'test-secret-key';

    beforeEach(() => {
      const heimgeist = new Heimgeist({
        autonomyLevel: AutonomyLevel.Warning,
        activeRoles: [HeimgeistRole.Observer],
        policies: [],
        eventSources: [],
        outputs: [],
        persistenceEnabled: false,
        apiKey: VALID_KEY,
      });
      app = createApp(heimgeist);
    });

    it('should deny access to /heimgeist/status without a key (401)', async () => {
      const response = await request(app).get('/heimgeist/status');
      expect(response.status).toBe(401);
    });

    it('should deny access to /heimgeist/status with an incorrect key (401)', async () => {
      const response = await request(app)
        .get('/heimgeist/status')
        .set('X-API-Key', 'wrong-key');
      expect(response.status).toBe(401);
    });

    it('should deny access with a key of incorrect length (401)', async () => {
      // Testing the length-check in constant-time comparison
      const response = await request(app)
        .get('/heimgeist/status')
        .set('X-API-Key', VALID_KEY + '-extra');
      expect(response.status).toBe(401);
    });

    it('should allow access to /heimgeist/status with correct X-API-Key header', async () => {
      const response = await request(app)
        .get('/heimgeist/status')
        .set('X-API-Key', VALID_KEY);
      expect(response.status).toBe(200);
    });

    it('should allow access to /heimgeist/status with correct Authorization: Bearer header', async () => {
      const response = await request(app)
        .get('/heimgeist/status')
        .set('Authorization', `Bearer ${VALID_KEY}`);
      expect(response.status).toBe(200);
    });

    it('should redact the API key in the config output', async () => {
      const response = await request(app)
        .get('/heimgeist/config')
        .set('X-API-Key', VALID_KEY);

      expect(response.status).toBe(200);
      expect(response.body.apiKey).toBe('[REDACTED]');
    });

    it('should allow access to public /health even with API key configured', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
    });

    it('should allow access to public root / even with API key configured', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(200);
    });
  });
});
