import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

function main() {
    const htmlPath = process.argv[2];
    if (!htmlPath) {
        console.error('Usage: npx ts-node extract-engagement.ts <html-file-path>');
        process.exit(1);
    }

    const html = fs.readFileSync(path.resolve(htmlPath), 'utf8');
    const $ = cheerio.load(html);

    const result: any = {
        fold01: {
            totalEngagements: null,
            deltaChange: {
                percentage: null,
                color: null
            }
        },
        fold02: {
            reactions: null,
            comments: null,
            reposts: null,
            saves: null,
            sendsOnLinkedIn: null
        },
        fold03: {
            visitsToLinks: null
        },
        fold04: []
    };

    // Fold 01: Content performance
    const contentPerformanceHeader = $('h2').filter((i, el) => $(el).text().trim() === 'Content performance');
    if (contentPerformanceHeader.length > 0) {
        const section = contentPerformanceHeader.closest('section');
        const summaryItem = section.find('.member-analytics-addon-summary__list-item').first();

        result.fold01.totalEngagements = summaryItem.find('.text-heading-large').text().trim();

        const deltaEl = summaryItem.find('.analytics-tools-shared-trend-text__value--increase-caret-lead, .analytics-tools-shared-trend-text__value--decrease-caret-lead');
        result.fold01.deltaChange = {
            percentage: deltaEl.text().trim(),
            color: deltaEl.hasClass('analytics-tools-shared-trend-text__value--increase-caret-lead') ? 'green' : 'red'
        };
    }

    // Fold 02: Social engagement
    const socialEngagementHeader = $('h2').filter((i, el) => $(el).text().trim() === 'Social engagement');
    if (socialEngagementHeader.length > 0) {
        const section = socialEngagementHeader.closest('section');
        const listItems = section.find('li.member-analytics-addon__cta-list-item');

        listItems.each((i, el) => {
            const item = $(el);
            const title = item.find('.member-analytics-addon__cta-list-item-title').text().trim();
            const value = item.find('.member-analytics-addon__cta-list-item-text').text().trim();

            if (title === 'Reactions') result.fold02.reactions = value;
            else if (title === 'Comments') result.fold02.comments = value;
            else if (title === 'Reposts') result.fold02.reposts = value;
            else if (title === 'Saves') result.fold02.saves = value;
            else if (title === 'Sends on LinkedIn') result.fold02.sendsOnLinkedIn = value;
        });
    }

    // Fold 03: Link engagement
    const linkEngagementHeader = $('h2').filter((i, el) => $(el).text().trim() === 'Link engagement');
    if (linkEngagementHeader.length > 0) {
        const section = linkEngagementHeader.closest('section');
        const value = section.find('.member-analytics-addon-metric-row-list-item__value').text().trim();
        result.fold03.visitsToLinks = value;
    }

    // Fold 04: Top performing posts
    const topPostsHeader = $('h2').filter((i, el) => $(el).text().trim() === 'Top performing posts');
    if (topPostsHeader.length > 0) {
        const section = topPostsHeader.closest('section');
        const postItems = section.find('ul.member-analytics-addon-analytics-object-list > li').slice(0, 3);

        postItems.each((i, el) => {
            const item = $(el);
            const postInfo: any = {};

            // Post Description
            postInfo.postDescription = item.find('span.visually-hidden[id^="mini-update-a11y-description"]').text().trim();
            if (!postInfo.postDescription) {
                postInfo.postDescription = item.find('.visually-hidden').last().text().trim();
            }

            // Engagements count
            postInfo.engagementCount = item.find('.social-details-social-counts__reactions').text().trim();

            // Comments count
            postInfo.commentsCount = item.find('.social-details-social-counts__comments').text().trim();

            // Engagement Stat and Delta
            const ctaAnchor = item.find('.member-analytics-addon__cta-item-with-secondary-anchor');
            postInfo.engagementStat = ctaAnchor.find('.member-analytics-addon__cta-item-with-secondary-list-item-title').text().trim();
            postInfo.deltaLabel = ctaAnchor.attr('aria-label');

            result.fold04.push(postInfo);
        });
    }

    console.log(JSON.stringify(result, null, 2));
}

main();
