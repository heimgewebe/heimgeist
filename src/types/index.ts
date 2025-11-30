/**
 * Heimgeist Autonomy Levels
 *
 * Level 0 - Passive: Reacts only to direct requests
 * Level 1 - Observing: Notes issues, only pings when explicitly asked
 * Level 2 - Warning (Default): Proactively analyzes, writes hints/suggestions,
 *           needs confirmation for actions (e.g., PR labels, WGX tasks)
 * Level 3 - Operative: Can trigger guards, analyses, reports, and propose
 *           small, low-risk changes within defined policies
 */
export enum AutonomyLevel {
  Passive = 0,
  Observing = 1,
  Warning = 2,
  Operative = 3,
}

/**
 * Heimgeist's core roles
 */
export enum HeimgeistRole {
  Observer = 'observer', // Reads chronik events, context from semantAH
  Critic = 'critic', // Detects drift, errors, risky patterns, policy violations
  Director = 'director', // Plans tool chains, decides when to act
  Archivist = 'archivist', // Writes insights to chronik, semantAH, heimlern
}

/**
 * Risk severity levels
 */
export enum RiskSeverity {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

/**
 * Event types that Heimgeist can process
 */
export enum EventType {
  Command = 'heimgewebe.command.v1',
  CIResult = 'ci.result',
  PROpened = 'pr.opened',
  PRMerged = 'pr.merged',
  DeployFailed = 'deploy.failed',
  IncidentDetected = 'incident.detected',
  Custom = 'custom',
}

/**
 * An event from chronik that Heimgeist processes
 */
export interface ChronikEvent {
  id: string;
  type: EventType | string;
  timestamp: Date;
  source: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * An insight or finding from Heimgeist's analysis
 */
export interface Insight {
  id: string;
  timestamp: Date;
  role: HeimgeistRole;
  type: 'pattern' | 'risk' | 'drift' | 'contradiction' | 'policy_violation' | 'suggestion';
  severity: RiskSeverity;
  title: string;
  description: string;
  source?: ChronikEvent;
  context?: Record<string, unknown>;
  recommendations?: string[];
}

/**
 * A planned action from the Director role
 */
export interface PlannedAction {
  id: string;
  timestamp: Date;
  trigger: Insight;
  steps: ActionStep[];
  requiresConfirmation: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
}

/**
 * A single step in a planned action
 */
export interface ActionStep {
  order: number;
  tool: string;
  parameters: Record<string, unknown>;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
}

/**
 * Heimgeist configuration
 */
export interface HeimgeistConfig {
  autonomyLevel: AutonomyLevel;
  activeRoles: HeimgeistRole[];
  policies: Policy[];
  eventSources: EventSource[];
  outputs: OutputConfig[];
}

/**
 * A policy that defines allowed actions at certain autonomy levels
 */
export interface Policy {
  name: string;
  description: string;
  minAutonomyLevel: AutonomyLevel;
  allowedActions: string[];
  conditions?: Record<string, unknown>;
}

/**
 * Configuration for an event source
 */
export interface EventSource {
  name: string;
  type: 'chronik' | 'webhook' | 'polling';
  config: Record<string, unknown>;
  enabled: boolean;
}

/**
 * Configuration for output destinations
 */
export interface OutputConfig {
  name: string;
  type: 'chronik' | 'semantah' | 'heimlern' | 'console' | 'webhook';
  config: Record<string, unknown>;
  enabled: boolean;
}

/**
 * Analysis request for the HTTP API
 */
export interface AnalysisRequest {
  target?: string;
  scope?: string[];
  depth?: 'quick' | 'deep' | 'full';
  focus?: HeimgeistRole[];
}

/**
 * Analysis result from Heimgeist
 */
export interface AnalysisResult {
  id: string;
  timestamp: Date;
  request: AnalysisRequest;
  insights: Insight[];
  plannedActions: PlannedAction[];
  summary: string;
}

/**
 * Status response from Heimgeist
 */
export interface StatusResponse {
  version: string;
  autonomyLevel: AutonomyLevel;
  activeRoles: HeimgeistRole[];
  uptime: number;
  eventsProcessed: number;
  insightsGenerated: number;
  actionsExecuted: number;
  lastActivity?: Date;
}

/**
 * Explanation request for the "why" endpoint
 */
export interface ExplainRequest {
  insightId?: string;
  actionId?: string;
  eventId?: string;
}

/**
 * Explanation response
 */
export interface ExplainResponse {
  subject: {
    type: 'insight' | 'action' | 'event';
    id: string;
  };
  explanation: string;
  reasoning: string[];
  relatedInsights: string[];
  context: Record<string, unknown>;
}
