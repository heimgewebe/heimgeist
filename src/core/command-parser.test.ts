import { CommandParser } from './command-parser';

describe('CommandParser', () => {
  const mockContext = {
    pr: 42,
    repo: 'heimgewebe/metarepo',
    author: 'testuser',
    comment_id: 'comment-123',
  };

  describe('parseComment', () => {
    it('should parse a single sichter command', () => {
      const text = '@heimgewebe/sichter /quick';
      const commands = CommandParser.parseComment(text, mockContext);

      expect(commands).toHaveLength(1);
      expect(commands[0]).toMatchObject({
        tool: 'sichter',
        command: 'quick',
        args: [],
        context: mockContext,
      });
    });

    it('should parse a wgx command with arguments', () => {
      const text = '@heimgewebe/wgx /guard auth';
      const commands = CommandParser.parseComment(text, mockContext);

      expect(commands).toHaveLength(1);
      expect(commands[0]).toMatchObject({
        tool: 'wgx',
        command: 'guard',
        args: ['auth'],
        context: mockContext,
      });
    });

    it('should parse multiple commands in one comment', () => {
      const text = `
        Let's review this PR.
        @heimgewebe/sichter /quick
        @heimgewebe/wgx /guard changed
        Please check security implications.
      `;
      const commands = CommandParser.parseComment(text, mockContext);

      expect(commands).toHaveLength(2);
      expect(commands[0].tool).toBe('sichter');
      expect(commands[1].tool).toBe('wgx');
    });

    it('should parse heimlern pattern commands', () => {
      const text = '@heimgewebe/heimlern /pattern-bad sql-injection-risk';
      const commands = CommandParser.parseComment(text, mockContext);

      expect(commands).toHaveLength(1);
      expect(commands[0]).toMatchObject({
        tool: 'heimlern',
        command: 'pattern-bad',
        args: ['sql-injection-risk'],
      });
    });

    it('should parse metarepo epic linking', () => {
      const text = '@heimgewebe/metarepo /link-epic EPIC-123';
      const commands = CommandParser.parseComment(text, mockContext);

      expect(commands).toHaveLength(1);
      expect(commands[0]).toMatchObject({
        tool: 'metarepo',
        command: 'link-epic',
        args: ['EPIC-123'],
      });
    });

    it('should ignore invalid tool names', () => {
      const text = '@heimgewebe/invalid /command';
      const commands = CommandParser.parseComment(text, mockContext);

      expect(commands).toHaveLength(0);
    });

    it('should handle commands with multiple arguments', () => {
      const text = '@heimgewebe/heimlern /pattern-bad raw sql without prepared statements';
      const commands = CommandParser.parseComment(text, mockContext);

      expect(commands).toHaveLength(1);
      expect(commands[0].args).toEqual(['raw', 'sql', 'without', 'prepared', 'statements']);
    });

    it('should return empty array for comments without commands', () => {
      const text = 'This is just a regular comment without any commands';
      const commands = CommandParser.parseComment(text, mockContext);

      expect(commands).toHaveLength(0);
    });
  });

  describe('formatCommand', () => {
    it('should format a command back to mention syntax', () => {
      const command = {
        id: 'test-id',
        timestamp: new Date(),
        tool: 'sichter' as const,
        command: 'quick',
        args: [],
        context: mockContext,
      };

      const formatted = CommandParser.formatCommand(command);
      expect(formatted).toBe('@heimgewebe/sichter /quick');
    });

    it('should format a command with arguments', () => {
      const command = {
        id: 'test-id',
        timestamp: new Date(),
        tool: 'wgx' as const,
        command: 'guard',
        args: ['auth'],
        context: mockContext,
      };

      const formatted = CommandParser.formatCommand(command);
      expect(formatted).toBe('@heimgewebe/wgx /guard auth');
    });
  });

  describe('validateCommand', () => {
    describe('sichter commands', () => {
      it('should validate quick command', () => {
        const command = {
          id: 'test-id',
          timestamp: new Date(),
          tool: 'sichter' as const,
          command: 'quick',
          args: [],
          context: mockContext,
        };

        const result = CommandParser.validateCommand(command);
        expect(result.valid).toBe(true);
      });

      it('should validate deep command', () => {
        const command = {
          id: 'test-id',
          timestamp: new Date(),
          tool: 'sichter' as const,
          command: 'deep',
          args: [],
          context: mockContext,
        };

        const result = CommandParser.validateCommand(command);
        expect(result.valid).toBe(true);
      });

      it('should validate compare command with PR number', () => {
        const command = {
          id: 'test-id',
          timestamp: new Date(),
          tool: 'sichter' as const,
          command: 'compare',
          args: ['123'],
          context: mockContext,
        };

        const result = CommandParser.validateCommand(command);
        expect(result.valid).toBe(true);
      });

      it('should reject compare command without PR number', () => {
        const command = {
          id: 'test-id',
          timestamp: new Date(),
          tool: 'sichter' as const,
          command: 'compare',
          args: [],
          context: mockContext,
        };

        const result = CommandParser.validateCommand(command);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('requires PR number');
      });

      it('should reject invalid sichter command', () => {
        const command = {
          id: 'test-id',
          timestamp: new Date(),
          tool: 'sichter' as const,
          command: 'invalid',
          args: [],
          context: mockContext,
        };

        const result = CommandParser.validateCommand(command);
        expect(result.valid).toBe(false);
      });
    });

    describe('wgx commands', () => {
      it('should validate guard command', () => {
        const command = {
          id: 'test-id',
          timestamp: new Date(),
          tool: 'wgx' as const,
          command: 'guard',
          args: ['changed'],
          context: mockContext,
        };

        const result = CommandParser.validateCommand(command);
        expect(result.valid).toBe(true);
      });

      it('should validate smoke command', () => {
        const command = {
          id: 'test-id',
          timestamp: new Date(),
          tool: 'wgx' as const,
          command: 'smoke',
          args: ['staging'],
          context: mockContext,
        };

        const result = CommandParser.validateCommand(command);
        expect(result.valid).toBe(true);
      });

      it('should reject invalid guard scope', () => {
        const command = {
          id: 'test-id',
          timestamp: new Date(),
          tool: 'wgx' as const,
          command: 'guard',
          args: ['invalid-scope'],
          context: mockContext,
        };

        const result = CommandParser.validateCommand(command);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid guard scope');
      });

      it('should reject invalid smoke environment', () => {
        const command = {
          id: 'test-id',
          timestamp: new Date(),
          tool: 'wgx' as const,
          command: 'smoke',
          args: ['invalid-env'],
          context: mockContext,
        };

        const result = CommandParser.validateCommand(command);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid smoke environment');
      });
    });

    describe('heimlern commands', () => {
      it('should validate pattern-bad command with argument', () => {
        const command = {
          id: 'test-id',
          timestamp: new Date(),
          tool: 'heimlern' as const,
          command: 'pattern-bad',
          args: ['sql-injection'],
          context: mockContext,
        };

        const result = CommandParser.validateCommand(command);
        expect(result.valid).toBe(true);
      });

      it('should reject pattern commands without argument', () => {
        const command = {
          id: 'test-id',
          timestamp: new Date(),
          tool: 'heimlern' as const,
          command: 'pattern-good',
          args: [],
          context: mockContext,
        };

        const result = CommandParser.validateCommand(command);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('requires pattern name');
      });
    });

    describe('metarepo commands', () => {
      it('should validate link-epic command with epic ID', () => {
        const command = {
          id: 'test-id',
          timestamp: new Date(),
          tool: 'metarepo' as const,
          command: 'link-epic',
          args: ['EPIC-123'],
          context: mockContext,
        };

        const result = CommandParser.validateCommand(command);
        expect(result.valid).toBe(true);
      });

      it('should reject link-epic without epic ID', () => {
        const command = {
          id: 'test-id',
          timestamp: new Date(),
          tool: 'metarepo' as const,
          command: 'link-epic',
          args: [],
          context: mockContext,
        };

        const result = CommandParser.validateCommand(command);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('requires epic ID');
      });
    });

    describe('heimgeist commands', () => {
      it('should validate analyse command', () => {
        const command = {
          id: 'test-id',
          timestamp: new Date(),
          tool: 'heimgeist' as const,
          command: 'analyse',
          args: [],
          context: mockContext,
        };

        const result = CommandParser.validateCommand(command);
        expect(result.valid).toBe(true);
      });

      it('should validate risk command', () => {
        const command = {
          id: 'test-id',
          timestamp: new Date(),
          tool: 'heimgeist' as const,
          command: 'risk',
          args: [],
          context: mockContext,
        };

        const result = CommandParser.validateCommand(command);
        expect(result.valid).toBe(true);
      });
    });
  });
});
