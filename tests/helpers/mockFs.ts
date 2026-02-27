// Centralized fs mock for tests
// Covers both sync and promise-based fs methods used in the codebase

export function createMockFs() {
  return {
    // Sync methods
    existsSync: jest.fn(), // Default to undefined (falsy)
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    readdirSync: jest.fn().mockReturnValue([]),
    readFileSync: jest.fn().mockReturnValue(''),
    unlinkSync: jest.fn(),
    renameSync: jest.fn(),

    // Promises API
    promises: {
      writeFile: jest.fn().mockResolvedValue(undefined),
      unlink: jest.fn().mockResolvedValue(undefined),
      readdir: jest.fn().mockResolvedValue([]),
      readFile: jest.fn().mockResolvedValue(''),
      rename: jest.fn().mockResolvedValue(undefined),
    }
  };
}
