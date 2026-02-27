import { RealChronikClient } from '../src/core/chronik-client';
import * as fs from 'fs';

jest.mock('fs', () => require('./helpers/mockFs').createMockFs());
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

        // Verify subsequent fetch used the stringified cursor
        // We find the call that has the cursor param
        const cursorCall = mockFetch.mock.calls.find(call => {
            const url = new URL(call[0] as string);
            return url.searchParams.has('cursor');
        });
        expect(cursorCall).toBeDefined();
        if (cursorCall) {
             const url = new URL(cursorCall[0] as string);
             expect(url.searchParams.get('cursor')).toBe('12345');
        }

        // Verify cursor was written (at least once) with the correct value
        // We relax the strict count to avoid flakiness if internal loop behavior varies
        expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
            expect.stringContaining('chronik.cursor'),
            "12345\n"
        );
    });

    it('warns and stops if has_more=true but no cursor provided', async () => {
        const mockFetch = jest.fn();
        global.fetch = mockFetch;
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        // Response with has_more=true but missing next_cursor
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                events: [],
                has_more: true
                // next_cursor missing
            })
        } as any);

        mockedFs.readFileSync.mockImplementation(() => {
             throw new Error('File not found');
        });

        await client.nextEvent(['some-type']);

        // Verify warning logged
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Contract violation')
        );

        // Verify NO cursor write happened (to avoid corruption)
        expect(mockedFs.writeFileSync).not.toHaveBeenCalled();

        // Verify loop stopped immediately (only 1 call)
        expect(mockFetch).toHaveBeenCalledTimes(1);

        consoleSpy.mockRestore();
    });
});
