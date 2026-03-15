const extractProfileViews = ($) => {
    const result = {
        totalViews: 0,
        delta: null,
        viewers: []
    };

    // 1. Total Views & Delta
    const summaryHeader = $('.profile-views-summary-v2__title-container');
    if (summaryHeader.length > 0) {
        const valText = summaryHeader.find('.text-heading-xlarge').text().trim();
        result.totalViews = parseInt(valText.replace(/[^0-9]/g, '')) || 0;

        const deltaEl = summaryHeader.find('.analytics-tools-shared-trend-text__value--increase-caret-lead, .analytics-tools-shared-trend-text__value--decrease-caret-lead');
        if (deltaEl.length > 0) {
            const deltaVal = parseInt(deltaEl.text().replace(/[^0-9]/g, '')) || 0;
            result.delta = deltaEl.hasClass('analytics-tools-shared-trend-text__value--increase-caret-lead') ? deltaVal : -deltaVal;
        }
    }

    // 2. Viewer List
    $('.profile-views-viewer-card').each((i, el) => {
        const card = $(el);
        const name = card.find('.profile-views-viewer-card__name').text().trim();
        const headline = card.find('.profile-views-viewer-card__headline').text().trim();
        const avatar = card.find('img').attr('src') || null;

        if (name) {
            result.viewers.push({ name, headline, avatar });
        }
    });

    // Fallback for different viewer list structure
    if (result.viewers.length === 0) {
        $('li.profile-views-v2-viewer-card').each((i, el) => {
            const card = $(el);
            const name = card.find('.artdeco-entity-lockup__title').text().trim();
            const headline = card.find('.artdeco-entity-lockup__subtitle').text().trim();
            const avatar = card.find('img').attr('src') || null;

            if (name) {
                result.viewers.push({ name, headline, avatar });
            }
        });
    }

    return result;
};

module.exports = { extractProfileViews };
