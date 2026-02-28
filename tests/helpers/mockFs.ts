// Centralized fs mock for tests
// Covers both sync and promise-based fs methods used in the codebase

export function createMockFs(jestInstance: any) {
  return {
    // Sync methods
    existsSync: jestInstance.fn().mockReturnValue(false), // Explicit default false for safety
    mkdirSync: jestInstance.fn(),
    writeFileSync: jestInstance.fn(),
    readdirSync: jestInstance.fn().mockReturnValue([]),
    readFileSync: jestInstance.fn().mockReturnValue(''),
    unlinkSync: jestInstance.fn(),
    renameSync: jestInstance.fn(),

    // Promises API
    promises: {
      writeFile: jestInstance.fn().mockResolvedValue(undefined),
      unlink: jestInstance.fn().mockResolvedValue(undefined),
      readdir: jestInstance.fn().mockResolvedValue([]),
      readFile: jestInstance.fn().mockResolvedValue(''),
      rename: jestInstance.fn().mockResolvedValue(undefined),
    }
  };
}
