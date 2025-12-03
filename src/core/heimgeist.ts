import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import {
  HeimgeistConfig,
  HeimgeistRole,
  AutonomyLevel,
  ChronikEvent,
  EventType,
  Insight,
  PlannedAction,
  AnalysisRequest,
  AnalysisResult,
  StatusResponse,
  ExplainRequest,
  ExplainResponse,
  RiskSeverity,
  EventType,
  Epic,
  Incident,
  Pattern,
  HeimgewebeCommand,
} from '../types';
import { loadConfig, getAutonomyLevelName } from '../config';
import { STATE_DIR, INSIGHTS_DIR, ACTIONS_DIR } from '../config/state-paths';
import { Logger, defaultLogger } from './logger';
import { CommandParser } from './command-parser';

/**
 * Insight context codes for identifying specific types of issues
 */
const INSIGHT_CODE = {
  CI_FAILURE_MAIN: 'ci_failure_main',
  CI_FAILURE_GENERIC: 'ci_failure_generic',
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

  constructor(config?: HeimgeistConfig, logger: Logger = defaultLogger) {
    // console.log('Heimgeist constructor config:', config);
    this.config = config || loadConfig();
    // console.log('Heimgeist effective config:', this.config);
    this.logger = logger;
    this.startTime = new Date();

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
            const insight = JSON.parse(content) as Insight;
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
    };
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
      const observations = this.observe(event);
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
      await this.archive(newInsights);
    }

    return newInsights;
  }

  /**
   * Observer role: Analyze events and extract observations
   */
  private observe(event: ChronikEvent): Insight[] {
    const insights: Insight[] = [];

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

    // Handle Command insights
    if (insight.type === 'suggestion' && insight.title.startsWith('Command Received:')) {
      const command = insight.context?.command as HeimgewebeCommand;
      if (command) {
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
  private async archive(insights: Insight[]): Promise<void> {
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

        // Persist new insights
        for (const insight of insights) {
        try {
            fs.writeFileSync(
            path.join(INSIGHTS_DIR, `${insight.id}.json`),
            JSON.stringify(insight, null, 2)
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
          // Would send to chronik event store
          break;
        case 'semantah':
          // Would update semantic graph
          break;
        case 'heimlern':
          // Would record pattern for learning
          break;
      }
    }
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

    // Generate summary insight
    const summaryInsight: Insight = {
      id: uuidv4(),
      timestamp: new Date(),
      role: HeimgeistRole.Critic,
      type: 'suggestion',
      severity: RiskSeverity.Low,
      title: 'Analysis Summary',
      description: `Analyzed ${eventsToAnalyze.length} events. ${this.insights.size} insights currently tracked.`,
    };

    resultInsights.push(summaryInsight);
    // Note: We don't add summary insights to the global map to avoid pollution
    // this.insights.set(summaryInsight.id, summaryInsight);

    // Include relevant planned actions
    for (const action of this.plannedActions.values()) {
      if (action.status === 'pending' || action.status === 'approved') {
        resultActions.push(action);
      }
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
  getRiskAssessment(): {
    level: RiskSeverity;
    reasons: string[];
    recommendations: string[];
  } {
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
    const recommendations: string[] = [];

    if (criticalInsights.length > 0) {
      level = RiskSeverity.Critical;
      reasons.push(`${criticalInsights.length} critical issues detected`);
      recommendations.push('Address critical issues immediately');
    } else if (highInsights.length > 0) {
      level = RiskSeverity.High;
      reasons.push(`${highInsights.length} high-severity issues detected`);
      recommendations.push('Review and address high-severity issues');
    } else if (mediumInsights.length > 0 || pendingActions.length > 0) {
      level = RiskSeverity.Medium;
      if (mediumInsights.length > 0) {
        reasons.push(`${mediumInsights.length} medium-severity issues detected`);
        recommendations.push('Review and address medium-severity issues');
      }
      if (pendingActions.length > 0) {
        reasons.push(`${pendingActions.length} pending actions require attention`);
        recommendations.push('Review and approve/reject pending actions');
      }
    } else {
      level = RiskSeverity.Low;
      reasons.push('No significant issues detected');
      recommendations.push('Continue monitoring');
    }

    return { level, reasons, recommendations };
  }

  /**
   * Approve a planned action
   */
  approveAction(actionId: string): boolean {
    const action = this.plannedActions.get(actionId);
    if (action && action.status === 'pending') {
      action.status = 'approved';
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
      return true;
    }
    return false;
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
}

/**
 * Create a new Heimgeist instance with default configuration
 */
export function createHeimgeist(config?: HeimgeistConfig, logger?: Logger): Heimgeist {
  return new Heimgeist(config, logger);
}
