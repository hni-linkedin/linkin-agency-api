const extractSearchAppearances = ($) => {
    const result = {
        totalAppearances: 0,
        delta: null,
        whereYouAppeared: {
            posts: 0,
            networkRecommendations: 0,
            comments: 0,
            search: 0,
        },
        topSearcherCompanies: [],
        topSearcherTitles: [],
        titlesFoundFor: []
    };

    // 1. Total Appearances & Delta
    const mainSection = $('.member-analytics-addon-summary__list-item').first();
    if (mainSection.length > 0) {
        const valText = mainSection.find('.text-heading-large').text().trim();
        result.totalAppearances = parseInt(valText.replace(/[^0-9]/g, '')) || 0;

        const deltaEl = mainSection.find('.analytics-tools-shared-trend-text__value--increase-caret-lead, .analytics-tools-shared-trend-text__value--decrease-caret-lead');
        if (deltaEl.length > 0) {
            const deltaVal = parseInt(deltaEl.text().replace(/[^0-9]/g, '')) || 0;
            result.delta = deltaEl.hasClass('analytics-tools-shared-trend-text__value--increase-caret-lead') ? deltaVal : -deltaVal;
        }
    }

    // 2. Where You Appeared Breakdown
    // This often comes from a list or specialized section
    // We'll look for specific labels in metric rows
    $('.member-analytics-addon-metric-row-list-item').each((i, el) => {
        const item = $(el);
        const label = item.find('.member-analytics-addon-metric-row-list-item__title').text().trim().toLowerCase();
        const value = parseInt(item.find('.member-analytics-addon-metric-row-list-item__value').text().replace(/[^0-9]/g, '')) || 0;

        if (label.includes('posts')) result.whereYouAppeared.posts = value;
        else if (label.includes('network')) result.whereYouAppeared.networkRecommendations = value;
        else if (label.includes('comments')) result.whereYouAppeared.comments = value;
        else if (label.includes('search')) result.whereYouAppeared.search = value;
    });

    // 3. Top Companies/Titles/Keywords
    // These usually use the same bar chart component as demographics
    $('.member-analytics-addon-color-bar-chart__chart').each((i, el) => {
        const chart = $(el);
        const headerText = chart.find('.text-HeadingLarge').text().trim();

        const items = [];
        chart.find('.display-flex.full-width').each((j, rowEl) => {
            const row = $(rowEl);
            const label = row.find('.text-body-small-bold').text().trim();
            const value = row.find('.member-analytics-addon-color-bar-chart-bar__percentage').text().trim();
            if (label) items.push({ label, value });
        });

        if (headerText.includes('companies')) result.topSearcherCompanies = items;
        else if (headerText.includes('titles')) result.topSearcherTitles = items;
        else if (headerText.includes('keywords')) result.titlesFoundFor = items;
    });

    return result;
};

module.exports = { extractSearchAppearances };
