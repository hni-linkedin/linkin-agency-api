const extractEngagements = ($) => {
    const result = {
        engagements: {},
        engagements_split: {},
        visitsToLinks: null,
        top_posts: []
    };

    // Engagements (from Fold 01)
    const contentPerformanceHeader = $('h2').filter((i, el) => $(el).text().trim() === 'Content performance');
    if (contentPerformanceHeader.length > 0) {
        const section = contentPerformanceHeader.closest('section');
        const summaryItem = section.find('.member-analytics-addon-summary__list-item').first();

        result.engagements.totalEngagements = summaryItem.find('.text-heading-large').text().trim();

        const deltaEl = summaryItem.find('.analytics-tools-shared-trend-text__value--increase-caret-lead, .analytics-tools-shared-trend-text__value--decrease-caret-lead');
        result.engagements.deltaChange = deltaEl.text().trim();
        result.engagements.deltaColor = deltaEl.hasClass('analytics-tools-shared-trend-text__value--increase-caret-lead') ? 'green' : 'red';
    }

    // Engagements Split (from Fold 02)
    const socialEngagementHeader = $('h2').filter((i, el) => $(el).text().trim() === 'Social engagement');
    if (socialEngagementHeader.length > 0) {
        const section = socialEngagementHeader.closest('section');
        const listItems = section.find('li.member-analytics-addon__cta-list-item');

        listItems.each((i, el) => {
            const item = $(el);
            const title = item.find('.member-analytics-addon__cta-list-item-title').text().trim();
            const value = item.find('.member-analytics-addon__cta-list-item-text').text().trim();

            if (title === 'Reactions') result.engagements_split.reactions = value;
            else if (title === 'Comments') result.engagements_split.comments = value;
            else if (title === 'Reposts') result.engagements_split.reposts = value;
            else if (title === 'Saves') result.engagements_split.saves = value;
            else if (title === 'Sends on LinkedIn') result.engagements_split.sendsOnLinkedIn = value;
        });
    }

    // Link Engagement (from Fold 03)
    const linkEngagementHeader = $('h2').filter((i, el) => $(el).text().trim() === 'Link engagement');
    if (linkEngagementHeader.length > 0) {
        const section = linkEngagementHeader.closest('section');
        const value = section.find('.member-analytics-addon-metric-row-list-item__value').text().trim();
        result.visitsToLinks = value;
    }

    // Top Posts (from Fold 04)
    const topPostsHeader = $('h2').filter((i, el) => $(el).text().trim() === 'Top performing posts');
    if (topPostsHeader.length > 0) {
        const section = topPostsHeader.closest('section');
        const postItems = section.find('ul.member-analytics-addon-analytics-object-list > li').slice(0, 3);

        postItems.each((i, el) => {
            const item = $(el);
            const postInfo = {};

            // Post Description
            postInfo.postDescription = item.find('span.visually-hidden[id^="mini-update-a11y-description"]').text().trim() ||
                item.find('.visually-hidden').last().text().trim();

            // Engagements Count (left)
            postInfo.engagementsCount = item.find('.social-details-social-counts__reactions').text().trim();

            // Comments Count (right) - Extract count only
            const commentsText = item.find('.social-details-social-counts__comments').text().trim();
            postInfo.commentsCount = commentsText.replace(/\D/g, '');

            // Engagement Stat (mapped to impressionsStat as per template request)
            const ctaAnchor = item.find('.member-analytics-addon__cta-item-with-secondary-anchor');
            postInfo.impressionsStat = ctaAnchor.find('.member-analytics-addon__cta-item-with-secondary-list-item-title').text().trim();

            // Engagement Delta (mapped to impressionDeltaLabel/Color as per template request)
            const ariaLabel = ctaAnchor.attr('aria-label') || '';
            if (ariaLabel.toLowerCase().includes('increased')) {
                postInfo.impressionDeltaLabel = 'increased';
                postInfo.impressionDeltaColor = 'green';
            } else if (ariaLabel.toLowerCase().includes('decreased')) {
                postInfo.impressionDeltaLabel = 'decreased';
                postInfo.impressionDeltaColor = 'red';
            } else {
                postInfo.impressionDeltaLabel = 'no-change';
                postInfo.impressionDeltaColor = 'gray';
            }

            result.top_posts.push(postInfo);
        });
    }

    return result;
};

module.exports = {
    extractEngagements
};
