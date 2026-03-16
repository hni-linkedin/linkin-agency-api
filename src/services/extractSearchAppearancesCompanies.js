const extractSearchAppearancesCompanies = ($) => {
    const sectionHeadingText = 'Top companies your searchers work at';
    const allEls = $('body *').toArray();

    const labelEl = allEls.find((el) => {
        const text = $(el).text().trim();
        return text && text.toLowerCase() === sectionHeadingText.toLowerCase();
    });

    if (!labelEl) {
        return { topSearcherCompanies: [] };
    }

    const companies = [];
    const seenNames = new Set();

    let node = $(labelEl).next();
    while (node && node.length) {
        const tagName = (node[0].tagName || '').toLowerCase();
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) break;

        node.find('a[href]').each((_, aEl) => {
            const anchor = $(aEl);
            const href = anchor.attr('href') || '';
            if (!href.includes('/company/')) return;

            const rawText = anchor.text().trim();
            if (!rawText) return;
            if (rawText.length < 2 || rawText.length > 120) return;

            const name = rawText.replace(/\s+/g, ' ');
            if (seenNames.has(name)) return;

            const img = anchor.find('img').first();
            let image = null;
            if (img && img.length) {
                image =
                    (img.attr('src') ||
                        img.attr('data-src') ||
                        img.attr('data-delayed-url') ||
                        '').trim() || null;
            }

            seenNames.add(name);
            companies.push({ label: name, image });
        });

        node = node.next();
    }

    return { topSearcherCompanies: companies };
};

module.exports = { extractSearchAppearancesCompanies };

