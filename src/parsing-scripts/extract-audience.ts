import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

function main() {
    const htmlPath = process.argv[2];
    if (!htmlPath) {
        console.error('Usage: npx ts-node extract-audience.ts <html-file-path>');
        process.exit(1);
    }

    const html = fs.readFileSync(path.resolve(htmlPath), 'utf8');
    const $ = cheerio.load(html);

    const result: any = {
        fold01: {
          totalFollowers: null,
          deltaChange: {
            percentage: null,
            color: null
          }
        },
        fold02: {
          experience: { name: null, percentage: null },
          location: { name: null, percentage: null },
          industry: { name: null, percentage: null }
        }
    };

    // Fold 01: Followers
    const followersListItem = $('.member-analytics-addon-list-item__description').filter((i, el) => $(el).text().includes('Total followers')).closest('li');
    if (followersListItem.length > 0) {
        result.fold01.totalFollowers = followersListItem.find('.text-heading-large').text().trim();
        
        const deltaEl = followersListItem.find('.analytics-tools-shared-trend-text__value--increase-caret-lead, .analytics-tools-shared-trend-text__value--decrease-caret-lead');
        if (deltaEl.length > 0) {
            result.fold01.deltaChange.percentage = deltaEl.text().trim();
            result.fold01.deltaChange.color = deltaEl.hasClass('analytics-tools-shared-trend-text__value--increase-caret-lead') ? 'green' : 'red';
        }
    }

    // Fold 02: Top demographics
    const demographicRows = $('li.member-analytics-addon-meter-bars-chart__row');
    demographicRows.each((i, el) => {
        const row = $(el);
        const title = row.find('.member-analytics-addon-meter-bars-chart__title').text().trim();
        const subtitle = row.find('.member-analytics-addon-meter-bars-chart__subtitle').text().trim().toLowerCase();
        const percentage = row.find('.display-flex.align-items-center').text().trim();

        if (subtitle.includes('experience level')) {
            result.fold02.experience = { name: title, percentage };
        } else if (subtitle.includes('location')) {
            result.fold02.location = { name: title, percentage };
        } else if (subtitle.includes('industry')) {
            result.fold02.industry = { name: title, percentage };
        }
    });

    console.log(JSON.stringify(result, null, 2));
}

main();
