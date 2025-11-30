import { v4 as uuidv4 } from 'uuid';
import { HeimgewebeCommand } from '../types';

/**
 * Parse a PR comment for heimgewebe commands
 *
 * Supported formats:
 * - @heimgewebe/sichter /quick
 * - @heimgewebe/wgx /guard auth
 * - @heimgewebe/heimlern /pattern-bad sql-injection
 * - @heimgewebe/metarepo /link-epic EPIC-123
 */
export class CommandParser {
  private static readonly MENTION_PATTERN = /@heimgewebe\/(\w+)\s+\/(\S+)(?:\s+([^\n@]*))?/g;

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
      const tool = match[1] as HeimgewebeCommand['tool'];
      const command = match[2];
      const argsStr = match[3]?.trim() || '';
      const args = argsStr ? argsStr.split(/\s+/) : [];

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
   * Check if tool name is valid
   */
  private static isValidTool(tool: string): tool is HeimgewebeCommand['tool'] {
    return ['sichter', 'wgx', 'heimlern', 'metarepo', 'heimgeist'].includes(tool);
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
      default:
        return { valid: false, error: `Unknown tool: ${command.tool}` };
    }
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
