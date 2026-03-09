import { createCategoryListItem } from '../src/frontend/icf_search';

// Minimal DOM Mock (adapted from tests/icf_xss.test.ts)
class MockElement {
    tagName: string;
    className: string = '';
    _textContent: string = '';
    _innerHTML: string = '';
    children: MockElement[] = [];
    parentNode: MockElement | null = null;

    constructor(tagName: string) {
        this.tagName = tagName.toUpperCase();
    }

    get innerHTML(): string {
        if (this.children.length > 0) {
            return this.children.map(c => {
                if (c.tagName === '#TEXT') return c.textContent;
                const classAttr = c.className ? ` class="${c.className}"` : '';
                return `<${c.tagName.toLowerCase()}${classAttr}>${c.innerHTML}</${c.tagName.toLowerCase()}>`;
            }).join('');
        }
        return this._innerHTML;
    }

    set innerHTML(html: string) {
        this._innerHTML = html;
        this.children = [];
    }

    get textContent(): string {
        if (this.children.length > 0) {
            return this.children.map(c => c.textContent).join('');
        }
        return this._textContent;
    }

    set textContent(text: string) {
        this._textContent = text;
        this._innerHTML = '';
        this.children = [];
    }

    appendChild(child: MockElement) {
        this.children.push(child);
        child.parentNode = this;
    }
}

class MockTextNode extends MockElement {
    constructor(text: string) {
        super('#TEXT');
        this._textContent = text;
    }
    get innerHTML() { return this._textContent; }
    get textContent() { return this._textContent; }
}

// Setup Global DOM mocks
const globalAny = global as any;
const previousDocument = globalAny.document;

beforeAll(() => {
    globalAny.document = {
        createElement: (tag: string) => new MockElement(tag),
        createTextNode: (text: string) => new MockTextNode(text),
    };
});

afterAll(() => {
    if (previousDocument === undefined) {
        delete globalAny.document;
    } else {
        globalAny.document = previousDocument;
    }
});

describe('createCategoryListItem', () => {
    const cat = { code: 'A1', title: 'Test Category' };

    it('should correctly highlight a matching search term', () => {
        const term = 'A1';
        const li = createCategoryListItem(cat, term) as unknown as MockElement;

        const textSpan = li.children.find(c => c.className === 'search-text');
        expect(textSpan).toBeDefined();
        expect(textSpan?.children.some(c => c.tagName === 'MARK' && c.textContent === 'A1')).toBe(true);
        expect(textSpan?.textContent).toBe('A1 – Test Category');
    });

    it('should return plain text when search term is empty', () => {
        const term = '';
        const li = createCategoryListItem(cat, term) as unknown as MockElement;

        const textSpan = li.children.find(c => c.className === 'search-text');
        expect(textSpan?.children.some(c => c.tagName === 'MARK')).toBe(false);
        expect(textSpan?.textContent).toBe('A1 – Test Category');
    });

    it('should return plain text when search term does not match', () => {
        const term = 'NoMatch';
        const li = createCategoryListItem(cat, term) as unknown as MockElement;

        const textSpan = li.children.find(c => c.className === 'search-text');
        expect(textSpan?.children.some(c => c.tagName === 'MARK')).toBe(false);
        expect(textSpan?.textContent).toBe('A1 – Test Category');
    });

    it('should NOT create search-context span if chapter is missing', () => {
        const li = createCategoryListItem(cat, '') as unknown as MockElement;
        const contextSpan = li.children.find(c => c.className === 'search-context');
        expect(contextSpan).toBeUndefined();
    });

    it('should create search-context span if chapter is provided', () => {
        const catWithChapter = { ...cat, chapter: 'Chapter 1' };
        const li = createCategoryListItem(catWithChapter, '') as unknown as MockElement;
        const contextSpan = li.children.find(c => c.className === 'search-context');
        expect(contextSpan).toBeDefined();
        expect(contextSpan?.textContent).toBe('Chapter 1');
    });

    it('should correctly escape special regex characters in search term', () => {
        const catWithSpecial = { code: 'S1', title: 'Find .*+? symbols' };
        const term = '.*+?';
        const li = createCategoryListItem(catWithSpecial, term) as unknown as MockElement;

        const textSpan = li.children.find(c => c.className === 'search-text');
        const mark = textSpan?.children.find(c => c.tagName === 'MARK');
        expect(mark).toBeDefined();
        expect(mark?.textContent).toBe('.*+?');
    });

    it('should highlight multiple occurrences of the search term', () => {
        const catMultiple = { code: 'M1', title: 'banana' };
        const term = 'a';
        const li = createCategoryListItem(catMultiple, term) as unknown as MockElement;

        const textSpan = li.children.find(c => c.className === 'search-text');
        const marks = textSpan?.children.filter(c => c.tagName === 'MARK');
        expect(marks?.length).toBe(3);
        expect(textSpan?.textContent).toBe('M1 – banana');
    });

    it('should perform case-insensitive matching by default', () => {
        const term = 'test';
        const li = createCategoryListItem(cat, term) as unknown as MockElement;

        const textSpan = li.children.find(c => c.className === 'search-text');
        const mark = textSpan?.children.find(c => c.tagName === 'MARK');
        expect(mark).toBeDefined();
        expect(mark?.textContent).toBe('Test');
    });

    it('should use provided custom regex for highlighting', () => {
        const customRegex = /Category/g;
        const li = createCategoryListItem(cat, 'A1', customRegex) as unknown as MockElement;

        const textSpan = li.children.find(c => c.className === 'search-text');
        const marks = textSpan?.children.filter(c => c.tagName === 'MARK');
        expect(marks?.length).toBe(1);
        expect(marks?.[0].textContent).toBe('Category');
        expect(textSpan?.children.some(c => c.tagName === 'MARK' && c.textContent === 'A1')).toBe(false);
    });

    it('should NOT hang when given a non-global custom regex', () => {
        const nonGlobalRegex = /Test/;
        const li = createCategoryListItem(cat, 'A1', nonGlobalRegex) as unknown as MockElement;

        const textSpan = li.children.find(c => c.className === 'search-text');
        const marks = textSpan?.children.filter(c => c.tagName === 'MARK');
        // Normalizes to global in production code
        expect(marks?.length).toBe(1);
        expect(marks?.[0].textContent).toBe('Test');
        expect(textSpan?.textContent).toBe('A1 – Test Category');
    });
});
