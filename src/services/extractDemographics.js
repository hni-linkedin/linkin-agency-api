const extractDemographics = ($) => {
    const result = {
        job_title: [],
        location: [],
        industry: [],
        seniority: [],
        company_size: [],
        company: []
    };

    const categoryMap = {
        'Job title': 'job_title',
        'Location': 'location',
        'Industry': 'industry',
        'Seniority': 'seniority',
        'Company size': 'company_size',
        'Company': 'company'
    };

    $('.member-analytics-addon-color-bar-chart__chart').each((i, el) => {
        const chart = $(el);
        const headerText = chart.find('.text-HeadingLarge').text().trim();
        const key = categoryMap[headerText];

        if (key) {
            const items = [];
            chart.find('.display-flex.full-width').each((j, rowEl) => {
                const row = $(rowEl);
                const title = row.find('.text-body-small-bold').text().trim();
                const percentage = row.find('.member-analytics-addon-color-bar-chart-bar__percentage').text().trim();

                if (title && percentage) {
                    items.push({ title, percentage });
                }
            });

            // As per script logic: top 5 for most, all for company
            if (key === 'company') {
                result[key] = items;
            } else {
                result[key] = items.slice(0, 5);
            }
        }
    });

    return result;
};

module.exports = {
    extractDemographics
};
