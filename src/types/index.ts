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
  PRClosed = 'pr.closed',
  DeployFailed = 'deploy.failed',
  DeploySucceeded = 'deploy.succeeded',
  IncidentDetected = 'incident.detected',
  IncidentResolved = 'incident.resolved',
  EpicLinked = 'epic.linked',
  EpicCompleted = 'epic.completed',
  PatternGood = 'pattern.good',
  PatternBad = 'pattern.bad',
  SichterReport = 'sichter.report.v1',
  WGXGuardCompleted = 'wgx.guard.completed',
  HeimgeistInsight = 'heimgeist.insight.v1',
  HeimgeistActions = 'heimgeist.actions.v1',
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

/**
 * Heimgewebe command from PR comment
 */
export interface HeimgewebeCommand {
  id: string;
  timestamp: Date;
  tool: 'sichter' | 'wgx' | 'heimlern' | 'metarepo' | 'heimgeist';
  command: string;
  args: string[];
  context: {
    pr?: number;
    repo: string;
    author: string;
    comment_id?: string;
  };
}

/**
 * Epic tracking
 */
export interface Epic {
  id: string;
  title: string;
  description?: string;
  linked_prs: number[];
  phase: 'planning' | 'implementation' | 'review' | 'completed';
  started_at: Date;
  completed_at?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Incident record
 */
export interface Incident {
  id: string;
  severity: RiskSeverity;
  description: string;
  affected_services: string[];
  detected_at: Date;
  resolved_at?: Date;
  root_cause?: {
    type: 'pr' | 'deployment' | 'infrastructure' | 'external' | 'unknown';
    reference?: string;
  };
  context?: Record<string, unknown>;
}

/**
 * Pattern record for learning
 */
export interface Pattern {
  id: string;
  type: 'good' | 'bad';
  name: string;
  description: string;
  occurrences: number;
  examples: string[];
  recommendation?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * Risk assessment with alternatives
 */
export interface RiskAssessment {
  level: RiskSeverity;
  reasons: string[];
  recommendations: Recommendation[];
  confidence: number;
}

/**
 * Recommendation with risks and alternatives
 */
export interface Recommendation {
  action: string;
  rationale: string;
  risks: string[];
  assumptions: string[];
  alternatives: Alternative[];
  confidence: number;
}

/**
 * Alternative action
 */
export interface Alternative {
  action: string;
  pros: string[];
  cons: string[];
}

/**
 * Sichter report
 */
export interface SichterReport {
  id: string;
  pr: number;
  timestamp: Date;
  risk_level: RiskSeverity;
  affected_layers: string[];
  similar_prs: number[];
  recommendations: string[];
  analysis_depth: 'quick' | 'deep' | 'full';
}

/**
 * WGX Guard result
 */
export interface WGXGuardResult {
  id: string;
  pr: number;
  timestamp: Date;
  scope: string;
  status: 'passed' | 'failed' | 'warning';
  checks: GuardCheck[];
  duration_ms: number;
}

/**
 * Individual guard check
 */
export interface GuardCheck {
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'warning';
  message?: string;
  details?: Record<string, unknown>;
}
