import { SelfStateStore } from '../src/core/self_state_store';
import { SelfModelState } from '../src/types';
import * as fs from 'fs';
import { SELF_MODEL_DIR } from '../src/config/state-paths';

// Mock both synchronous and async fs methods
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    readdir: jest.fn().mockResolvedValue([]),
  }
}));

const mockedFs = fs as jest.Mocked<typeof fs>;
// Need to cast promises to jest.Mocked manually or use ts-jest utils, but casting works for now
const mockedFsPromises = fs.promises as unknown as {
  writeFile: jest.Mock;
  unlink: jest.Mock;
  readdir: jest.Mock;
};

describe('SelfStateStore', () => {
  let store: SelfStateStore;
  const mockState: SelfModelState = {
    confidence: 0.8,
    fatigue: 0.2,
    risk_tension: 0.3,
    autonomy_level: 'aware',
    last_updated: new Date().toISOString(),
    basis_signals: ['signal1', 'signal2']
  };

  beforeEach(() => {
    jest.resetAllMocks();
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readdirSync.mockReturnValue([] as any);
    mockedFsPromises.readdir.mockResolvedValue([]);
    store = new SelfStateStore();
  });

  describe('save', () => {
    it('should write a snapshot file with correct content', async () => {
      await store.save(mockState);

      expect(mockedFsPromises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(SELF_MODEL_DIR),
        expect.stringContaining('"confidence": 0.8')
      );
      expect(mockedFsPromises.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/snapshot-.*\.json/),
        expect.any(String)
      );
    });

    it('should trigger cleanup after saving', async () => {
      const cleanupSpy = jest.spyOn(store, 'cleanup').mockImplementation(() => Promise.resolve());
      await store.save(mockState);
      expect(cleanupSpy).toHaveBeenCalledWith(50);
      cleanupSpy.mockRestore();
    });

    it('should handle fs errors gracefully', async () => {
      mockedFsPromises.writeFile.mockRejectedValue(new Error('Disk full'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(store.save(mockState)).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to persist self-state snapshot'));

      consoleSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('should delete oldest files when exceeding keep limit', async () => {
      const mockFiles = [
        'snapshot-2023-01-03T12-00-00.000Z.json',
        'snapshot-2023-01-01T12-00-00.000Z.json',
        'snapshot-2023-01-02T12-00-00.000Z.json',
      ];
      // Mock both sync and async readdir, though cleanup uses async now
      mockedFsPromises.readdir.mockResolvedValue(mockFiles);

      await store.cleanup(2);

      // It should sort them:
      // 2023-01-03... (newest)
      // 2023-01-02...
      // 2023-01-01... (oldest)
      // Keep 2 newest, delete 2023-01-01...

      expect(mockedFsPromises.unlink).toHaveBeenCalledTimes(1);
      expect(mockedFsPromises.unlink).toHaveBeenCalledWith(expect.stringContaining('snapshot-2023-01-01T12-00-00.000Z.json'));
    });

    it('should do nothing if count is within limit', async () => {
      const mockFiles = [
        'snapshot-2023-01-01T12-00-00.000Z.json',
      ];
      mockedFsPromises.readdir.mockResolvedValue(mockFiles);

      await store.cleanup(50);
      expect(mockedFsPromises.unlink).not.toHaveBeenCalled();
    });

    it('should handle non-existent directory', async () => {
      mockedFs.existsSync.mockReturnValue(false);
      await expect(store.cleanup(50)).resolves.toBeUndefined();
      expect(mockedFsPromises.readdir).not.toHaveBeenCalled();
    });
  });

  describe('loadLatest', () => {
    it('should return the latest snapshot', () => {
      const mockFiles = [
        'snapshot-2023-01-02T12-00-00.000Z.json',
        'snapshot-2023-01-01T12-00-00.000Z.json',
      ];
      mockedFs.readdirSync.mockReturnValue(mockFiles as any);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({
        timestamp: '2023-01-02T12:00:00.000Z',
        state: mockState
      }));

      const latest = store.loadLatest();
      expect(latest).toEqual(mockState);
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(expect.stringContaining('snapshot-2023-01-02T12-00-00.000Z.json'), 'utf-8');
    });

    it('should return null if no snapshots exist', () => {
      mockedFs.readdirSync.mockReturnValue([]);
      const latest = store.loadLatest();
      expect(latest).toBeNull();
    });

    it('should return null on error', () => {
      mockedFs.readdirSync.mockImplementation(() => { throw new Error('Failed'); });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const latest = store.loadLatest();
      expect(latest).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('getHistory', () => {
    it('should return history of states', () => {
      const mockFiles = [
        'snapshot-2023-01-02T12-00-00.000Z.json',
        'snapshot-2023-01-01T12-00-00.000Z.json',
      ];
      mockedFs.readdirSync.mockReturnValue(mockFiles as any);
      mockedFs.readFileSync.mockImplementation((path: any) => {
        if (path.toString().includes('2023-01-02')) {
          return JSON.stringify({ timestamp: '2023-01-02', state: { ...mockState, confidence: 0.9 } });
        }
        return JSON.stringify({ timestamp: '2023-01-01', state: { ...mockState, confidence: 0.8 } });
      });

      const history = store.getHistory(10);
      expect(history.length).toBe(2);
      expect(history[0].state.confidence).toBe(0.9);
      expect(history[1].state.confidence).toBe(0.8);
    });

    it('should respect the limit', () => {
      const mockFiles = [
        'snapshot-2023-01-03T12-00-00.000Z.json',
        'snapshot-2023-01-02T12-00-00.000Z.json',
        'snapshot-2023-01-01T12-00-00.000Z.json',
      ];
      mockedFs.readdirSync.mockReturnValue(mockFiles as any);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify({
        timestamp: '2023-01-03T12:00:00.000Z',
        state: mockState
      }));

      const history = store.getHistory(2);
      expect(history.length).toBe(2);
    });
  });
});
