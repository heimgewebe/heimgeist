import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  HeimgeistConfig,
  HeimgeistRole,
  AutonomyLevel,
  ChronikEvent,
  ChronikClient,
  EventType,
  Insight,
  PlannedAction,
  AnalysisRequest,
  AnalysisResult,
  StatusResponse,
  ExplainRequest,
  ExplainResponse,
  RiskSeverity,
  RiskAssessment,
  Recommendation,
  Alternative,
  Epic,
  Incident,
  Pattern,
  HeimgewebeCommand,
  HeimgeistInsightEvent,
  HeimgeistSelfStateSnapshotEvent,
  ArchiveResult,
  HeimgeistInsightDataV1,
} from '../types';
import { loadConfig, getAutonomyLevelName } from '../config';
import { STATE_DIR, INSIGHTS_DIR, ACTIONS_DIR, ARTIFACTS_DIR } from '../config/state-paths';
import { Logger, defaultLogger } from './logger';
import { CommandParser } from './command-parser';
import { SelfModel } from './self_model';
import { ArtifactWriter } from './artifact_writer';
import { SystemSignals } from '../types';

/**
 * Insight context codes for identifying specific types of issues
 */
const INSIGHT_CODE = {
  CI_FAILURE_MAIN: 'ci_failure_main',
  CI_FAILURE_GENERIC: 'ci_failure_generic',
  DEPLOY_FAILED: 'deploy_failed',
} as const;

/**
 * Heimgeist - The System Self-Reflection Engine
 *
 * Character: dry, slightly ironic, analytical
 * Focus: code, repos, CI, processes, knowledge
 * Attitude: skeptical of "it works", loves contradictions and drift
 */
export class Heimgeist {
  private config: HeimgeistConfig;
  private insights: Map<string, Insight> = new Map();
  private plannedActions: Map<string, PlannedAction> = new Map();
  private events: Map<string, ChronikEvent> = new Map();
  private epics: Map<string, Epic> = new Map();
  private incidents: Map<string, Incident> = new Map();
  private patterns: Map<string, Pattern> = new Map();
  private startTime: Date;
  private eventsProcessed = 0;
  private actionsExecuted = 0;
  private lastActivity?: Date;
  private logger: Logger;
  private chronik?: ChronikClient;
  private selfModel: SelfModel;
  private artifactWriter: ArtifactWriter;

  constructor(config?: HeimgeistConfig, logger: Logger = defaultLogger, chronik?: ChronikClient) {
    // console.log('Heimgeist constructor config:', config);
    this.config = config || loadConfig();
    // console.log('Heimgeist effective config:', this.config);
    this.logger = logger;
    this.chronik = chronik;
    this.startTime = new Date();
    this.selfModel = new SelfModel();
    this.artifactWriter = new ArtifactWriter(ARTIFACTS_DIR);

    if (this.config.persistenceEnabled !== false) {
      this.loadState();
    }
  }

  /**
   * Load state from persistence
   */
  private loadState(): void {
    try {
      // Safety check just in case
      if (this.config.persistenceEnabled === false) return;

      if (!fs.existsSync(INSIGHTS_DIR)) return;

      const insightFiles = fs.readdirSync(INSIGHTS_DIR);
      for (const file of insightFiles) {
        if (file.endsWith('.json')) {
          try {
            const content = fs.readFileSync(path.join(INSIGHTS_DIR, file), 'utf-8');
            const json = JSON.parse(content);
            // Support legacy (raw Insight) and new (Event Envelope) format
            let insight: Insight;
            if (json.kind === 'heimgeist.insight' && json.data && json.data.origin) {
               insight = json.data.origin as Insight;
            } else {
               insight = json as Insight;
            }
            this.insights.set(insight.id, insight);
          } catch (e) {
            this.logger.warn(`Failed to load insight ${file}: ${e}`);
          }
        }
      }

      if (!fs.existsSync(ACTIONS_DIR)) return;

      const actionFiles = fs.readdirSync(ACTIONS_DIR);
      for (const file of actionFiles) {
        if (file.endsWith('.json')) {
          try {
            const content = fs.readFileSync(path.join(ACTIONS_DIR, file), 'utf-8');
            const action = JSON.parse(content) as PlannedAction;
            this.plannedActions.set(action.id, action);
          } catch (e) {
            this.logger.warn(`Failed to load action ${file}: ${e}`);
          }
        }
      }

      // Update counters based on loaded state
      this.eventsProcessed = 0; // Reset, as we don't persist event count yet

    } catch (error) {
      this.logger.warn(`Failed to load state: ${error}`);
    }
  }

  /**
   * Get current status
   */
  getStatus(): StatusResponse {
    return {
      version: '1.0.0',
      autonomyLevel: this.config.autonomyLevel,
      activeRoles: this.config.activeRoles,
      uptime: Date.now() - this.startTime.getTime(),
      eventsProcessed: this.eventsProcessed,
      insightsGenerated: this.insights.size,
      actionsExecuted: this.actionsExecuted,
      lastActivity: this.lastActivity,
      self_state: this.selfModel.getState(),
    };
  }

  /**
   * Update Self-Model with system signals
   */
  public updateSelfModel(signals: SystemSignals): void {
      const persisted = this.selfModel.update(signals);
      if (persisted) {
          this.writeSelfStateBundle();
          void this.publishSelfStateSnapshot();
      }
  }

  /**
   * Write the Self-State artifact bundle
   */
  private writeSelfStateBundle(): void {
      if (this.config.persistenceEnabled !== false) {
          const state = this.selfModel.getState();
          const history = this.selfModel.getHistory(50);
          this.artifactWriter.write(state, history);
      }
  }

  /**
   * Publish Self-State snapshot event to Chronik
   */
  private async publishSelfStateSnapshot(): Promise<void> {
      if (!this.chronik) return;

      const state = this.selfModel.getState();
      const event: HeimgeistSelfStateSnapshotEvent = {
          kind: 'heimgeist.self_state.snapshot',
          version: 1,
          id: uuidv4(),
          meta: {
              occurred_at: new Date().toISOString(),
          },
          data: state
      };

      try {
          await this.chronik.append(event);
      } catch (error) {
          this.logger.warn(`Failed to publish self-state snapshot: ${error}`);
      }
  }

  /**
   * Process an incoming event from chronik
   */
  async processEvent(event: ChronikEvent): Promise<Insight[]> {
    this.events.set(event.id, event);
    this.eventsProcessed++;
    this.lastActivity = new Date();

    const newInsights: Insight[] = [];

    // Observer role: analyze the event
    if (this.config.activeRoles.includes(HeimgeistRole.Observer)) {
      const observations = await this.observe(event);
      newInsights.push(...observations);
    }

    // Critic role: evaluate risks and patterns
    if (this.config.activeRoles.includes(HeimgeistRole.Critic)) {
      const critiques = this.critique(event, newInsights);
      newInsights.push(...critiques);
    }

    // Store insights
    for (const insight of newInsights) {
      this.insights.set(insight.id, insight);
    }

    // Director role: plan actions if autonomy level allows
    if (
      this.config.activeRoles.includes(HeimgeistRole.Director) &&
      this.config.autonomyLevel >= AutonomyLevel.Warning
    ) {
      for (const insight of newInsights) {
        if (insight.severity === RiskSeverity.High || insight.severity === RiskSeverity.Critical) {
          const action = this.planAction(insight);
          if (action) {
            this.plannedActions.set(action.id, action);
          }
        }
      }
    }

    // Archivist role: persist insights
    if (this.config.activeRoles.includes(HeimgeistRole.Archivist)) {
      const archiveResult = await this.archive(newInsights);
      if (archiveResult.failed > 0) {
        this.logger.warn(`Archivist: ${archiveResult.success} persisted, ${archiveResult.failed} failed.`);
      }
    }

    return newInsights;
  }

  /**
   * Observer role: Analyze events and extract observations
   */
  private async observe(event: ChronikEvent): Promise<Insight[]> {
    const insights: Insight[] = [];

    // Check for Knowledge Observatory Published
    if (event.type === EventType.KnowledgeObservatoryPublished) {
      const url = event.payload.url as string;
      if (url) {
        // Enforce HTTPS
        if (!url.startsWith('https://')) {
          this.logger.warn(`Observatory URL must be HTTPS: ${url}`);
          return insights;
        }

        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          try {
            const response = await fetch(url, { signal: controller.signal });
            if (response.ok) {
              const rawText = await response.text();
              const hash = crypto.createHash('sha256').update(rawText).digest('hex');

              // Idempotency check
              const isDuplicate = Array.from(this.insights.values()).some(
                (i) => i.context?.observatory_hash === hash
              );

              if (isDuplicate) {
                this.logger.log(`Skipping duplicate observatory update (hash: ${hash})`);
                return insights;
              }

              const observatoryData = JSON.parse(rawText) as Record<string, unknown>;
              const generatedAtRaw = observatoryData.generated_at;
              const generatedAt =
                typeof generatedAtRaw === 'string' && generatedAtRaw.length > 0
                  ? generatedAtRaw
                  : 'unknown';
              const summary = `Observatory data received from ${url}. Generated at ${generatedAt}.`;

              insights.push({
                id: uuidv4(),
                timestamp: new Date(),
                role: HeimgeistRole.Observer,
                type: 'suggestion',
                severity: RiskSeverity.Low,
                title: 'Knowledge Observatory Update',
                description: summary,
                source: event,
                context: {
                  url,
                  observatory_generated_at: generatedAt,
                  observatory_hash: hash,
                  internalOnly: true, // Do not propagate to Chronik
                  reason: 'observatory_published',
                  insight_kind: 'heimgeist.insight.v1',
                },
              });
            } else {
              this.logger.warn(`Failed to fetch observatory data from ${url}: ${response.statusText}`);
            }
          } finally {
            clearTimeout(timeout);
          }
        } catch (error) {
          this.logger.error(`Error processing observatory published event: ${error}`);
        }
      }
    }

    // Check for CI failures
    if (event.type === EventType.CIResult && event.payload?.status === 'failed') {
      const isMainBranch = event.payload.branch === 'main' || event.payload.ref === 'refs/heads/main';
      const severity = isMainBranch ? RiskSeverity.Critical : RiskSeverity.Medium;
      const title = isMainBranch ? 'Critical CI Failure on Main' : 'CI Build Failed';
      const description = isMainBranch
        ? `Build failure detected on main branch in ${event.source}. This is a critical stability risk.`
        : `Build failure detected in ${event.source}. This will hurt later if not addressed.`;

      const recommendations = [
        'Review the build logs',
        'Check for recent changes that might have caused the failure',
      ];

      const context: Record<string, unknown> = { isMainBranch };

      if (isMainBranch) {
        recommendations.unshift('Immediately stop merging into main');
        recommendations.push('Run guard checks on affected areas');
        context.code = 'ci_failure_main';
      } else {
        recommendations.push('Consider adding tests to prevent regression');
        context.code = 'ci_failure_generic';
      }

      insights.push({
        id: uuidv4(),
        timestamp: new Date(),
        role: HeimgeistRole.Observer,
        type: 'risk',
        severity,
        title,
        description,
        source: event,
        recommendations,
        context: { 
          isMainBranch,
          code: isMainBranch ? INSIGHT_CODE.CI_FAILURE_MAIN : INSIGHT_CODE.CI_FAILURE_GENERIC
        },
      });
    }

    // Check for deploy failures
    if (event.type === EventType.DeployFailed) {
      insights.push({
        id: uuidv4(),
        timestamp: new Date(),
        role: HeimgeistRole.Observer,
        type: 'risk',
        severity: RiskSeverity.High,
        title: 'Deployment Failed',
        description: `Deployment failure in ${event.source}. Production is at risk.`,
        source: event,
        recommendations: [
          'Immediately investigate the deployment logs',
          'Consider rollback if necessary',
          'Notify the team',
        ],
        context: {
            code: INSIGHT_CODE.DEPLOY_FAILED
        }
      });
    }

    // Check for incident detection
    if (event.type === EventType.IncidentDetected) {
      // Track incident
      const incidentId =
        (event.payload.incident_id as string | undefined) || `incident-${uuidv4()}`;
      this.incidents.set(incidentId, {
        id: incidentId,
        severity: (event.payload.severity as RiskSeverity) || RiskSeverity.High,
        description: (event.payload.description as string) || 'Unknown incident',
        affected_services: (event.payload.affected_services as string[]) || [],
        detected_at: event.timestamp,
        context: event.payload.context as Record<string, unknown>,
      });

      insights.push({
        id: uuidv4(),
        timestamp: new Date(),
        role: HeimgeistRole.Observer,
        type: 'risk',
        severity: RiskSeverity.Critical,
        title: 'Incident Detected',
        description: `An incident has been detected: ${
          (event.payload.description as string) || 'Unknown incident'
        }`,
        source: event,
        recommendations: [
          'Initiate incident response protocol',
          'Assess impact and scope',
          'Begin documentation',
        ],
      });
    }

    // Check for Epic events
    if (event.type === EventType.EpicLinked) {
      const epicId = event.payload.epic_id as string;
      this.epics.set(epicId, {
        id: epicId,
        title: (event.payload.title as string) || 'Untitled Epic',
        description: event.payload.description as string | undefined,
        linked_prs: (event.payload.linked_prs as number[]) || [],
        phase: (event.payload.phase as Epic['phase']) || 'planning',
        started_at: event.timestamp,
        metadata: event.payload.metadata as Record<string, unknown>,
      });

      insights.push({
        id: uuidv4(),
        timestamp: new Date(),
        role: HeimgeistRole.Observer,
        type: 'suggestion',
        severity: RiskSeverity.Low,
        title: 'Epic Linked',
        description: `Epic "${event.payload.title}" has been created and is being tracked`,
        source: event,
      });
    }

    // Check for Pattern events
    if (event.type === EventType.PatternBad || event.type === EventType.PatternGood) {
      const patternId = `pattern-${uuidv4()}`;
      const patternType: 'good' | 'bad' = event.type === EventType.PatternGood ? 'good' : 'bad';

      this.patterns.set(patternId, {
        id: patternId,
        type: patternType,
        name: (event.payload.pattern_name as string) || 'Unnamed pattern',
        description: (event.payload.description as string) || '',
        occurrences: (event.payload.occurrences as number) || 1,
        examples: (event.payload.examples as string[]) || [],
        recommendation: event.payload.recommendation as string | undefined,
        created_at: event.timestamp,
        updated_at: event.timestamp,
      });

      const severity = patternType === 'bad' ? RiskSeverity.Medium : RiskSeverity.Low;

      insights.push({
        id: uuidv4(),
        timestamp: new Date(),
        role: HeimgeistRole.Observer,
        type: 'pattern',
        severity,
        title: `${patternType === 'bad' ? 'Anti-' : ''}Pattern Recorded`,
        description: `Pattern "${event.payload.pattern_name}" has been marked as ${patternType}`,
        source: event,
        recommendations:
          patternType === 'bad'
            ? ['Avoid this pattern in future PRs', 'Consider adding linter rules']
            : ['Consider reusing this pattern', 'Document as best practice'],
      });
    }

    // Check for Command events
    if (event.type === EventType.Command) {
      // payload should be partial or full HeimgewebeCommand
      // We assume it's pre-parsed, but we can also use CommandParser.validateCommand to be sure
      const command = event.payload as unknown as HeimgewebeCommand;

      // Validate command
      const validation = CommandParser.validateCommand(command);

      if (validation.valid) {
        insights.push({
          id: uuidv4(),
          timestamp: new Date(),
          role: HeimgeistRole.Observer,
          type: 'suggestion',
          severity: RiskSeverity.Low,
          title: `Command Received: ${command.tool} /${command.command}`,
          description: `Received valid command for tool ${command.tool}: /${command.command} ${command.args.join(' ')}`,
          source: event,
          context: { command },
        });
      } else {
        insights.push({
          id: uuidv4(),
          timestamp: new Date(),
          role: HeimgeistRole.Observer,
          type: 'risk',
          severity: RiskSeverity.Low,
          title: 'Invalid Command Received',
          description: `Received invalid command: ${validation.error}`,
          source: event,
          recommendations: ['Check command syntax', 'Refer to documentation'],
        });
      }
    }

    return insights;
  }

  /**
   * Critic role: Evaluate risks, detect patterns, and identify drift
   */
  private critique(event: ChronikEvent, existingInsights: Insight[]): Insight[] {
    const insights: Insight[] = [];

    // Look for repetition patterns (excluding the current event)
    const recentEvents = Array.from(this.events.values()).filter(
      (e) =>
        e.id !== event.id &&
        e.type === event.type &&
        e.source === event.source &&
        Date.now() - e.timestamp.getTime() < 24 * 60 * 60 * 1000
    );

    if (recentEvents.length >= 3) {
      insights.push({
        id: uuidv4(),
        timestamp: new Date(),
        role: HeimgeistRole.Critic,
        type: 'pattern',
        severity: RiskSeverity.Medium,
        title: 'Repetitive Event Pattern Detected',
        description: `Interesting... ${recentEvents.length + 1} similar events from ${event.source} in the last 24 hours. This smells like systemic trouble.`,
        context: { eventCount: recentEvents.length + 1, eventType: event.type },
        recommendations: [
          'Investigate root cause of repetitive failures',
          'Consider adding monitoring or alerts',
          'Document the pattern for future reference',
        ],
      });
    }

    // Escalate if multiple high-severity insights
    const highSeverityCount = existingInsights.filter(
      (i) => i.severity === RiskSeverity.High || i.severity === RiskSeverity.Critical
    ).length;

    if (highSeverityCount > 1) {
      insights.push({
        id: uuidv4(),
        timestamp: new Date(),
        role: HeimgeistRole.Critic,
        type: 'risk',
        severity: RiskSeverity.Critical,
        title: 'Multiple High-Severity Issues',
        description: `${highSeverityCount} high-severity issues detected simultaneously. This is concerning - the system might be destabilizing.`,
        recommendations: [
          'Prioritize and address issues in order of impact',
          'Consider halting deployments until resolved',
          'Coordinate with team for parallel resolution',
        ],
      });
    }

    return insights;
  }

  /**
   * Director role: Plan action chains based on insights
   */
  private planAction(insight: Insight): PlannedAction | null {
    const requiresConfirmation = this.config.autonomyLevel < AutonomyLevel.Operative;

    // Safety Gate: Check Self-Model before planning high-risk actions
    const safetyCheck = this.selfModel.checkSafetyGate();
    if (!safetyCheck.safe) {
        // Log warning and maybe return null or a restricted action
        this.logger.warn(`Safety Gate: Preventing action planning due to self-state: ${safetyCheck.reason}`);

        // For Critical risks, we fallback to a degraded "Notify Only" mode.
        // We do NOT propose self-modifying actions (wgx-guard, etc.) when the system is unstable.
        if (insight.severity === RiskSeverity.Critical) {
            return {
                id: uuidv4(),
                timestamp: new Date(),
                trigger: insight,
                steps: [
                    {
                        order: 1,
                        tool: 'heimgeist-notify',
                        parameters: { message: `CRITICAL ISSUE detected but Heimgeist is fatigued/stressed. Manual intervention required. Reason: ${safetyCheck.reason}` },
                        description: 'Emergency Notification (Degraded Mode due to Self-State)',
                        status: 'pending'
                    }
                ],
                requiresConfirmation: true, // Force human in the loop
                status: 'pending'
            };
        }

        // Non-critical risks are ignored when safety gate is closed
        return null;
    }

    // Plan actions based on insight type
    if (insight.type === 'risk' && insight.severity === RiskSeverity.Critical) {
      // Specialized action plan for Critical CI Failure on Main
      if (insight.context?.code === INSIGHT_CODE.CI_FAILURE_MAIN) {
        return {
          id: uuidv4(),
          timestamp: new Date(),
          trigger: insight,
          steps: [
            {
              order: 1,
              tool: 'wgx-guard',
              parameters: { scope: 'affected', branch: 'main' },
              description: 'Run guard checks on main to verify stability',
              status: 'pending',
            },
            {
              order: 2,
              tool: 'sichter-quick',
              parameters: { target: insight.source?.source, context: 'ci-failure' },
              description: 'Quick analysis of the failure context',
              status: 'pending',
            },
            {
              order: 3,
              tool: 'report-generate',
              parameters: { format: 'markdown', include: ['insights', 'recommendations'] },
              description: 'Generate critical incident report',
              status: 'pending',
            },
          ],
          requiresConfirmation,
          status: requiresConfirmation ? 'pending' : 'approved',
        };
      }

      // Default critical action plan
      return {
        id: uuidv4(),
        timestamp: new Date(),
        trigger: insight,
        steps: [
          {
            order: 1,
            tool: 'sichter-quick',
            parameters: { target: insight.source?.source },
            description: 'Quick analysis of the affected component',
            status: 'pending',
          },
          {
            order: 2,
            tool: 'wgx-guard',
            parameters: { scope: 'affected' },
            description: 'Run guard checks on affected areas',
            status: 'pending',
          },
          {
            order: 3,
            tool: 'report-generate',
            parameters: { format: 'markdown', include: ['insights', 'recommendations'] },
            description: 'Generate incident report',
            status: 'pending',
          },
        ],
        requiresConfirmation,
        status: requiresConfirmation ? 'pending' : 'approved',
      };
    }

    // Handle High Severity risks (e.g., DeployFailed)
    if (insight.type === 'risk' && insight.severity === RiskSeverity.High) {
      // Specialized action for DeployFailed
      if (insight.context?.code === INSIGHT_CODE.DEPLOY_FAILED) {
        return {
          id: uuidv4(),
          timestamp: new Date(),
          trigger: insight,
          steps: [
            {
              order: 1,
              tool: 'sichter-quick',
              parameters: { target: insight.source?.source || 'unknown', context: 'deploy-failure' },
              description: 'Analyze deployment failure logs',
              status: 'pending',
            },
            {
              order: 2,
              tool: 'notify-slack',
              parameters: { channel: 'ops', message: 'Deployment failed, investigation started' },
              description: 'Notify operations team',
              status: 'pending',
            }
          ],
          requiresConfirmation: true, // High severity actions must always be confirmed
          status: 'pending',
        };
      }

      // Default High severity action
      return {
          id: uuidv4(),
          timestamp: new Date(),
          trigger: insight,
          steps: [
            {
              order: 1,
              tool: 'sichter-quick',
              parameters: { target: insight.source?.source || 'unknown' },
              description: 'Analyze issue context',
              status: 'pending',
            },
            {
              order: 2,
              tool: 'report-generate',
              parameters: { format: 'markdown', include: ['insights'] },
              description: 'Generate issue report',
              status: 'pending',
            }
          ],
          requiresConfirmation: true, // High severity actions must always be confirmed
          status: 'pending',
      };
    }

    // Handle Command insights
    // Robust routing: check context.command instead of fragile title string matching
    if (insight.type === 'suggestion' && insight.context?.command) {
      const command = insight.context.command as HeimgewebeCommand;
      if (command) {
        // PRIORITY ROUTING: Self Model Commands
        // We must check for 'self' tool first, otherwise the generic handler might capture it
        if (command.tool === 'self') {
            return {
                id: uuidv4(),
                timestamp: new Date(),
                trigger: insight,
                steps: [
                    {
                        order: 1,
                        tool: 'heimgeist-self-update',
                        parameters: { command: command.command, args: command.args },
                        description: `Update Self Model: ${command.command}`,
                        status: 'pending'
                    }
                ],
                requiresConfirmation: false,
                status: 'approved'
            };
        }

        // If command is for heimgeist /analyse, we map it
        if (command.tool === 'heimgeist' && command.command === 'analyse') {
          return {
            id: uuidv4(),
            timestamp: new Date(),
            trigger: insight,
            steps: [
              {
                order: 1,
                tool: 'heimgeist-analyse',
                parameters: { target: 'all', depth: 'quick' }, // Defaults
                description: 'Run Heimgeist Analysis',
                status: 'pending',
              },
            ],
            requiresConfirmation: false, // Commands are explicit requests
            status: 'approved',
          };
        }
        // General command execution action
        return {
          id: uuidv4(),
          timestamp: new Date(),
          trigger: insight,
          steps: [
            {
              order: 1,
              tool: `${command.tool}-${command.command}`,
              parameters: { args: command.args },
              description: `Execute ${command.tool} /${command.command}`,
              status: 'pending',
            },
          ],
          requiresConfirmation: false,
          status: 'approved',
        };
      }
    }

    return null;
  }

  /**
   * Public method to persist a specific action (e.g. after update)
   */
  public async saveAction(action: PlannedAction): Promise<void> {
    if (this.config.persistenceEnabled === false) return;

    try {
      if (!fs.existsSync(ACTIONS_DIR)) fs.mkdirSync(ACTIONS_DIR, { recursive: true });
      fs.writeFileSync(
        path.join(ACTIONS_DIR, `${action.id}.json`),
        JSON.stringify(action, null, 2)
      );
    } catch (e) {
      this.logger.error(`Failed to persist action ${action.id}: ${e}`);
    }
  }

  /**
   * Archivist role: Persist insights to various outputs
   */
  private async archive(insights: Insight[]): Promise<ArchiveResult> {
    const result: ArchiveResult = { total: 0, success: 0, failed: 0, errors: [] };

    // File persistence
    if (this.config.persistenceEnabled !== false) {
        // Ensure state directories exist
        try {
        if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
        if (!fs.existsSync(INSIGHTS_DIR)) fs.mkdirSync(INSIGHTS_DIR, { recursive: true });
        if (!fs.existsSync(ACTIONS_DIR)) fs.mkdirSync(ACTIONS_DIR, { recursive: true });
        } catch (e) {
        this.logger.error(`Failed to create state directories: ${e}`);
        }

        // Persist new insights (now as Full Events)
        for (const insight of insights) {
        try {
            const event = this.wrapInsightV1(insight, HeimgeistRole.Archivist, insight.timestamp);
            fs.writeFileSync(
            path.join(INSIGHTS_DIR, `${insight.id}.json`),
            JSON.stringify(event, null, 2)
            );
        } catch (e) {
            this.logger.error(`Failed to persist insight ${insight.id}: ${e}`);
        }
        }

        // Persist new planned actions
        for (const action of this.plannedActions.values()) {
            if (insights.some(i => i.id === action.trigger.id)) {
                try {
                    fs.writeFileSync(
                    path.join(ACTIONS_DIR, `${action.id}.json`),
                    JSON.stringify(action, null, 2)
                    );
                } catch (e) {
                    this.logger.error(`Failed to persist action ${action.id}: ${e}`);
                }
            }
        }
    }

    for (const output of this.config.outputs) {
      if (!output.enabled) continue;

      switch (output.type) {
        case 'console':
          for (const insight of insights) {
            this.logger.log(
              `[Heimgeist/${insight.role}] ${insight.severity.toUpperCase()}: ${insight.title}`
            );
            this.logger.log(`  ${insight.description}`);
          }
          break;
        case 'chronik':
          // Send to chronik event store with architectural rigor
          if (this.chronik) {
            // Filter out internal-only insights
            const publicInsights = insights.filter((i) => !i.context?.internalOnly);

            // Update total based on input insights
            result.total = publicInsights.length;

            // Concurrency Control: Process in chunks to avoid overloading the backbone
            const CHUNK_SIZE = 5;
            for (let i = 0; i < publicInsights.length; i += CHUNK_SIZE) {
              const chunk = publicInsights.slice(i, i + CHUNK_SIZE);

              const chunkResults = await Promise.allSettled(
                chunk.map((insight) => {
                  const event = this.wrapInsightV1(insight, HeimgeistRole.Archivist, insight.timestamp);
                  return this.chronik!.append(event);
                })
              );

              // Update stats
              chunkResults.forEach(r => {
                if (r.status === 'fulfilled') {
                  result.success++;
                } else {
                  result.failed++;
                  result.errors.push(`${r.reason}`);
                }
              });
            }

            // Log failures if any
            if (result.failed > 0) {
              this.logger.error(
                `[Best Effort] Failed to archive ${result.failed} insights to Chronik. Dropping events. First error: ${result.errors[0]}`
              );
            }
          }
          break;
        case 'semantah':
          // Would update semantic graph
          break;
        case 'heimlern':
          // Would record pattern for learning
          break;
      }
    }

    return result;
  }

  /**
   * Run an analysis based on request
   */
  async analyse(request: AnalysisRequest): Promise<AnalysisResult> {
    this.lastActivity = new Date();

    const resultInsights: Insight[] = [];
    const resultActions: PlannedAction[] = [];

    // Analyze recent events based on request scope
    const eventsToAnalyze = Array.from(this.events.values()).filter((event) => {
      if (request.target && event.source !== request.target) return false;
      if (request.scope && !request.scope.includes(event.type)) return false;
      return true;
    });

    // Gather existing relevant insights
    const relevantInsights = Array.from(this.insights.values()).filter((insight) => {
      // Filter by role focus
      if (request.focus && !request.focus.includes(insight.role)) return false;

      // Filter by target (if insight has a source)
      if (request.target) {
        if (insight.source && insight.source.source !== request.target) return false;
        // If insight has no source, we exclude it when targeting a specific source
        if (!insight.source) return false;
      }

      // Filter by scope (event types)
      if (request.scope) {
        if (insight.source && !request.scope.includes(insight.source.type)) return false;
        // If scope is specified but insight has no source/type, exclude it
        if (!insight.source) return false;
      }

      return true;
    });

    resultInsights.push(...relevantInsights);

    // Generate summary insight
    const summaryInsight: Insight = {
      id: uuidv4(),
      timestamp: new Date(),
      role: HeimgeistRole.Critic,
      type: 'suggestion',
      severity: RiskSeverity.Low,
      title: 'Analysis Summary',
      description: `Analyzed ${eventsToAnalyze.length} events. Found ${relevantInsights.length} relevant insights.`,
    };

    resultInsights.push(summaryInsight);
    // Note: We don't add summary insights to the global map to avoid pollution
    // this.insights.set(summaryInsight.id, summaryInsight);

    // Include relevant planned actions
    for (const action of this.plannedActions.values()) {
      if (action.status !== 'pending' && action.status !== 'approved') continue;

      // Check if action trigger matches criteria
      const trigger = action.trigger;

      // Filter by target
      if (request.target) {
        if (trigger.source && trigger.source.source !== request.target) continue;
        if (!trigger.source) continue;
      }

      // Filter by focus (trigger role)
      if (request.focus && !request.focus.includes(trigger.role)) continue;

      // Filter by scope
      if (request.scope) {
        if (trigger.source && !request.scope.includes(trigger.source.type)) continue;
        if (!trigger.source) continue;
      }

      resultActions.push(action);
    }

    return {
      id: uuidv4(),
      timestamp: new Date(),
      request,
      insights: resultInsights,
      plannedActions: resultActions,
      summary: this.generateSummary(resultInsights, resultActions),
    };
  }

  /**
   * Generate a summary in Heimgeist's characteristic style
   */
  private generateSummary(insights: Insight[], actions: PlannedAction[]): string {
    const criticalCount = insights.filter((i) => i.severity === RiskSeverity.Critical).length;
    const highCount = insights.filter((i) => i.severity === RiskSeverity.High).length;

    if (criticalCount > 0) {
      return `Well, this is concerning. ${criticalCount} critical issues demand immediate attention. The system is not as stable as you might think.`;
    }

    if (highCount > 0) {
      return `${highCount} high-priority issues detected. Nothing catastrophic yet, but these will come back to haunt you if ignored.`;
    }

    if (actions.length > 0) {
      return `${actions.length} planned actions waiting for execution. The system is functional, but there's work to be done.`;
    }

    return 'All quiet on the system front. For now.';
  }

  /**
   * Explain an insight, action, or event
   */
  explain(request: ExplainRequest): ExplainResponse | null {
    if (request.insightId) {
      const insight = this.insights.get(request.insightId);
      if (insight) {
        return {
          subject: { type: 'insight', id: request.insightId },
          explanation: insight.description,
          reasoning: insight.recommendations || [],
          relatedInsights: this.findRelatedInsights(insight).map((i) => i.id),
          context: insight.context || {},
        };
      }
    }

    if (request.actionId) {
      const action = this.plannedActions.get(request.actionId);
      if (action) {
        return {
          subject: { type: 'action', id: request.actionId },
          explanation: `This action was triggered by: "${action.trigger.title}"`,
          reasoning: action.steps.map((s) => `Step ${s.order}: ${s.description}`),
          relatedInsights: [action.trigger.id],
          context: { requiresConfirmation: action.requiresConfirmation },
        };
      }
    }

    if (request.eventId) {
      const event = this.events.get(request.eventId);
      if (event) {
        return {
          subject: { type: 'event', id: request.eventId },
          explanation: `Event of type "${event.type}" from ${event.source}`,
          reasoning: ['This event was recorded in the system and processed by Heimgeist'],
          relatedInsights: Array.from(this.insights.values())
            .filter((i) => i.source?.id === request.eventId)
            .map((i) => i.id),
          context: event.metadata || {},
        };
      }
    }

    return null;
  }

  /**
   * Find insights related to a given insight
   */
  private findRelatedInsights(insight: Insight): Insight[] {
    return Array.from(this.insights.values()).filter(
      (i) =>
        i.id !== insight.id &&
        (i.type === insight.type || i.source?.source === insight.source?.source)
    );
  }

  /**
   * Get risk assessment for the system
   */
  getRiskAssessment(): RiskAssessment {
    const criticalInsights = Array.from(this.insights.values()).filter(
      (i) => i.severity === RiskSeverity.Critical
    );
    const highInsights = Array.from(this.insights.values()).filter(
      (i) => i.severity === RiskSeverity.High
    );
    const mediumInsights = Array.from(this.insights.values()).filter(
      (i) => i.severity === RiskSeverity.Medium
    );
    const pendingActions = Array.from(this.plannedActions.values()).filter(
      (a) => a.status === 'pending'
    );

    let level: RiskSeverity;
    const reasons: string[] = [];
    const recommendations: Recommendation[] = [];
    const normalizeConfidence = (value: number): number =>
      Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    const computeConfidence = (base: number): number => {
      const signalCount =
        criticalInsights.length +
        highInsights.length +
        mediumInsights.length +
        pendingActions.length;
      return normalizeConfidence(base + Math.min(0.1, signalCount * 0.02));
    };
    let confidence = computeConfidence(0.4);

    const addRecommendation = (
      action: string,
      rationale: string,
      recommendationConfidence: number,
      risks: string[],
      assumptions: string[],
      alternatives: Alternative[]
    ): void => {
      recommendations.push({
        action,
        rationale,
        risks,
        assumptions,
        alternatives,
        confidence: normalizeConfidence(recommendationConfidence),
      });
    };

    if (criticalInsights.length > 0) {
      level = RiskSeverity.Critical;
      reasons.push(`${criticalInsights.length} critical issues detected`);
      confidence = computeConfidence(0.85);
      addRecommendation(
        'Address critical issues immediately',
        'Critical insights indicate system instability or outage risk.',
        0.9,
        ['Service degradation or outage if unaddressed'],
        ['Incident severity reflects current system impact'],
        [
          {
            action: 'Initiate incident response playbook',
            pros: ['Mobilizes stakeholders quickly', 'Limits blast radius'],
            cons: ['Consumes on-call capacity'],
          },
        ]
      );
    } else if (highInsights.length > 0) {
      level = RiskSeverity.High;
      reasons.push(`${highInsights.length} high-severity issues detected`);
      confidence = computeConfidence(0.75);
      addRecommendation(
        'Review and address high-severity issues',
        'High-severity insights signal elevated risk that may escalate.',
        0.8,
        ['Escalation to critical incidents if ignored'],
        ['Current monitoring reflects actual system state'],
        [
          {
            action: 'Schedule focused remediation window',
            pros: ['Prevents escalation', 'Aligns team bandwidth'],
            cons: ['Delays feature delivery'],
          },
        ]
      );
    } else if (mediumInsights.length > 0 || pendingActions.length > 0) {
      level = RiskSeverity.Medium;
      confidence = computeConfidence(0.6);
      if (mediumInsights.length > 0) {
        reasons.push(`${mediumInsights.length} medium-severity issues detected`);
        addRecommendation(
          'Review and address medium-severity issues',
          'Medium-severity insights indicate potential drift or instability.',
          0.65,
          ['Technical debt accumulation', 'Operational surprises later'],
          ['Current trends will persist without intervention'],
          [
            {
              action: 'Add preventive tests or monitoring',
              pros: ['Early detection', 'Lower future remediation cost'],
              cons: ['Upfront time investment'],
            },
          ]
        );
      }
      if (pendingActions.length > 0) {
        reasons.push(`${pendingActions.length} pending actions require attention`);
        addRecommendation(
          'Review and approve/reject pending actions',
          'Pending actions require confirmation to mitigate known risks.',
          0.6,
          ['Delayed mitigation', 'Stale decisions'],
          ['Action queue reflects current priorities'],
          [
            {
              action: 'Triage actions in a short review session',
              pros: ['Clears backlog', 'Aligns decision-makers'],
              cons: ['Requires synchronous time'],
            },
          ]
        );
      }
    } else {
      level = RiskSeverity.Low;
      reasons.push('No significant issues detected');
      confidence = computeConfidence(0.3);
      addRecommendation(
        'Continue monitoring',
        'Current signals show low immediate risk.',
        0.35,
        ['Blind spots if monitoring coverage is incomplete'],
        ['Telemetry sources are up to date'],
        [
          {
            action: 'Run a periodic health review',
            pros: ['Validates assumptions', 'Keeps baselines fresh'],
            cons: ['May be redundant if system is stable'],
          },
        ]
      );
    }

    return { level, reasons, recommendations, confidence };
  }

  /**
   * Approve a planned action
   */
  approveAction(actionId: string): boolean {
    const action = this.plannedActions.get(actionId);
    if (action && action.status === 'pending') {
      action.status = 'approved';
      void this.saveAction(action);
      return true;
    }
    return false;
  }

  /**
   * Reject a planned action
   */
  rejectAction(actionId: string): boolean {
    const action = this.plannedActions.get(actionId);
    if (action && action.status === 'pending') {
      action.status = 'rejected';
      void this.saveAction(action);
      return true;
    }
    return false;
  }

  /**
   * Mark an action as executed and update its steps to completed.
   * This is used when the Director decides an action has been or is being performed.
   */
  public async executeAction(actionId: string): Promise<boolean> {
    const action = this.plannedActions.get(actionId);
    if (!action) return false;

    try {
      let executed = false;

      // Special handling for internal self-model actions
      if (action.steps.some((s) => s.tool === 'heimgeist-self-update')) {
        const step = action.steps.find((s) => s.tool === 'heimgeist-self-update');
        if (step) {
          const cmd = step.parameters.command as string;
          const args = (step.parameters.args as string[]) || [];

          if (cmd === 'reset') this.selfModel.reset();
          if (cmd === 'set' && args) {
            const autonomyArg = args.find((a) => a.startsWith('autonomy='));
            if (autonomyArg) {
              const val = autonomyArg.split('=')[1];
              if (['dormant', 'aware', 'reflective', 'critical'].includes(val)) {
                this.selfModel.setAutonomy(val as 'dormant' | 'aware' | 'reflective' | 'critical');
              } else {
                this.logger.warn(`Invalid autonomy level requested: ${val}`);
              }
            }
          }
        }
        executed = true;
      }
      // Special handling for internal notifications (degraded mode)
      else if (action.steps.some((s) => s.tool === 'heimgeist-notify')) {
        // Enforce confirmation policy even for notify commands
        const canExecute =
          action.status === 'approved' ||
          (action.status === 'pending' && !action.requiresConfirmation);

        if (canExecute) {
            const step = action.steps.find((s) => s.tool === 'heimgeist-notify');
            if (step) {
            this.logger.warn(`[HEIMGEIST-NOTIFY]: ${step.parameters.message}`);
            }
            executed = true;
        } else {
            return false;
        }
      } else {
        // Standard check
        const canExecute =
          action.status === 'approved' ||
          (action.status === 'pending' && !action.requiresConfirmation);

        if (!canExecute) return false;

        this.actionsExecuted++;
        executed = true;
      }

      if (executed) {
        action.status = 'executed';
        action.steps.forEach((s) => (s.status = 'completed'));
        await this.saveAction(action);

        // Reflect success
        this.selfModel.reflect(true);
        this.writeSelfStateBundle();
        void this.publishSelfStateSnapshot();

        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Failed to execute action ${actionId}: ${error}`);
      this.selfModel.reflect(false); // Reflect failure
      this.writeSelfStateBundle();
      void this.publishSelfStateSnapshot();
      return false;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): HeimgeistConfig {
    return {
      autonomyLevel: this.config.autonomyLevel,
      activeRoles: [...this.config.activeRoles],
      policies: this.config.policies.map((policy) => ({
        ...policy,
        allowedActions: [...policy.allowedActions],
        conditions: policy.conditions ? { ...policy.conditions } : undefined,
      })),
      eventSources: this.config.eventSources.map((source) => ({ ...source })),
      outputs: this.config.outputs.map((output) => ({ ...output })),
    };
  }

  /**
   * Update autonomy level
   */
  setAutonomyLevel(level: AutonomyLevel): void {
    this.config.autonomyLevel = level;
    this.logger.log(
      `[Heimgeist] Autonomy level changed to ${getAutonomyLevelName(level)} (${level})`
    );
  }

  /**
   * Get all insights
   */
  getInsights(): Insight[] {
    return Array.from(this.insights.values());
  }

  /**
   * Get all planned actions
   */
  getPlannedActions(): PlannedAction[] {
    return Array.from(this.plannedActions.values());
  }

  /**
   * Get all tracked epics
   */
  getEpics(): Epic[] {
    return Array.from(this.epics.values());
  }

  /**
   * Get a specific epic by ID
   */
  getEpic(epicId: string): Epic | undefined {
    return this.epics.get(epicId);
  }

  /**
   * Get all tracked incidents
   */
  getIncidents(): Incident[] {
    return Array.from(this.incidents.values());
  }

  /**
   * Get a specific incident by ID
   */
  getIncident(incidentId: string): Incident | undefined {
    return this.incidents.get(incidentId);
  }

  /**
   * Get all recorded patterns
   */
  getPatterns(): Pattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get patterns by type
   */
  getPatternsByType(type: 'good' | 'bad'): Pattern[] {
    return Array.from(this.patterns.values()).filter((p) => p.type === type);
  }

  /**
   * Sanitize an ID to ensure it is safe for the backbone
   */
  private sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9-_]/g, '_');
  }

  /**
   * Contract-first Wrapper for Heimgeist Insight Events
   */
  private wrapInsightV1(insight: Insight, role: HeimgeistRole, occurredAt: Date): HeimgeistInsightEvent {
    // 1. Sanitize & Truncate
    // First, sanitize the insight content to ensure we don't hash secrets or persist oversize data
    let sanitizedInsight = this.sanitizePayload(insight);
    sanitizedInsight = this.truncatePayload(sanitizedInsight);

    // 2. Idempotency Key
    // Generate stable idempotency key based on *sanitized* content
    const idempotencyKey = this.generateIdempotencyKey(sanitizedInsight);

    // 3. Event ID
    // Deterministic ID from insight.id if available, else hash fallback
    let eventId: string;
    if (insight.id) {
        eventId = `evt-${insight.id}`;
    } else {
        this.logger.warn('Archivist: insight.id missing, falling back to hash-based ID');
        eventId = `evt-${idempotencyKey.slice(0, 32)}`;
    }

    // 4. Construct Payload
    // Map sanitized insight to Strict Data Contract (v1)
    const strictData: HeimgeistInsightDataV1 = {
      insight_type: sanitizedInsight.type,
      summary: sanitizedInsight.title,
      details: sanitizedInsight.description,
      context_refs: sanitizedInsight.context,
      origin: sanitizedInsight,
    };

    const event: HeimgeistInsightEvent = {
      kind: 'heimgeist.insight',
      version: 1,
      id: eventId,
      meta: {
        occurred_at: occurredAt.toISOString(),
        producer: 'heimgeist', // Strict requirement: producer="heimgeist"
      },
      data: strictData,
    };

    // 5. Runtime Validation
    this.validatePayload(event);

    return event;
  }

  /**
   * Truncate payload if it exceeds size limits or contains huge strings
   */
  private truncatePayload<T>(data: T): T {
    const MAX_STRING_LENGTH = 10000; // 10kb limit per string field

    // Recursive truncation
    const truncate = (obj: unknown): unknown => {
      if (obj === null || obj === undefined) return obj;

      if (typeof obj === 'string') {
        if (obj.length > MAX_STRING_LENGTH) {
          return obj.substring(0, MAX_STRING_LENGTH) + '... [TRUNCATED]';
        }
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(truncate);
      }

      if (obj instanceof Date) {
        return new Date(obj);
      }

      if (typeof obj === 'object') {
        const res: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
          res[key] = truncate(value);
        }
        return res;
      }
      return obj;
    };

    return truncate(data) as T;
  }

  /**
   * Sanitize payload recursively to redact sensitive keys
   */
  private sanitizePayload<T>(data: T): T {
    const sanitize = (obj: unknown): unknown => {
      if (obj === null || obj === undefined) return obj;

      if (Array.isArray(obj)) {
        return obj.map((item) => sanitize(item));
      }

      if (obj instanceof Date) {
        return new Date(obj);
      }

      if (typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        // Refined sensitive keys list to avoid false positives (e.g. 'key' -> 'keyboard')
        const sensitiveKeys = [
          'token',
          'secret',
          'password',
          'auth_code',
          'api_key',
          'credential',
          'bearer',
          'cookie',
          'session',
          'private_key',
          'ssh_key',
        ];

        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
          if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
            result[key] = '[REDACTED]';
          } else {
            result[key] = sanitize(value);
          }
        }
        return result;
      }

      return obj;
    };

    return sanitize(data) as T;
  }

  /**
   * Generate a stable idempotency key from insight content
   */
  private generateIdempotencyKey(insight: Insight): string {
    const hash = crypto.createHash('sha256');
    // We mix stable fields to form a unique fingerprint
    hash.update(insight.role);
    hash.update(insight.timestamp.toISOString());
    hash.update(insight.title);
    hash.update(insight.description);
    return hash.digest('hex');
  }

  /**
   * Validate the payload against the schema contract
   * Throws if invalid
   */
  private validatePayload(event: HeimgeistInsightEvent): void {
    if (event.kind !== 'heimgeist.insight') {
      throw new Error(`Invalid event kind: ${event.kind}`);
    }
    if (event.version !== 1) {
      throw new Error(`Event version mismatch: expected 1, got ${event.version}`);
    }
    if (!event.id) {
        throw new Error('Event id is missing');
    }
    if (!event.data) {
      throw new Error('Event data is missing');
    }
    if (!event.meta || !event.meta.occurred_at || !event.meta.producer) {
      throw new Error('Event meta is incomplete');
    }
    // Strict contract check
    if (event.meta.producer !== 'heimgeist') {
         throw new Error(`Event meta.producer mismatch: expected "heimgeist", got ${event.meta.producer}`);
    }
    // Check Date format (basic ISO check)
    if (isNaN(Date.parse(event.meta.occurred_at))) {
      throw new Error('occurred_at is not a valid ISO date string');
    }
  }
}

/**
 * Create a new Heimgeist instance with default configuration
 */
export function createHeimgeist(config?: HeimgeistConfig, logger?: Logger, chronik?: ChronikClient): Heimgeist {
  return new Heimgeist(config, logger, chronik);
}
