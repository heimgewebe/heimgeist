import { SelfStateStore } from './self_state_store';
import * as fs from 'fs';
import * as path from 'path';
import { SELF_MODEL_DIR } from '../config/state-paths';

jest.mock('fs');
jest.mock('../config/state-paths', () => ({
  SELF_MODEL_DIR: '/mock/self_model',
}));

describe('SelfStateStore Retention', () => {
  let store: SelfStateStore;

  beforeEach(() => {
    jest.resetAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    store = new SelfStateStore();
  });

  it('should cleanup old snapshots when limit is exceeded', () => {
    // Mock readdir to return 60 files
    const mockFiles = Array.from({ length: 60 }, (_, i) =>
        `snapshot-2023-01-01T12:${i < 10 ? '0' + i : i}:00.000Z.json`
    ).reverse(); // Newest first

    (fs.readdirSync as jest.Mock).mockReturnValue(mockFiles);

    store.cleanup(50);

    // Should delete 10 files (60 - 50)
    expect(fs.unlinkSync).toHaveBeenCalledTimes(10);
    // Should delete the oldest ones (end of the sorted list)
    expect(fs.unlinkSync).toHaveBeenCalledWith(path.join(SELF_MODEL_DIR, mockFiles[50]));
    expect(fs.unlinkSync).toHaveBeenCalledWith(path.join(SELF_MODEL_DIR, mockFiles[59]));
  });

  it('should not delete anything if count is within limit', () => {
    const mockFiles = ['snapshot-1.json', 'snapshot-2.json'];
    (fs.readdirSync as jest.Mock).mockReturnValue(mockFiles);

    store.cleanup(50);

    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });
});
