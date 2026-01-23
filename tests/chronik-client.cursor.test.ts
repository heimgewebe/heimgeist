import { RealChronikClient } from '../src/core/chronik-client';
import * as fs from 'fs';

jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('RealChronikClient Cursor Handling', () => {
    let client: RealChronikClient;
    const originalFetch = global.fetch;

    beforeEach(() => {
        jest.resetAllMocks();
        mockedFs.existsSync.mockReturnValue(true);
        client = new RealChronikClient('http://localhost:3000');
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('stores numeric next_cursor as string and reuses it', async () => {
        const mockFetch = jest.fn();
        global.fetch = mockFetch;

        // First response: returns numeric next_cursor (12345) and an ignored event
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                events: [{ id: 'evt-1', type: 'ignore-me' }],
                next_cursor: 12345,
                has_more: true
            })
        } as any);

        // Second response: explicitly stop the loop by returning no events + has_more=false + no cursor
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                events: [],
                next_cursor: null,
                has_more: false
            })
        } as any);

        // Mock readFileSync to simulate no initial cursor file
        mockedFs.readFileSync.mockImplementation(() => {
             throw new Error('File not found');
        });

        await client.nextEvent(['some-type']);

        // Verify writeFileSync called with newline and stringified number
        expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
            expect.stringContaining('chronik.cursor'),
            "12345\n"
        );

        // Verify second fetch used the stringified cursor
        expect(mockFetch).toHaveBeenCalledTimes(2);
        const secondUrl = new URL(mockFetch.mock.calls[1][0] as string);
        expect(secondUrl.searchParams.get('cursor')).toBe('12345');
    });
});
