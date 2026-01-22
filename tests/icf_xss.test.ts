import { createCategoryListItem } from '../src/frontend/icf_search';

// Minimal DOM Mock
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
        // If we have children, simplistic serialization for debugging/assertion
        if (this.children.length > 0) {
            return this.children.map(c => {
                if (c.tagName === '#TEXT') return c.textContent;
                return `<${c.tagName.toLowerCase()} class="${c.className}">${c.innerHTML}</${c.tagName.toLowerCase()}>`;
            }).join('');
        }
        return this._innerHTML;
    }

    set innerHTML(html: string) {
        this._innerHTML = html;
        this.children = []; // Reset children if innerHTML is set directly
    }

    get textContent(): string {
        if (this.children.length > 0) {
            return this.children.map(c => c.textContent).join('');
        }
        return this._textContent;
    }

    set textContent(text: string) {
        this._textContent = text;
        this._innerHTML = ''; // Clearing textContent clears innerHTML in this simple mock
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
    // Text nodes don't have innerHTML or children in this simple mock
    get innerHTML() { return this._textContent; }
    get textContent() { return this._textContent; }
}

// Setup Global DOM mocks
const globalAny = global as any;
globalAny.document = {
    createElement: (tag: string) => new MockElement(tag),
    createTextNode: (text: string) => new MockTextNode(text),
};

describe('ICF Search XSS Vulnerability', () => {
    it('should NOT inject malicious HTML when using textContent (Safe State)', () => {
        const maliciousTitle = '<img src=x onerror=alert(1)>';
        const cat = {
            code: 'A1',
            title: maliciousTitle,
            chapter: 'Chapter 1'
        };
        const term = 'A1';

        const li = createCategoryListItem(cat, term) as unknown as MockElement;

        // Assertion for SAFE state:
        // 1. The malicious string should be present in textContent (it is displayed to user)
        expect(li.textContent).toContain(maliciousTitle);

        // 2. The innerHTML should NOT contain the raw tag (it should be escaped or just text)
        // In our mock, text nodes render as their content in innerHTML getter if they are children.
        // But crucially, if we used innerHTML=..., there would be NO child nodes (in our prev impl), just a string.
        // If we use DOM methods, we have child nodes.

        // Let's verify structure: we expect spans and text nodes, but NO 'IMG' tag in the structure.
        // We can inspect the children directly.
        // If safe: <span class="search-text">A1 – &lt;img...</span> (or similar, depending on mock)
        // If vulnerable: <span class="search-text">A1 – <img src=x...></span>

        // Check that we didn't blindly set innerHTML with the malicious string
        // If we used DOM nodes, the malicious string is inside a TextNode.
        // In a real browser, innerHTML would show &lt;img...
        // In our mock, innerHTML getter returns textContent for TextNodes.
        // So checking innerHTML string might be ambiguous without escaping logic in mock.

        // BETTER ASSERTION: Check that there are NO children with tagName 'IMG' anywhere in the tree.
        function hasTag(el: MockElement, tag: string): boolean {
            if (el.tagName === tag) return true;
            return el.children.some(c => hasTag(c, tag));
        }

        // In the vulnerable version, we set innerHTML = string. The mock doesn't parse it into nodes.
        // So this check only works if the mock PARSES innerHTML, which it doesn't.

        // So for the FIXED version, we expect `li` to have children (Span), and that Span to have children (Text, Mark).
        // And `li._innerHTML` (the raw string setter) should be empty/unused if we used DOM methods.

        // If we used textContent/appendChild, _innerHTML backing field should be empty (or we rely on the getter).

        // Let's check that we are using the DOM approach.
        const searchTextSpan = li.children.find(c => c.className === 'search-text');
        expect(searchTextSpan).toBeDefined();
        expect(searchTextSpan?.textContent).toContain(maliciousTitle);
    });
});
