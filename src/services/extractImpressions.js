const extractImpressions = ($) => {
    const result = {
        impressions: {},
        members: {},
        top_posts: []
    };

    // Impressions (formerly obj1)
    const contentPerformanceHeader = $('h2').filter((i, el) => $(el).text().trim() === 'Content performance');
    if (contentPerformanceHeader.length > 0) {
        const section = contentPerformanceHeader.closest('section');
        const summaryItem = section.find('.member-analytics-addon-summary__list-item').first();

        result.impressions.totalImpression = summaryItem.find('.text-heading-large').text().trim();

        const deltaEl = summaryItem.find('.analytics-tools-shared-trend-text__value--increase-caret-lead, .analytics-tools-shared-trend-text__value--decrease-caret-lead');
        result.impressions.deltaChange = deltaEl.text().trim();
        result.impressions.deltaColor = deltaEl.hasClass('analytics-tools-shared-trend-text__value--increase-caret-lead') ? 'green' : 'red';
    }

    // Members (formerly obj2)
    const discoveryHeader = $('h2').filter((i, el) => $(el).text().trim() === 'Discovery');
    if (discoveryHeader.length > 0) {
        const section = discoveryHeader.closest('section');
        const summaryItems = section.find('.member-analytics-addon-summary__list-item');
        const membersReachedItem = summaryItems.filter((i, el) => $(el).find('.member-analytics-addon-list-item__description').text().includes('Members reached'));

        if (membersReachedItem.length > 0) {
            result.members.totalMembersReached = membersReachedItem.find('.text-heading-large').text().trim();
            const deltaEl = membersReachedItem.find('.analytics-tools-shared-trend-text__value--increase-caret-lead, .analytics-tools-shared-trend-text__value--decrease-caret-lead');
            result.members.deltaChange = deltaEl.text().trim();
            result.members.deltaColor = deltaEl.hasClass('analytics-tools-shared-trend-text__value--increase-caret-lead') ? 'green' : 'red';
        }
    }

    // Top Posts (formerly obj3)
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

            // Engagements (left)
            postInfo.engagementsCount = item.find('.social-details-social-counts__reactions').text().trim();

            // Comments (right) - Extract count only
            const commentsText = item.find('.social-details-social-counts__comments').text().trim();
            postInfo.commentsCount = commentsText.replace(/\D/g, '');

            // Impressions Stat
            const ctaAnchor = item.find('.member-analytics-addon__cta-item-with-secondary-anchor');
            postInfo.impressionsStat = ctaAnchor.find('.member-analytics-addon__cta-item-with-secondary-list-item-title').text().trim();

            // Impression Delta Label & Color
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
    extractImpressions
};
