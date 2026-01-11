import { CommandParser } from './command-parser';

describe('CommandParser', () => {
  describe('parseComment', () => {
    const context = {
      pr: 123,
      repo: 'heimgewebe/test',
      author: 'test-user',
    };

    it('should parse valid sichter commands', () => {
      const text = 'Some discussion\n@heimgewebe/sichter /quick\nMore text';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(1);
      expect(commands[0].tool).toBe('sichter');
      expect(commands[0].command).toBe('quick');
    });

    it('should parse valid self alias commands', () => {
      const text = '@self /status';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(1);
      expect(commands[0].tool).toBe('self');
      expect(commands[0].command).toBe('status');
    });

    it('should parse valid heimgewebe/self commands', () => {
      const text = '@heimgewebe/self /status';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(1);
      expect(commands[0].tool).toBe('self');
      expect(commands[0].command).toBe('status');
    });

    it('should parse multiple commands', () => {
      const text = '@heimgewebe/sichter /quick\n@heimgewebe/wgx /smoke staging';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(2);
      expect(commands[0].tool).toBe('sichter');
      expect(commands[1].tool).toBe('wgx');
      expect(commands[1].args).toEqual(['staging']);
    });

    it('should handle special characters in args', () => {
      const text = '@heimgewebe/sichter /deep --filter="src/**/*.ts"';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(1);
      expect(commands[0].args).toEqual(['--filter="src/**/*.ts"']);
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

  describe('validateCommand', () => {
      it('should validate self commands', () => {
          const valid = CommandParser.validateCommand({
              tool: 'self',
              command: 'status',
              args: [],
              id: '1',
              timestamp: new Date(),
              context: { repo: 'test', author: 'test' }
          });
          expect(valid.valid).toBe(true);
      });
  });

  describe('Regression Tests', () => {
    const context = {
      pr: 123,
      repo: 'heimgewebe/test',
      author: 'test-user',
    };

    it('should parse multiple commands in one comment', () => {
      const text = '@heimgewebe/sichter /quick\n@heimgewebe/wgx /guard';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(2);
      expect(commands[0].tool).toBe('sichter');
      expect(commands[1].tool).toBe('wgx');
    });

    it('should handle special characters in args', () => {
      const text = '@heimgewebe/heimlern /pattern-bad "SQL; DROP TABLE"';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(1);
      expect(commands[0].args[0]).toContain('SQL;');
    });

    it('should return empty array for no commands', () => {
      const text = 'Just a regular comment without commands.';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(0);
    });

    it('should ignore unknown tools', () => {
      const text = '@heimgewebe/unknown /do-something';
      const commands = CommandParser.parseComment(text, context);
      expect(commands).toHaveLength(0);
    });
  });
});
