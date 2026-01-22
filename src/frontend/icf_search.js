
/**
 * Creates a list item for a category search result.
 * @param {Object} cat - The category object {code, title, chapter}.
 * @param {string} term - The search term.
 * @param {RegExp} [regex] - Pre-compiled regex for highlighting.
 * @returns {Object} The list item element.
 */
function createCategoryListItem(cat, term, regex) {
  const li = document.createElement('li');
  // Build li content safely (no innerHTML)
  li.textContent = ''; // clear, just in case

  // Container for main text
  const textSpan = document.createElement('span');
  textSpan.className = 'search-text';

  // Build "CODE – TITLE" with optional highlighting on the full string (same behavior as before)
  const fullText = `${cat.code} – ${cat.title}`;

  if (term) {
    // Use pre-compiled regex if provided, otherwise create it as fallback.
    const re = regex || new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');

    let lastIndex = 0;
    // Ensure we iterate reliably even if re is global
    re.lastIndex = 0;

    let match;
    while ((match = re.exec(fullText)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      if (start > lastIndex) {
        textSpan.appendChild(document.createTextNode(fullText.slice(lastIndex, start)));
      }

      const mark = document.createElement('mark');
      mark.textContent = fullText.slice(start, end);
      textSpan.appendChild(mark);

      lastIndex = end;

      // Safety: avoid infinite loops on zero-length matches
      if (re.lastIndex === start) re.lastIndex++;
    }

    if (lastIndex < fullText.length) {
      textSpan.appendChild(document.createTextNode(fullText.slice(lastIndex)));
    }
  } else {
    textSpan.textContent = fullText;
  }

  li.appendChild(textSpan);

  // Context (Chapter) as safe text
  if (cat.chapter) {
    const ctx = document.createElement('span');
    ctx.className = 'search-context';
    ctx.textContent = cat.chapter;
    li.appendChild(ctx);
  }

  return li;
}

module.exports = { createCategoryListItem };
