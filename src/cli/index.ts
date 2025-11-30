#!/usr/bin/env node

import { Command } from 'commander';
import { createHeimgeist, Heimgeist } from '../core';
import { getAutonomyLevelName } from '../config';
import { startServer } from '../api';
import { RiskSeverity, EventType, ChronikEvent } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { defaultLogger } from '../core/logger';

const program = new Command();

// Global Heimgeist instance for CLI commands
let heimgeist: Heimgeist;

function getHeimgeist(): Heimgeist {
  if (!heimgeist) {
    heimgeist = createHeimgeist(undefined, defaultLogger);
  }
  return heimgeist;
}

program.name('heimgeist').description('Heimgeist - System Self-Reflection Engine').version('1.0.0');

/**
 * Status command
 */
program
  .command('status')
  .description('Get current Heimgeist status')
  .action(() => {
    const hg = getHeimgeist();
    const status = hg.getStatus();

    console.log('\n=== Heimgeist Status ===\n');
    console.log(`Version:         ${status.version}`);
    console.log(
      `Autonomy Level:  ${getAutonomyLevelName(status.autonomyLevel)} (${status.autonomyLevel})`
    );
    console.log(`Active Roles:    ${status.activeRoles.join(', ')}`);
    console.log(`Uptime:          ${Math.round(status.uptime / 1000)}s`);
    console.log(`Events Processed: ${status.eventsProcessed}`);
    console.log(`Insights:        ${status.insightsGenerated}`);
    console.log(`Actions Executed: ${status.actionsExecuted}`);
    if (status.lastActivity) {
      console.log(`Last Activity:   ${status.lastActivity.toISOString()}`);
    }
    console.log('');
  });

/**
 * Risk command
 */
program
  .command('risk')
  .description('Get current risk assessment')
  .action(() => {
    const hg = getHeimgeist();
    const assessment = hg.getRiskAssessment();

    console.log('\n=== Risk Assessment ===\n');
    console.log(`Risk Level: ${assessment.level.toUpperCase()}`);

    if (assessment.reasons.length > 0) {
      console.log('\nReasons:');
      assessment.reasons.forEach((reason) => console.log(`  • ${reason}`));
    }

    if (assessment.recommendations.length > 0) {
      console.log('\nRecommendations:');
      assessment.recommendations.forEach((rec) => console.log(`  → ${rec}`));
    }

    console.log('');

    // Add some characteristic Heimgeist commentary
    if (assessment.level === RiskSeverity.Critical) {
      console.log('💀 This is not fine. Address immediately.\n');
    } else if (assessment.level === RiskSeverity.High) {
      console.log(
        '⚠️  High risk detected. You might want to look into this before it gets worse.\n'
      );
    } else if (assessment.level === RiskSeverity.Medium) {
      console.log("🔔 Some issues detected. Nothing critical, but don't let them pile up.\n");
    } else {
      console.log('✓ All quiet. For now.\n');
    }
  });

/**
 * Why command - explain an insight or action
 */
program
  .command('why')
  .description('Explain an insight, action, or event')
  .argument('[id]', 'ID of the insight, action, or event')
  .action((id?: string) => {
    const hg = getHeimgeist();

    if (!id) {
      // Show recent insights
      const insights = hg.getInsights();
      if (insights.length === 0) {
        console.log('\nNo insights to explain. The system is quiet.\n');
        return;
      }

      console.log('\n=== Recent Insights ===\n');
      insights.slice(-5).forEach((insight) => {
        console.log(`[${insight.severity.toUpperCase()}] ${insight.title}`);
        console.log(`  ID: ${insight.id}`);
        console.log(`  ${insight.description}`);
        console.log('');
      });

      console.log('Use "heimgeist why <id>" for detailed explanation.\n');
      return;
    }

    // Try to explain the specific ID
    const explanation =
      hg.explain({ insightId: id }) || hg.explain({ actionId: id }) || hg.explain({ eventId: id });

    if (!explanation) {
      console.log(`\nCould not find anything with ID: ${id}\n`);
      return;
    }

    console.log('\n=== Explanation ===\n');
    console.log(`Type: ${explanation.subject.type}`);
    console.log(`ID:   ${explanation.subject.id}`);
    console.log(`\n${explanation.explanation}`);

    if (explanation.reasoning.length > 0) {
      console.log('\nReasoning:');
      explanation.reasoning.forEach((r) => console.log(`  • ${r}`));
    }

    if (explanation.relatedInsights.length > 0) {
      console.log(`\nRelated Insights: ${explanation.relatedInsights.join(', ')}`);
    }

    console.log('');
  });

/**
 * Analyse command
 */
program
  .command('analyse')
  .alias('analyze')
  .description('Run an analysis')
  .option('-t, --target <target>', 'Target to analyze')
  .option('-d, --depth <depth>', 'Analysis depth (quick, deep, full)', 'quick')
  .action(async (options) => {
    const hg = getHeimgeist();

    console.log('\n=== Running Analysis ===\n');
    console.log(`Target: ${options.target || 'all'}`);
    console.log(`Depth:  ${options.depth}`);
    console.log('');

    const result = await hg.analyse({
      target: options.target,
      depth: options.depth,
    });

    console.log(`Analysis ID: ${result.id}`);
    console.log(`Timestamp:   ${result.timestamp.toISOString()}`);
    console.log(`\n${result.summary}\n`);

    if (result.insights.length > 0) {
      console.log('Insights found:');
      result.insights.forEach((insight) => {
        console.log(`  [${insight.severity.toUpperCase()}] ${insight.title}`);
      });
    }

    if (result.plannedActions.length > 0) {
      console.log('\nPlanned Actions:');
      result.plannedActions.forEach((action) => {
        console.log(`  • ${action.trigger.title} (${action.status})`);
      });
    }

    console.log('');
  });

/**
 * Insights command
 */
program
  .command('insights')
  .description('List all insights')
  .option('-s, --severity <level>', 'Filter by severity (low, medium, high, critical)')
  .action((options) => {
    const hg = getHeimgeist();
    let insights = hg.getInsights();

    if (options.severity) {
      insights = insights.filter((i) => i.severity === options.severity);
    }

    if (insights.length === 0) {
      console.log('\nNo insights found. The system appears to be healthy. Suspiciously healthy.\n');
      return;
    }

    console.log(`\n=== Insights (${insights.length}) ===\n`);

    insights.forEach((insight) => {
      const icon = {
        [RiskSeverity.Low]: '📘',
        [RiskSeverity.Medium]: '📙',
        [RiskSeverity.High]: '📕',
        [RiskSeverity.Critical]: '🔥',
      }[insight.severity];

      console.log(`${icon} [${insight.severity.toUpperCase()}] ${insight.title}`);
      console.log(`   Role: ${insight.role} | Type: ${insight.type}`);
      console.log(`   ${insight.description}`);
      console.log(`   ID: ${insight.id}`);
      console.log('');
    });
  });

/**
 * Actions command
 */
program
  .command('actions')
  .description('List planned actions')
  .option('-p, --pending', 'Show only pending actions')
  .action((options) => {
    const hg = getHeimgeist();
    let actions = hg.getPlannedActions();

    if (options.pending) {
      actions = actions.filter((a) => a.status === 'pending');
    }

    if (actions.length === 0) {
      console.log('\nNo planned actions. Either everything is fine, or Heimgeist is being lazy.\n');
      return;
    }

    console.log(`\n=== Planned Actions (${actions.length}) ===\n`);

    actions.forEach((action) => {
      const statusIcon = {
        pending: '⏳',
        approved: '✅',
        rejected: '❌',
        executed: '🚀',
        failed: '💥',
      }[action.status];

      console.log(`${statusIcon} ${action.trigger.title} (${action.status})`);
      console.log(`   ID: ${action.id}`);
      console.log(`   Requires Confirmation: ${action.requiresConfirmation ? 'Yes' : 'No'}`);
      console.log('   Steps:');
      action.steps.forEach((step) => {
        console.log(`     ${step.order}. ${step.description} (${step.status})`);
      });
      console.log('');
    });
  });

/**
 * Approve command
 */
program
  .command('approve')
  .description('Approve a pending action')
  .argument('<id>', 'Action ID to approve')
  .action((id) => {
    const hg = getHeimgeist();
    const success = hg.approveAction(id);

    if (success) {
      console.log(`\n✅ Action ${id} approved.\n`);
    } else {
      console.log(`\n❌ Could not approve action ${id}. It may not exist or is not pending.\n`);
    }
  });

/**
 * Reject command
 */
program
  .command('reject')
  .description('Reject a pending action')
  .argument('<id>', 'Action ID to reject')
  .action((id) => {
    const hg = getHeimgeist();
    const success = hg.rejectAction(id);

    if (success) {
      console.log(`\n❌ Action ${id} rejected.\n`);
    } else {
      console.log(`\n⚠️  Could not reject action ${id}. It may not exist or is not pending.\n`);
    }
  });

/**
 * Config command
 */
program
  .command('config')
  .description('Show or update configuration')
  .option('-l, --level <level>', 'Set autonomy level (0-3)')
  .action((options) => {
    const hg = getHeimgeist();

    if (options.level !== undefined) {
      const level = parseInt(options.level, 10);
      if (isNaN(level) || level < 0 || level > 3) {
        console.log('\n❌ Invalid autonomy level. Must be 0-3.\n');
        return;
      }
      hg.setAutonomyLevel(level);
      console.log(`\n✅ Autonomy level set to ${getAutonomyLevelName(level)} (${level}).\n`);
    }

    const config = hg.getConfig();

    console.log('\n=== Heimgeist Configuration ===\n');
    console.log(
      `Autonomy Level: ${getAutonomyLevelName(config.autonomyLevel)} (${config.autonomyLevel})`
    );
    console.log('\nAutonomy Levels:');
    console.log('  0 - Passive:   Reacts only to direct requests');
    console.log('  1 - Observing: Notes issues, only pings when asked');
    console.log('  2 - Warning:   Proactively analyzes, needs confirmation for actions');
    console.log('  3 - Operative: Can trigger guards, analyses, and propose changes');
    console.log(`\nActive Roles: ${config.activeRoles.join(', ')}`);
    console.log(`\nPolicies: ${config.policies.length}`);
    config.policies.forEach((p) => {
      console.log(`  • ${p.name}: ${p.description}`);
    });
    console.log('');
  });

/**
 * Server command
 */
program
  .command('serve')
  .description('Start the Heimgeist HTTP server')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    console.log('\n🚀 Starting Heimgeist server...\n');
    await startServer(port, getHeimgeist());
  });

/**
 * Event command - for testing
 */
program
  .command('event')
  .description('Submit a test event')
  .argument('<type>', `Event type (${Object.values(EventType).join(', ')})`)
  .option('-s, --source <source>', 'Event source', 'cli')
  .option('--status <status>', 'Event status payload')
  .action(async (type, options) => {
    const hg = getHeimgeist();

    const event: ChronikEvent = {
      id: uuidv4(),
      type: type as EventType,
      timestamp: new Date(),
      source: options.source,
      payload: options.status ? { status: options.status } : {},
    };

    console.log(`\nSubmitting event: ${type} from ${options.source}...`);

    const insights = await hg.processEvent(event);

    console.log(`Event processed. ${insights.length} insight(s) generated.\n`);

    if (insights.length > 0) {
      insights.forEach((insight) => {
        console.log(`  [${insight.severity.toUpperCase()}] ${insight.title}`);
        console.log(`  ${insight.description}\n`);
      });
    }
  });

// Parse arguments
program.parse();
