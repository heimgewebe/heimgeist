import { CommandParser } from './command-parser';
import { HeimgewebeCommand } from '../types';

describe('CommandParser', () => {
  const context = {
    pr: 123,
    repo: 'heimgewebe/test',
    author: 'test-user',
  };

  describe('parseComment', () => {
    it('should parse valid sichter commands', () => {
      const text = 'Some discussion\n@heimgewebe/sichter /quick\nMore text';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(1);
      expect(commands[0].tool).toBe('sichter');
      expect(commands[0].command).toBe('quick');
    });

    it('should parse valid wgx commands', () => {
      const text = '@heimgewebe/wgx /smoke staging';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(1);
      expect(commands[0].tool).toBe('wgx');
      expect(commands[0].command).toBe('smoke');
      expect(commands[0].args).toEqual(['staging']);
    });

    it('should parse valid heimlern commands', () => {
      const text = '@heimgewebe/heimlern /pattern-good "React Hook"';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(1);
      expect(commands[0].tool).toBe('heimlern');
      expect(commands[0].command).toBe('pattern-good');
    });

    it('should parse valid metarepo commands', () => {
      const text = '@heimgewebe/metarepo /link-epic EPIC-123';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(1);
      expect(commands[0].tool).toBe('metarepo');
      expect(commands[0].command).toBe('link-epic');
    });

    it('should parse valid heimgeist commands', () => {
      const text = '@heimgewebe/heimgeist /analyse';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(1);
      expect(commands[0].tool).toBe('heimgeist');
      expect(commands[0].command).toBe('analyse');
    });

    // Self alias tests
    it('should parse @self alias commands', () => {
      const text = '@self /status';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(1);
      expect(commands[0].tool).toBe('self');
      expect(commands[0].command).toBe('status');
    });

    it('should parse @heimgewebe/self commands', () => {
      const text = '@heimgewebe/self /set autonomy=aware';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(1);
      expect(commands[0].tool).toBe('self');
      expect(commands[0].command).toBe('set');
      expect(commands[0].args).toEqual(['autonomy=aware']);
    });

    it('should parse multiple commands in one comment', () => {
      const text = '@heimgewebe/sichter /quick\n@heimgewebe/wgx /guard';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(2);
      expect(commands[0].tool).toBe('sichter');
      expect(commands[1].tool).toBe('wgx');
    });

    it('should handle quoted args with special characters', () => {
      const text = '@heimgewebe/sichter /deep --filter="src/**/*.ts"';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(1);
      expect(commands[0].args).toEqual(['--filter=src/**/*.ts']);
    });

    it('should handle quoted args with spaces', () => {
      const text = '@heimgewebe/heimlern /pattern-bad "SQL; DROP TABLE"';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(1);
      expect(commands[0].args).toEqual(['SQL; DROP TABLE']);
    });

    it('should handle mixed quotes', () => {
      const text = "@heimgewebe/sichter /cmd 'single quoted' \"double quoted\"";
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(1);
      expect(commands[0].args).toEqual(['single quoted', 'double quoted']);
    });

    it('should return empty array for no commands', () => {
      const text = 'Just a regular comment without commands.';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(0);
    });

    it('should ignore unknown tools', () => {
      const text = '@heimgewebe/unknown /start';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(0);
    });
  });

  describe('formatCommand', () => {
    it('should format commands back to string', () => {
      const cmd: HeimgewebeCommand = {
        id: '1',
        timestamp: new Date(),
        tool: 'sichter',
        command: 'quick',
        args: [],
        context
      };
      expect(CommandParser.formatCommand(cmd)).toBe('@heimgewebe/sichter /quick');
    });

    it('should include args in formatted string', () => {
      const cmd: HeimgewebeCommand = {
        id: '1',
        timestamp: new Date(),
        tool: 'wgx',
        command: 'smoke',
        args: ['staging'],
        context
      };
      expect(CommandParser.formatCommand(cmd)).toBe('@heimgewebe/wgx /smoke staging');
    });
  });

  describe('validateCommand', () => {
    it('should validate valid sichter command', () => {
      const valid = CommandParser.validateCommand({
          tool: 'sichter',
          command: 'quick',
          args: [],
          id: '1', timestamp: new Date(), context
      });
      expect(valid.valid).toBe(true);
    });

    it('should reject invalid sichter command', () => {
        const valid = CommandParser.validateCommand({
            tool: 'sichter',
            command: 'invalid',
            args: [],
            id: '1', timestamp: new Date(), context
        });
        expect(valid.valid).toBe(false);
    });

    it('should validate valid wgx command', () => {
        const valid = CommandParser.validateCommand({
            tool: 'wgx',
            command: 'guard',
            args: ['changed'],
            id: '1', timestamp: new Date(), context
        });
        expect(valid.valid).toBe(true);
    });

    it('should reject wgx guard with invalid scope', () => {
        const valid = CommandParser.validateCommand({
            tool: 'wgx',
            command: 'guard',
            args: ['invalid_scope'],
            id: '1', timestamp: new Date(), context
        });
        expect(valid.valid).toBe(false);
    });

    it('should validate valid self commands', () => {
        const valid = CommandParser.validateCommand({
            tool: 'self',
            command: 'status',
            args: [],
            id: '1',
            timestamp: new Date(),
            context
        });
        expect(valid.valid).toBe(true);
    });

    it('should reject invalid self command', () => {
        const valid = CommandParser.validateCommand({
            tool: 'self',
            command: 'explode',
            args: [],
            id: '1',
            timestamp: new Date(),
            context
        });
        expect(valid.valid).toBe(false);
        expect(valid.error).toContain('Invalid self command');
    });

    it('should reject self set command without args', () => {
        const valid = CommandParser.validateCommand({
            tool: 'self',
            command: 'set',
            args: [],
            id: '1',
            timestamp: new Date(),
            context
        });
        expect(valid.valid).toBe(false);
    });

    it('should reject unknown tool', () => {
        const valid = CommandParser.validateCommand({
            tool: 'unknown' as unknown as import('../types').HeimgewebeCommand['tool'],
            command: 'start',
            args: [],
            id: '1', timestamp: new Date(), context
        });
        expect(valid.valid).toBe(false);
    });
  });
});
