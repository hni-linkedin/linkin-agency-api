/**
 * Pure headline parser for LinkedIn-style headline strings.
 * Used for network overview company signals (current + ex employers).
 * @param {string | null | undefined} headline
 * @returns {{
 *   currentCompany: string | null,
 *   exCompanies: string[],
 * }}
 */
function parseHeadline(headline) {
  const empty = {
    currentCompany: null,
    exCompanies: [],
  };

  if (!headline || typeof headline !== 'string') {
    return empty;
  }

  const h = headline.trim();
  if (!h) {
    return empty;
  }

  // currentCompany: first match — "@ X" / "@X" / "at X"
  let currentCompany = null;
  const atWord = h.match(/@\s*([^\s|—]+)/);
  if (atWord) {
    currentCompany = atWord[1].trim();
  } else {
    const atPhrase = h.match(/\bat\s+([^|—]+?)(?=\s*[|—]|$)/i);
    if (atPhrase) {
      currentCompany = atPhrase[1].trim();
    }
  }

  const exCompanies = [];
  const seenEx = new Set();
  const addEx = (s) => {
    const t = (s || '').trim();
    if (t && !seenEx.has(t.toLowerCase())) {
      seenEx.add(t.toLowerCase());
      exCompanies.push(t);
    }
  };

  const exPatterns = [/Ex-([^|—]+)/gi, /\bex\s+([^|—]+?)(?=\s*[|—]|$)/gi, /Former\s+([^|—]+)/gi];
  for (const re of exPatterns) {
    const matches = h.matchAll(re);
    for (const m of matches) {
      addEx(m[1]);
    }
  }

  return {
    currentCompany,
    exCompanies,
  };
}

module.exports = { parseHeadline };
