import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

function main() {
    const htmlPath = process.argv[2];
    if (!htmlPath) {
        console.error('Usage: npx ts-node extract-demographics.ts <html-file-path>');
        process.exit(1);
    }

    const html = fs.readFileSync(path.resolve(htmlPath), 'utf8');
    const $ = cheerio.load(html);

    const result: any = {
        fold01: [], // Job title
        fold02: [], // Locationw
        fold03: [], // Industry
        fold04: [], // Seniority
        fold05: [], // Company size
        fold06: []  // Company
    };

    const categoryMap: { [key: string]: string } = {
        'Job title': 'fold01',
        'Location': 'fold02',
        'Industry': 'fold03',
        'Seniority': 'fold04',
        'Company size': 'fold05',
        'Company': 'fold06'
    };

    $('.member-analytics-addon-color-bar-chart__chart').each((i, el) => {
        const chart = $(el);
        const headerText = chart.find('.text-HeadingLarge').text().trim();
        const foldKey = categoryMap[headerText];

        if (foldKey) {
            const items: any[] = [];
            chart.find('.display-flex.full-width').each((j, rowEl) => {
                const row = $(rowEl);
                const title = row.find('.text-body-small-bold').text().trim();
                const percentage = row.find('.member-analytics-addon-color-bar-chart-bar__percentage').text().trim();

                if (title && percentage) {
                    items.push({ title, percentage });
                }
            });

            // The user requested 5 elements for fold01-fold05, and n for fold06.
            if (foldKey === 'fold06') {
                result[foldKey] = items;
            } else {
                result[foldKey] = items.slice(0, 5);
            }
        }
    });

    console.log(JSON.stringify(result, null, 2));
}

main();
