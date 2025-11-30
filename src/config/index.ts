import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import {
  HeimgeistConfig,
  AutonomyLevel,
  HeimgeistRole,
} from '../types';

/**
 * Default configuration for Heimgeist
 */
const DEFAULT_CONFIG: HeimgeistConfig = {
  autonomyLevel: AutonomyLevel.Warning, // Level 2 is the default
  activeRoles: [
    HeimgeistRole.Observer,
    HeimgeistRole.Critic,
    HeimgeistRole.Director,
    HeimgeistRole.Archivist,
  ],
  policies: [
    {
      name: 'default-warning',
      description: 'Default policy for warning level - can analyze but needs confirmation for actions',
      minAutonomyLevel: AutonomyLevel.Warning,
      allowedActions: ['analyze', 'report', 'suggest'],
    },
    {
      name: 'operative-actions',
      description: 'Actions allowed at operative level',
      minAutonomyLevel: AutonomyLevel.Operative,
      allowedActions: ['trigger-guard', 'trigger-smoke', 'create-pr-draft', 'start-analysis'],
    },
  ],
  eventSources: [
    {
      name: 'chronik-default',
      type: 'chronik',
      config: {},
      enabled: true,
    },
  ],
  outputs: [
    {
      name: 'console',
      type: 'console',
      config: {},
      enabled: true,
    },
    {
      name: 'chronik',
      type: 'chronik',
      config: {},
      enabled: true,
    },
  ],
};

/**
 * Configuration file paths to search (in order)
 */
const CONFIG_PATHS = [
  '.heimgeist/config.yml',
  '.heimgeist/config.yaml',
  'heimgeist.yml',
  'heimgeist.yaml',
];

/**
 * Load Heimgeist configuration from file or use defaults
 */
export function loadConfig(basePath?: string): HeimgeistConfig {
  const searchPaths = CONFIG_PATHS.map((p) =>
    path.resolve(basePath || process.cwd(), p)
  );

  for (const configPath of searchPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf-8');
        const parsed = yaml.parse(content);
        return mergeConfig(DEFAULT_CONFIG, parsed);
      } catch (error) {
        console.warn(`Warning: Failed to parse config at ${configPath}:`, error);
      }
    }
  }

  return getDefaultConfig();
}

/**
 * Deep merge configuration with defaults
 */
function mergeConfig(
  defaults: HeimgeistConfig,
  override: Partial<HeimgeistConfig>
): HeimgeistConfig {
  return {
    autonomyLevel:
      override.autonomyLevel !== undefined
        ? override.autonomyLevel
        : defaults.autonomyLevel,
    activeRoles:
      override.activeRoles !== undefined
        ? override.activeRoles
        : defaults.activeRoles,
    // Merge policies: add custom policies to default ones
    policies:
      override.policies !== undefined
        ? [...defaults.policies, ...override.policies]
        : defaults.policies,
    // Replace event sources completely if provided (don't merge with defaults)
    eventSources:
      override.eventSources !== undefined
        ? override.eventSources
        : defaults.eventSources,
    // Replace outputs completely if provided (don't merge with defaults)
    outputs:
      override.outputs !== undefined ? override.outputs : defaults.outputs,
  };
}

/**
 * Get the default configuration (deep copy)
 */
export function getDefaultConfig(): HeimgeistConfig {
  return {
    autonomyLevel: DEFAULT_CONFIG.autonomyLevel,
    activeRoles: [...DEFAULT_CONFIG.activeRoles],
    policies: DEFAULT_CONFIG.policies.map((p) => ({ ...p })),
    eventSources: DEFAULT_CONFIG.eventSources.map((e) => ({ ...e })),
    outputs: DEFAULT_CONFIG.outputs.map((o) => ({ ...o })),
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: HeimgeistConfig): string[] {
  const errors: string[] = [];

  if (
    config.autonomyLevel < AutonomyLevel.Passive ||
    config.autonomyLevel > AutonomyLevel.Operative
  ) {
    errors.push(
      `Invalid autonomy level: ${config.autonomyLevel}. Must be between 0 and 3.`
    );
  }

  if (!config.activeRoles || config.activeRoles.length === 0) {
    errors.push('At least one active role must be configured.');
  }

  return errors;
}

/**
 * Get autonomy level name
 */
export function getAutonomyLevelName(level: AutonomyLevel): string {
  switch (level) {
    case AutonomyLevel.Passive:
      return 'Passive';
    case AutonomyLevel.Observing:
      return 'Observing';
    case AutonomyLevel.Warning:
      return 'Warning';
    case AutonomyLevel.Operative:
      return 'Operative';
    default:
      return 'Unknown';
  }
}
