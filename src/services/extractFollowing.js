/**
 * LinkedIn following HTML parser (Cheerio).
 * Mirrors parse-following.mjs:
 * - Source: network_following page
 * - Output: { following: Array<{ image, name, heading, profileUrl }> }
 */

/**
 * @param {ReturnType<import('cheerio').load>} $
 * @returns {{ following: Array<{ image: string | null, name: string, heading: string | null, profileUrl: string | null }>, totalCount: number | null }}
 */
const extractFollowing = ($) => {
    const cards = $('[data-view-name="search-entity-result-universal-template"]');
    const seen = new Set();
    const following = [];

    cards.each((_, el) => {
        const card = $(el);

        const img = card.find('img').first();
        const image = img.length ? (img.attr('src') || '').trim() || null : null;

        const nameAnchor =
            card.find('span.t-16 a').first().length
                ? card.find('span.t-16 a').first()
                : card.find('a[href*="/in/"]').first();

        const name = nameAnchor.length ? nameAnchor.text().trim() : null;
        const profileUrl = nameAnchor.length ? (nameAnchor.attr('href') || null) : null;

        const headingEl =
            card.find('.t-14.t-black.t-normal').first().length
                ? card.find('.t-14.t-black.t-normal').first()
                : card.find('div[class*="t-14"][class*="t-black"]').first();

        const heading = headingEl.length ? headingEl.text().trim() || null : null;

        if (!name) return;
        if (seen.has(name)) return;
        seen.add(name);

        following.push({
            image,
            name,
            heading,
            profileUrl,
        });
    });

    let totalCount = null;
    const bodyText = $.root().text();

    // Network > Following heading: "You are following 122 people out of your network"
    const followingOutOfNetworkMatch = bodyText.match(
        /you\s+are\s+following\s+(\d[\d,]*)\s+people\s+out\s+of\s+your\s+network/i,
    );
    if (followingOutOfNetworkMatch) {
        const num = parseInt(followingOutOfNetworkMatch[1].replace(/,/g, ''), 10);
        if (!Number.isNaN(num)) totalCount = num;
    }

    if (totalCount === null) {
        const countMatch =
            bodyText.match(/(\d+,?\d*)\s*\+\s*following?/i) ||
            bodyText.match(/(\d+,?\d*)\s+following?/i);
        if (countMatch) {
            const num = parseInt(countMatch[1].replace(/,/g, ''), 10);
            if (!Number.isNaN(num)) totalCount = num;
        }
    }

    return { following, totalCount };
};

module.exports = { extractFollowing };

