/**
 * LinkedIn connections / My Network page HTML parser (Cheerio).
 * Extracts: connections list (name, headline, profileUrl), totalCount when visible.
 * Used for pageType: network_connections.
 */

/**
 * @param {ReturnType<import('cheerio').load>} $
 * @returns {{ connections: Array<{ name: string, headline: string, profileUrl: string | null }>, totalCount: number | null }}
 */
function extractConnections($) {
    const connections = [];
    const seenUrls = new Set();

    const push = (name, headline, profileUrl) => {
        const url = (profileUrl || '').trim().split('?')[0] || null;
        if (!name) return;
        const key = url || name;
        if (seenUrls.has(key)) return;
        seenUrls.add(key);
        connections.push({
            name: name.trim(),
            headline: (headline || '').trim() || null,
            profileUrl: url,
        });
    };

    // 1. Connection cards: a.mn-connection-card__link or similar
    $('a[href*="/in/"]').each((i, el) => {
        const a = $(el);
        const href = a.attr('href') || '';
        if (!/\/in\/[a-zA-Z0-9-]+\/?/.test(href)) return;

        const card = a.closest('.mn-connection-card, .entity-result, [class*="connection"], li');
        const name =
            card.find('.mn-connection-card__name, .artdeco-entity-lockup__title, .entity-result__title-text a, [class*="name"]').first().text().trim() ||
            a.find('.mn-connection-card__name, .artdeco-entity-lockup__title').text().trim() ||
            a.text().trim().split('\n')[0].trim();
        const headline =
            card.find('.mn-connection-card__link, .artdeco-entity-lockup__subtitle, .entity-result__primary-subtitle').first().text().trim() ||
            a.siblings().filter('.artdeco-entity-lockup__subtitle, [class*="subtitle"]').first().text().trim();

        if (name && name.length < 100) push(name, headline, href);
    });

    // 2. Artdeco entity lockups (e.g. list of people)
    if (connections.length === 0) {
        $('.artdeco-entity-lockup').each((i, el) => {
            const lockup = $(el);
            const name = lockup.find('.artdeco-entity-lockup__title').text().trim();
            const headline = lockup.find('.artdeco-entity-lockup__subtitle').text().trim();
            const link = lockup.find('a[href*="/in/"]').attr('href') || null;
            push(name, headline, link);
        });
    }

    // 3. Entity result items (search-style)
    if (connections.length === 0) {
        $('.entity-result__item, .reusable-search__result-container').each((i, el) => {
            const item = $(el);
            const titleEl = item.find('.entity-result__title-text a, .entity-result__title a');
            const name = titleEl.text().trim() || item.find('.entity-result__title-text').text().trim();
            const headline = item.find('.entity-result__primary-subtitle, .entity-result__summary').first().text().trim();
            const profileUrl = titleEl.attr('href') || item.find('a[href*="/in/"]').first().attr('href') || null;
            push(name, headline, profileUrl);
        });
    }

    // 4. Total count – e.g. "500+ connections" or "1,234 connections"
    let totalCount = null;
    const bodyText = $('body').text();
    const countMatch = bodyText.match(/(\d+,?\d*)\s*\+\s*connections?/i) || bodyText.match(/(\d+,?\d*)\s+connections?/i);
    if (countMatch) {
        const num = parseInt(countMatch[1].replace(/,/g, ''), 10);
        if (!isNaN(num)) totalCount = num;
    }

    return {
        connections,
        totalCount,
    };
}

module.exports = { extractConnections };
