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
});
