/**
 * LinkedIn connections / My Network page HTML parser (Cheerio).
 * Extracts: connections list (name, headline, profileUrl, image), totalCount when visible.
 * Used for pageType: network_connections.
 */

/**
 * @param {ReturnType<import('cheerio').load>} $
 * @returns {{ connections: Array<{ name: string, headline: string, profileUrl: string | null, image: string | null }>, totalCount: number | null }}
 */
function extractConnections($) {
    const connections = [];
    const seenUrls = new Set();
    const urlToImage = new Map();

    const push = (name, headline, profileUrl, image) => {
        const url = (profileUrl || '').trim().split('?')[0] || null;
        if (!name) return;
        const key = url || name;
        if (seenUrls.has(key)) return;
        seenUrls.add(key);
        connections.push({
            name: name.trim(),
            headline: (headline || '').trim() || null,
            profileUrl: url,
            image: (image || '').trim() || null,
        });
    };

    // 0. Collect profile image URLs from avatar links (a[href*="/in/"] that contain img)
    $('a[href*="/in/"]').each((i, el) => {
        const a = $(el);
        const href = a.attr('href') || '';
        if (!/\/in\/[a-zA-Z0-9-]+\/?/.test(href)) return;
        const img = a.find('img').first();
        if (!img.length) return;
        const src = (img.attr('src') || img.attr('data-src') || img.attr('data-delayed-url') || '').trim();
        if (!src) return;
        const url = href.trim().split('?')[0] || '';
        if (url && !urlToImage.has(url)) urlToImage.set(url, src);
    });

    // 1. Connection cards: prefer links that contain name + headline as separate <p> (current LinkedIn DOM)
    $('a[href*="/in/"]').each((i, el) => {
        const a = $(el);
        const href = a.attr('href') || '';
        if (!/\/in\/[a-zA-Z0-9-]+\/?/.test(href)) return;

        const ps = a.find('p');
        let name = '';
        let headline = null;

        if (ps.length >= 2) {
            name = ps.eq(0).text().trim();
            headline = ps.eq(1).text().trim() || null;
        } else if (ps.length === 1) {
            name = ps.eq(0).text().trim();
        } else {
            // No <p> (e.g. avatar-only link); skip so we use the name-block link (with 2 <p>) for this profile
            return;
        }

        if (name && name.length < 100) {
            const url = href.trim().split('?')[0] || null;
            push(name, headline, href, url ? urlToImage.get(url) : null);
        }
    });

    // 2. Artdeco entity lockups (e.g. list of people)
    if (connections.length === 0) {
        $('.artdeco-entity-lockup').each((i, el) => {
            const lockup = $(el);
            const name = lockup.find('.artdeco-entity-lockup__title').text().trim();
            const headline = lockup.find('.artdeco-entity-lockup__subtitle').text().trim();
            const link = lockup.find('a[href*="/in/"]').attr('href') || null;
            const img = lockup.find('img').first();
            const image = img.length ? (img.attr('src') || img.attr('data-src') || '').trim() || null : null;
            push(name, headline, link, image);
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
            const img = item.find('img').first();
            const image = img.length ? (img.attr('src') || img.attr('data-src') || '').trim() || null : null;
            push(name, headline, profileUrl, image);
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
