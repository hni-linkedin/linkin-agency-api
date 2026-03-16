const extractSearchAppearancesWhere = ($) => {
    const result = {
        totalAppearances: 0,
        delta: null,
        whereYouAppeared: {
            posts: 0,
            networkRecommendations: 0,
            comments: 0,
            search: 0
        }
    };

    const mainSection = $('.member-analytics-addon-summary__list-item').first();
    if (mainSection.length > 0) {
        const valText = mainSection.find('.text-heading-large').text().trim();
        result.totalAppearances = parseInt(valText.replace(/[^0-9]/g, ''), 10) || 0;

        const deltaEl = mainSection.find(
            '.analytics-tools-shared-trend-text__value--increase-caret-lead, .analytics-tools-shared-trend-text__value--decrease-caret-lead'
        );
        if (deltaEl.length > 0) {
            const deltaVal = parseInt(deltaEl.text().replace(/[^0-9]/g, ''), 10) || 0;
            result.delta = deltaEl.hasClass(
                'analytics-tools-shared-trend-text__value--increase-caret-lead'
            )
                ? deltaVal
                : -deltaVal;
        }
    }

    $('.member-analytics-addon-metric-row-list-item').each((i, el) => {
        const item = $(el);
        const label = item
            .find('.member-analytics-addon-metric-row-list-item__title')
            .text()
            .trim()
            .toLowerCase();
        const value =
            parseInt(
                item
                    .find('.member-analytics-addon-metric-row-list-item__value')
                    .text()
                    .replace(/[^0-9]/g, ''),
                10
            ) || 0;

        if (label.includes('posts')) result.whereYouAppeared.posts = value;
        else if (label.includes('network'))
            result.whereYouAppeared.networkRecommendations = value;
        else if (label.includes('comments'))
            result.whereYouAppeared.comments = value;
        else if (label.includes('search')) result.whereYouAppeared.search = value;
    });

    return result;
};

module.exports = { extractSearchAppearancesWhere };

