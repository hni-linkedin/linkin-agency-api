/**
 * Extracts "Job titles you were found for" from search appearances HTML.
 * Logic mirrors parse-found-for.mjs: find section by heading, collect next siblings
 * until H1–H6, parse each element for single percentage + title, dedupe by title|percentage.
 */

const extractSearchAppearancesFoundFor = ($) => {
    const sectionHeadingText = 'Job titles you were found for';
    const allEls = $('body *').toArray();

    const labelEl = allEls.find((el) => {
        const text = $(el).text().trim();
        return text && text.toLowerCase() === sectionHeadingText.toLowerCase();
    });

    if (!labelEl) {
        return { titlesFoundFor: [] };
    }

    const rangeRoots = [];
    let node = $(labelEl).next();
    while (node && node.length) {
        const tagName = (node[0].tagName || '').toLowerCase();
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) break;
        rangeRoots.push(node);
        node = node.next();
    }

    if (!rangeRoots.length) {
        return { titlesFoundFor: [] };
    }

    const resultsMap = new Map();

    const processElement = (el) => {
        const raw = $(el).text().trim().replace(/\s+/g, ' ');
        if (!raw) return;

        const percentMatches = raw.match(/(\d+(?:\.\d+)?)\s*%/g);
        if (!percentMatches || percentMatches.length !== 1) return;

        const m = percentMatches[0].match(/(\d+(?:\.\d+)?)\s*%/);
        if (!m) return;

        const percentage = parseFloat(m[1]);
        if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) return;

        let title = raw.replace(m[0], '');
        title = title.replace(/^[*•\-\u00B7]+/, '');
        title = title.replace(/[\u2022\u00B7|]+/g, ' ');
        title = title.replace(/\s+/g, ' ').trim();

        if (!title || title.length < 2 || title.length > 120) return;

        const key = `${title}|${percentage}`;
        if (!resultsMap.has(key)) {
            resultsMap.set(key, { title, percentage });
        }
    };

    for (const root of rangeRoots) {
        processElement(root[0]);
        root.find('*').each((_, el) => processElement(el));
    }

    return {
        titlesFoundFor: Array.from(resultsMap.values())
    };
};

module.exports = { extractSearchAppearancesFoundFor };
