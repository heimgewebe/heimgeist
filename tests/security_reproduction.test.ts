import request from 'supertest';
import { createApp } from '../src/api/server';
import { Heimgeist } from '../src/core';
import { AutonomyLevel, HeimgeistRole } from '../src/types';

describe('Heimgeist Configuration Disclosure Vulnerability', () => {
  it('should redact sensitive information in the config endpoint', async () => {
    const heimgeist = new Heimgeist({
      autonomyLevel: AutonomyLevel.Warning,
      activeRoles: [HeimgeistRole.Observer],
      policies: [],
      eventSources: [
        {
          name: 'sensitive-source',
          type: 'chronik',
          config: {
            token: 'secret-token-123',
            api_key: 'sensitive-api-key',
          },
          enabled: true,
        },
      ],
      outputs: [
        {
          name: 'sensitive-output',
          type: 'webhook',
          config: {
            url: 'https://hooks.slack.com/services/T0000/B0000/XXXX',
            secret: 'webhook-secret',
          },
          enabled: true,
        },
      ],
      persistenceEnabled: false,
    });
    const app = createApp(heimgeist);

    const response = await request(app).get('/heimgeist/config');

    expect(response.status).toBe(200);

    // Check eventSources
    const source = response.body.eventSources.find((s: any) => s.name === 'sensitive-source');
    expect(source.config.token).toBe('[REDACTED]');
    expect(source.config.api_key).toBe('[REDACTED]');

    // Check outputs
    const output = response.body.outputs.find((o: any) => o.name === 'sensitive-output');
    expect(output.config.secret).toBe('[REDACTED]');
  });
});
