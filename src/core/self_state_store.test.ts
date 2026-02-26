import { SelfStateStore } from './self_state_store';
import * as fs from 'fs';
import * as path from 'path';
import { SELF_MODEL_DIR } from '../config/state-paths';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    readdir: jest.fn().mockResolvedValue([]),
  }
}));

jest.mock('../config/state-paths', () => ({
  SELF_MODEL_DIR: '/mock/self_model',
}));

describe('SelfStateStore Retention', () => {
  let store: SelfStateStore;

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    store = new SelfStateStore();
  });

  it('should cleanup old snapshots when limit is exceeded', async () => {
    // Mock readdir to return 60 files
    const mockFiles = Array.from({ length: 60 }, (_, i) =>
        `snapshot-2023-01-01T12:${i < 10 ? '0' + i : i}:00.000Z.json`
    ).reverse(); // Newest first

    (fs.promises.readdir as jest.Mock).mockResolvedValue(mockFiles);

    await store.cleanup(50);

    // Should delete 10 files (60 - 50)
    expect(fs.promises.unlink).toHaveBeenCalledTimes(10);
    // Should delete the oldest ones (end of the sorted list)
    expect(fs.promises.unlink).toHaveBeenCalledWith(path.join(SELF_MODEL_DIR, mockFiles[50]));
    expect(fs.promises.unlink).toHaveBeenCalledWith(path.join(SELF_MODEL_DIR, mockFiles[59]));
  });

  it('should not delete anything if count is within limit', async () => {
    const mockFiles = ['snapshot-1.json', 'snapshot-2.json'];
    (fs.promises.readdir as jest.Mock).mockResolvedValue(mockFiles);

    await store.cleanup(50);

    expect(fs.promises.unlink).not.toHaveBeenCalled();
  });
});
