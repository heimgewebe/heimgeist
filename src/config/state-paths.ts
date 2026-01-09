import * as path from 'path';

/**
 * The directory where Heimgeist persists its runtime state.
 * This is part of the core contract defined in `docs/heimgeist-core-loop.md`.
 *
 * EXTERNAL CONTRACT: These paths are relied upon by other tools in the ecosystem.
 * Changing them will break integration with tools that expect this directory structure.
 */
export const STATE_DIR = 'heimgeist_state';

/**
 * Directory for persistent insights.
 * Contract: JSON files named by UUID.
 */
export const INSIGHTS_DIR = path.join(STATE_DIR, 'insights');

/**
 * Directory for persistent planned actions.
 * Contract: JSON files named by UUID.
 */
export const ACTIONS_DIR = path.join(STATE_DIR, 'actions');

/**
 * Directory for persistent self-model state.
 * Contract: JSON files named by timestamp/version.
 */
export const SELF_MODEL_DIR = path.join(STATE_DIR, 'self_model');
