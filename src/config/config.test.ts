import * as fs from 'fs';
import * as path from 'path';
import {
  loadConfig,
  getDefaultConfig,
  validateConfig,
  getAutonomyLevelName,
} from './index';
import { AutonomyLevel, HeimgeistRole } from '../types';

// Mock fs module
jest.mock('fs');

describe('config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration', () => {
      const config = getDefaultConfig();

      expect(config.autonomyLevel).toBe(AutonomyLevel.Warning);
      expect(config.activeRoles).toContain(HeimgeistRole.Observer);
      expect(config.activeRoles).toContain(HeimgeistRole.Critic);
      expect(config.activeRoles).toContain(HeimgeistRole.Director);
      expect(config.activeRoles).toContain(HeimgeistRole.Archivist);
      expect(config.policies.length).toBeGreaterThan(0);
    });
  });

  describe('loadConfig', () => {
    it('should return default config when no file exists', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const config = loadConfig('/some/path');

      expect(config.autonomyLevel).toBe(AutonomyLevel.Warning);
    });

    it('should load and merge config from file', () => {
      (fs.existsSync as jest.Mock).mockImplementation((p: string) =>
        p.endsWith('.heimgeist/config.yml')
      );
      (fs.readFileSync as jest.Mock).mockReturnValue(`
autonomyLevel: 3
activeRoles:
  - observer
  - critic
`);

      const config = loadConfig('/some/path');

      expect(config.autonomyLevel).toBe(3);
      expect(config.activeRoles).toEqual(['observer', 'critic']);
    });

    it('should fallback to default on parse error', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid: yaml: content: [');

      // Mock console.warn to suppress warning output
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const config = loadConfig('/some/path');

      expect(config.autonomyLevel).toBe(AutonomyLevel.Warning);
      warnSpy.mockRestore();
    });
  });

  describe('validateConfig', () => {
    it('should validate correct config', () => {
      const config = getDefaultConfig();
      const errors = validateConfig(config);

      expect(errors).toHaveLength(0);
    });

    it('should detect invalid autonomy level', () => {
      const config = getDefaultConfig();
      config.autonomyLevel = 5 as AutonomyLevel;

      const errors = validateConfig(config);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Invalid autonomy level');
    });

    it('should detect empty active roles', () => {
      const config = getDefaultConfig();
      config.activeRoles = [];

      const errors = validateConfig(config);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('At least one active role');
    });
  });

  describe('getAutonomyLevelName', () => {
    it('should return correct names for all levels', () => {
      expect(getAutonomyLevelName(AutonomyLevel.Passive)).toBe('Passive');
      expect(getAutonomyLevelName(AutonomyLevel.Observing)).toBe('Observing');
      expect(getAutonomyLevelName(AutonomyLevel.Warning)).toBe('Warning');
      expect(getAutonomyLevelName(AutonomyLevel.Operative)).toBe('Operative');
    });

    it('should return Unknown for invalid levels', () => {
      expect(getAutonomyLevelName(99 as AutonomyLevel)).toBe('Unknown');
    });
  });
});
