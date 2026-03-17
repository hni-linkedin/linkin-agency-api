/**
 * LinkedIn followers HTML parser (Cheerio).
 * Mirrors parse-followers.mjs:
 * - Source: network_followers page
 * - Output: { followers: Array<{ image, name, heading, profileUrl }> }
 */

/**
 * @param {ReturnType<import('cheerio').load>} $
 * @returns {{ followers: Array<{ image: string | null, name: string, heading: string | null, profileUrl: string | null }> }}
 */
const extractFollowers = ($) => {
    const cards = $('[data-view-name="search-entity-result-universal-template"]');
    const seen = new Set();
    const followers = [];

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

        followers.push({
            image,
            name,
            heading,
            profileUrl,
        });
    });

    return { followers };
};

module.exports = { extractFollowers };

