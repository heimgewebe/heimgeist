import { v4 as uuidv4 } from 'uuid';
import { HeimgewebeCommand } from '../types';

/**
 * Parse a PR comment for heimgewebe commands
 *
 * Supported formats:
 * - @heimgewebe/sichter /quick
 * - @heimgewebe/wgx /guard changed
 * - @heimgewebe/heimlern /pattern-bad sql-injection
 * - @heimgewebe/metarepo /link-epic EPIC-123
 */
export class CommandParser {
  // Matches @heimgewebe/<tool> OR @self (alias)
  private static readonly MENTION_PATTERN = /@(?:heimgewebe\/(\w+)|(self))\s+\/(\S+)(?:\s+([^\n@]*))?/g;

  /**
   * Parse commands from a comment text
   */
  static parseComment(
    text: string,
    context: {
      pr?: number;
      repo: string;
      author: string;
      comment_id?: string;
    }
  ): HeimgewebeCommand[] {
    const commands: HeimgewebeCommand[] = [];
    const matches = text.matchAll(this.MENTION_PATTERN);

    for (const match of matches) {
      // Group 1: tool name from @heimgewebe/<tool>
      // Group 2: "self" from @self alias
      // Group 3: command
      // Group 4: args
      let tool = (match[1] || match[2]) as HeimgewebeCommand['tool'];

      // Normalize 'self' alias if needed, though 'self' is a valid tool name in type
      if (tool === 'self') tool = 'self';

      const command = match[3];
      const argsStr = match[4]?.trim() || '';
      const args = this.parseArgs(argsStr);

      // Validate tool
      if (!this.isValidTool(tool)) {
        continue;
      }

      commands.push({
        id: uuidv4(),
        timestamp: new Date(),
        tool,
        command,
        args,
        context,
      });
    }

    return commands;
  }

  /**
   * Parse arguments string into array, respecting quotes
   */
  private static parseArgs(argsStr: string): string[] {
    const args: string[] = [];
    let currentArg = '';
    let inQuote: string | null = null;
    let escaped = false;

    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];

      if (escaped) {
        currentArg += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (inQuote) {
        if (char === inQuote) {
          inQuote = null;
        } else {
          currentArg += char;
        }
      } else {
        if (char === '"' || char === "'") {
          inQuote = char;
        } else if (/\s/.test(char)) {
          if (currentArg.length > 0) {
            args.push(currentArg);
            currentArg = '';
          }
        } else {
          currentArg += char;
        }
      }
    }

    if (currentArg.length > 0) {
      args.push(currentArg);
    }

    return args;
  }

  /**
   * Check if tool name is valid
   */
  private static isValidTool(tool: string): tool is HeimgewebeCommand['tool'] {
    // Note: 'self' is treated as a shorthand for 'heimgeist' context-aware commands
    // Supported: @heimgewebe/self OR @self
    return ['sichter', 'wgx', 'heimlern', 'metarepo', 'heimgeist', 'self'].includes(tool);
  }

  /**
   * Format a command back to mention syntax
   */
  static formatCommand(command: HeimgewebeCommand): string {
    const args = command.args.length > 0 ? ' ' + command.args.join(' ') : '';
    return `@heimgewebe/${command.tool} /${command.command}${args}`;
  }

  /**
   * Validate command syntax for a specific tool
   */
  static validateCommand(command: HeimgewebeCommand): {
    valid: boolean;
    error?: string;
  } {
    switch (command.tool) {
      case 'sichter':
        return this.validateSichterCommand(command);
      case 'wgx':
        return this.validateWGXCommand(command);
      case 'heimlern':
        return this.validateHeimlernCommand(command);
      case 'metarepo':
        return this.validateMetarepoCommand(command);
      case 'heimgeist':
        return this.validateHeimgeistCommand(command);
      case 'self':
        return this.validateSelfCommand(command);
      default:
        return { valid: false, error: `Unknown tool: ${command.tool}` };
    }
  }

  /**
   * Validate self commands
   */
  private static validateSelfCommand(command: HeimgewebeCommand): {
    valid: boolean;
    error?: string;
  } {
    const validCommands = ['status', 'reflect', 'reset', 'set'];

    if (!validCommands.includes(command.command)) {
      return {
        valid: false,
        error: `Invalid self command. Valid: ${validCommands.join(', ')}`,
      };
    }

    if (command.command === 'set') {
        // e.g. /set autonomy=aware
        // We expect key=value arguments
        if (command.args.length === 0) {
            return { valid: false, error: 'set command requires key=value arguments' };
        }
        // Basic check for autonomy=...
        const autonomyArg = command.args.find(a => a.startsWith('autonomy='));
        if (autonomyArg) {
            const level = autonomyArg.split('=')[1];
            if (!['dormant', 'aware', 'reflective', 'critical'].includes(level)) {
                return { valid: false, error: `Invalid autonomy level: ${level}` };
            }
        }
    }

    // Validation for reflect command (self-tool specific context)
    if (command.command === 'reflect') {
        if (command.args.length > 1) {
            return { valid: false, error: 'reflect command accepts at most one argument' };
        }
        if (command.args.length === 1) {
            const arg = command.args[0];
            const match = arg.match(/^last=(\d+)$/);
            if (!match) {
                return { valid: false, error: 'Invalid reflect argument. Expected last=<n>' };
            }
            const val = parseInt(match[1], 10);
            if (val < 1 || val > 100) {
                return { valid: false, error: 'reflect last=<n> requires an integer between 1 and 100' };
            }
        }
    }

    return { valid: true };
  }

  /**
   * Validate sichter commands
   */
  private static validateSichterCommand(command: HeimgewebeCommand): {
    valid: boolean;
    error?: string;
  } {
    const validCommands = ['quick', 'deep', 'full', 'compare'];

    if (!validCommands.includes(command.command)) {
      return {
        valid: false,
        error: `Invalid sichter command. Valid: ${validCommands.join(', ')}`,
      };
    }

    if (command.command === 'compare' && command.args.length === 0) {
      return {
        valid: false,
        error: 'compare command requires PR number as argument',
      };
    }

    return { valid: true };
  }

  /**
   * Validate wgx commands
   */
  private static validateWGXCommand(command: HeimgewebeCommand): {
    valid: boolean;
    error?: string;
  } {
    const validCommands = ['guard', 'smoke'];

    if (!validCommands.includes(command.command)) {
      return {
        valid: false,
        error: `Invalid wgx command. Valid: ${validCommands.join(', ')}`,
      };
    }

    if (command.command === 'guard') {
      const validScopes = ['all', 'changed', 'affected'];
      if (command.args.length > 0 && !validScopes.includes(command.args[0])) {
        return {
          valid: false,
          error: `Invalid guard scope. Valid: ${validScopes.join(', ')}`,
        };
      }
    }

    if (command.command === 'smoke') {
      const validEnvs = ['staging', 'production'];
      if (command.args.length > 0 && !validEnvs.includes(command.args[0])) {
        return {
          valid: false,
          error: `Invalid smoke environment. Valid: ${validEnvs.join(', ')}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validate heimlern commands
   */
  private static validateHeimlernCommand(command: HeimgewebeCommand): {
    valid: boolean;
    error?: string;
  } {
    const validCommands = ['pattern-good', 'pattern-bad', 'similar'];

    if (!validCommands.includes(command.command)) {
      return {
        valid: false,
        error: `Invalid heimlern command. Valid: ${validCommands.join(', ')}`,
      };
    }

    if (
      (command.command === 'pattern-good' || command.command === 'pattern-bad') &&
      command.args.length === 0
    ) {
      return {
        valid: false,
        error: `${command.command} requires pattern name as argument`,
      };
    }

    return { valid: true };
  }

  /**
   * Validate metarepo commands
   */
  private static validateMetarepoCommand(command: HeimgewebeCommand): {
    valid: boolean;
    error?: string;
  } {
    const validCommands = ['link-epic', 'visualize'];

    if (!validCommands.includes(command.command)) {
      return {
        valid: false,
        error: `Invalid metarepo command. Valid: ${validCommands.join(', ')}`,
      };
    }

    if (command.command === 'link-epic' && command.args.length === 0) {
      return {
        valid: false,
        error: 'link-epic requires epic ID as argument',
      };
    }

    return { valid: true };
  }

  /**
   * Validate heimgeist commands
   */
  private static validateHeimgeistCommand(command: HeimgewebeCommand): {
    valid: boolean;
    error?: string;
  } {
    const validCommands = ['analyse', 'explain', 'risk'];

    if (!validCommands.includes(command.command)) {
      return {
        valid: false,
        error: `Invalid heimgeist command. Valid: ${validCommands.join(', ')}`,
      };
    }

    return { valid: true };
  }
}
