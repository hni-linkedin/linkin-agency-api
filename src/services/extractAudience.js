const extractAudience = ($) => {
    const result = {
        followers: {
            totalFollowers: null,
            deltaChange: null,
            deltaColor: null
        },
        insights: {
            experience: { name: null, percentage: null },
            location: { name: null, percentage: null },
            industry: { name: null, percentage: null }
        }
    };

    // Followers (formerly obj1 / fold01)
    const followersListItem = $('.member-analytics-addon-list-item__description').filter((i, el) => $(el).text().includes('Total followers')).closest('li');
    if (followersListItem.length > 0) {
        result.followers.totalFollowers = followersListItem.find('.text-heading-large').text().trim();

        const deltaEl = followersListItem.find('.analytics-tools-shared-trend-text__value--increase-caret-lead, .analytics-tools-shared-trend-text__value--decrease-caret-lead');
        if (deltaEl.length > 0) {
            result.followers.deltaChange = deltaEl.text().trim();
            result.followers.deltaColor = deltaEl.hasClass('analytics-tools-shared-trend-text__value--increase-caret-lead') ? 'green' : 'red';
        }
    }

    // Insights (formerly obj2 / fold02)
    const demographicRows = $('li.member-analytics-addon-meter-bars-chart__row');
    demographicRows.each((i, el) => {
        const row = $(el);
        const title = row.find('.member-analytics-addon-meter-bars-chart__title').text().trim();
        const subtitle = row.find('.member-analytics-addon-meter-bars-chart__subtitle').text().trim().toLowerCase();
        const percentage = row.find('.display-flex.align-items-center').text().trim();

        if (subtitle.includes('experience level')) {
            result.insights.experience = { name: title, percentage };
        } else if (subtitle.includes('location')) {
            result.insights.location = { name: title, percentage };
        } else if (subtitle.includes('industry')) {
            result.insights.industry = { name: title, percentage };
        }
    });

    return result;
};

module.exports = {
    extractAudience
};
