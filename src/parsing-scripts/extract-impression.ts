
import * as fs from 'fs';
import * as cheerio from 'cheerio';

function extractData(filePath: string) {
    const html = fs.readFileSync(filePath, 'utf-8');
    const $ = cheerio.load(html);

    const result: any = {
        fold01: {},
        fold02: {},
        fold03: []
    };

    // Fold 01: Content Performance
    const contentPerformanceHeader = $('h2').filter((i, el) => $(el).text().trim() === 'Content performance');
    if (contentPerformanceHeader.length > 0) {
        const section = contentPerformanceHeader.closest('section');
        const summaryItem = section.find('.member-analytics-addon-summary__list-item').first();

        result.fold01.totalImpression = summaryItem.find('.text-heading-large').text().trim();

        const deltaEl = summaryItem.find('.analytics-tools-shared-trend-text__value--increase-caret-lead, .analytics-tools-shared-trend-text__value--decrease-caret-lead');
        result.fold01.deltaChange = {
            percentage: deltaEl.text().trim(),
            color: deltaEl.hasClass('analytics-tools-shared-trend-text__value--increase-caret-lead') ? 'green' : 'red'
        };
    }

    // Fold 02: Discovery
    const discoveryHeader = $('h2').filter((i, el) => $(el).text().trim() === 'Discovery');
    if (discoveryHeader.length > 0) {
        const section = discoveryHeader.closest('section');
        const summaryItems = section.find('.member-analytics-addon-summary__list-item');

        // The request says "total Members reached" which is likely the second item in Discovery
        const membersReachedItem = summaryItems.filter((i, el) => $(el).find('.member-analytics-addon-list-item__description').text().includes('Members reached'));

        if (membersReachedItem.length > 0) {
            result.fold02.totalMembersReached = membersReachedItem.find('.text-heading-large').text().trim();
            const deltaEl = membersReachedItem.find('.analytics-tools-shared-trend-text__value--increase-caret-lead, .analytics-tools-shared-trend-text__value--decrease-caret-lead');
            result.fold02.deltaChange = {
                percentage: deltaEl.text().trim(),
                color: deltaEl.hasClass('analytics-tools-shared-trend-text__value--increase-caret-lead') ? 'green' : 'red'
            };
        }
    }

    // Fold 03: Top Performing Posts
    const topPostsHeader = $('h2').filter((i, el) => $(el).text().trim() === 'Top performing posts');
    if (topPostsHeader.length > 0) {
        const section = topPostsHeader.closest('section');
        const postItems = section.find('ul.member-analytics-addon-analytics-object-list > li').slice(0, 3);

        postItems.each((i, el) => {
            const item = $(el);
            const postInfo: any = {};

            // Post Description (the detailed accessibility description contains the post text)
            postInfo.postDescription = item.find('span.visually-hidden[id^="mini-update-a11y-description"]').text().trim();
            if (!postInfo.postDescription) {
                // Fallback to first visually-hidden if specific one not found
                postInfo.postDescription = item.find('.visually-hidden').last().text().trim();
            }

            // Engagements (left)
            postInfo.engagementsCount = item.find('.social-details-social-counts__reactions').text().trim();

            // Comments (right)
            postInfo.commentsCount = item.find('.social-details-social-counts__comments').text().trim();

            // Impressions and Delta (from the secondary anchor/CTA)
            const ctaAnchor = item.find('.member-analytics-addon__cta-item-with-secondary-anchor');
            postInfo.impressionsStat = ctaAnchor.find('.member-analytics-addon__cta-item-with-secondary-list-item-title').text().trim();
            postInfo.impressionDeltaLabel = ctaAnchor.attr('aria-label');

            result.fold03.push(postInfo);
        });
    }

    return result;
}

const filePath = process.argv[2];
if (!filePath) {
    console.error('Please provide a file path');
    process.exit(1);
}

const data = extractData(filePath);
console.log(JSON.stringify(data, null, 2));
