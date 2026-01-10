import { ArtifactWriter } from './artifact_writer';
import { SelfModelState, SelfStateSnapshot, SelfStateBundle } from '../types';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');

describe('ArtifactWriter', () => {
  const TEST_DIR = '/mock/artifacts';
  let writer: ArtifactWriter;

  beforeEach(() => {
    jest.resetAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    writer = new ArtifactWriter(TEST_DIR);
  });

  it('should write atomic bundle correctly', () => {
    const currentState: SelfModelState = {
      confidence: 0.9,
      fatigue: 0.1,
      risk_tension: 0.2,
      autonomy_level: 'aware',
      last_updated: '2023-01-01T12:00:00Z',
      basis_signals: []
    };

    const history: SelfStateSnapshot[] = [
      { timestamp: '2023-01-01T12:00:00Z', state: currentState }
    ];

    writer.write(currentState, history);

    // Verify temp write
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join(TEST_DIR, 'self_state.json.tmp'),
      expect.stringContaining('"schema": "heimgeist.self_state.bundle.v1"'),
    );

    // Verify rename
    expect(fs.renameSync).toHaveBeenCalledWith(
      path.join(TEST_DIR, 'self_state.json.tmp'),
      path.join(TEST_DIR, 'self_state.json'),
    );
  });

  it('should limit history in bundle', () => {
    const currentState: SelfModelState = {
      confidence: 0.9,
      fatigue: 0.1,
      risk_tension: 0.2,
      autonomy_level: 'aware',
      last_updated: '2023-01-01T12:00:00Z',
      basis_signals: []
    };

    // Create 60 items
    const history = Array(60).fill({ timestamp: '...', state: currentState });

    writer.write(currentState, history);

    const call = (fs.writeFileSync as jest.Mock).mock.calls[0];
    const writtenContent = JSON.parse(call[1]) as SelfStateBundle;

    expect(writtenContent.history.length).toBe(50);
  });

  it('should create directory if missing', () => {
    (fs.existsSync as jest.Mock).mockReturnValueOnce(false); // check for dir
    new ArtifactWriter(TEST_DIR);
    expect(fs.mkdirSync).toHaveBeenCalledWith(TEST_DIR, { recursive: true });
  });
});
