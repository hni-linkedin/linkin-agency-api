/**
 * Merge company labels where one name is a whole-word prefix of another
 * (e.g. "Allo" + "Allo Health" → one bucket "Allo" with combined count).
 * Chooses the shortest matching name as the canonical label (preserves first-seen casing from that key).
 *
 * @param {Map<string, number>} countMap — raw label → count
 * @returns {Map<string, number>} merged label → count
 */
function mergeCompanyCountsByPrefix(countMap) {
  const names = [...countMap.keys()]
    .map((n) => String(n).trim())
    .filter(Boolean);

  if (names.length === 0) {
    return new Map();
  }

  const sortedByLength = [...new Set(names)].sort((a, b) => a.length - b.length || a.localeCompare(b));

  /**
   * Map a raw label to the shortest other label that is a prefix at a word boundary.
   */
  function canonicalFor(name) {
    const n = name.trim().toLowerCase();
    for (const cand of sortedByLength) {
      const c = cand.trim().toLowerCase();
      if (!c) continue;
      if (n === c) return cand.trim();
      if (n.startsWith(`${c} `)) return cand.trim();
    }
    return name.trim();
  }

  const merged = new Map();
  for (const [name, count] of countMap.entries()) {
    const key = String(name).trim();
    if (!key) continue;
    const canon = canonicalFor(key);
    merged.set(canon, (merged.get(canon) || 0) + count);
  }

  return merged;
}

/**
 * @param {Map<string, number>} mergedMap
 * @param {number} limit
 * @returns {{ company: string, count: number }[]}
 */
function topCompaniesFromMerged(mergedMap, limit) {
  return [...mergedMap.entries()]
    .map(([company, count]) => ({ company, count }))
    .sort((a, b) => b.count - a.count || a.company.localeCompare(b.company))
    .slice(0, limit);
}

module.exports = {
  mergeCompanyCountsByPrefix,
  topCompaniesFromMerged,
};
