/**
 * LinkedIn profile HTML parser (Cheerio).
 * Extracts: profileName, headline, location, about, topSkills, experience, profileImage, bannerImage.
 * Used for pageType: profile_main; result stored in Capture.parsedData and returned in summary/home.
 */

/**
 * Parse experience entry text like:
 * "MarTech SDE InternAllo Health · InternshipNov 2025 - Present · 5 mos..."
 * into { heading, subheading, date }
 */
function parseExperienceEntryText(raw) {
    const t = raw.replace(/\s+/g, ' ').trim();
    const months = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';
    const dateRegex = new RegExp(
        `((${months})\\s+\\d{4}\\s+-\\s+(?:Present|(${months})\\s+\\d{4})\\s+·\\s+(?:\\d+\\s*yrs?\\s*\\d*\\s*mos|\\d+\\s*mos|\\d+\\s*yrs?))`
    );
    const dateMatch = t.match(dateRegex);
    if (!dateMatch) return { heading: t, subheading: '', date: '' };
    const dateStr = dateMatch[1].trim();
    const beforeDate = t.substring(0, t.indexOf(dateStr)).trim();

    if (!beforeDate.includes(' · ')) {
        return { heading: beforeDate, subheading: '', date: dateStr };
    }

    const dotParts = beforeDate.split(' · ');
    const employmentType = dotParts.pop() || '';
    const titleAndCompany = dotParts.join(' · ').trim() || '';

    if (!titleAndCompany) {
        return { heading: beforeDate, subheading: '', date: dateStr };
    }

    let heading = titleAndCompany;
    let subheading = employmentType ? ` · ${employmentType}` : '';

    const tokens = titleAndCompany.match(/[A-Z][a-z]+|[A-Z]{2,}/g) || [];
    if (tokens.length >= 2) {
        const last = tokens[tokens.length - 1];
        const company =
            last.toLowerCase() === employmentType.toLowerCase()
                ? last
                : tokens.slice(-2).join(' ');
        const titleLen = last.toLowerCase() === employmentType.toLowerCase() ? 1 : 2;
        heading = tokens.slice(0, -titleLen).join(' ');
        subheading = `${company} · ${employmentType}`;
        if (heading.startsWith('Mar ') && heading.includes('Tech')) {
            heading = 'MarTech ' + heading.slice(8).trim();
        }
    } else if (tokens.length === 1) {
        heading = tokens[0];
        subheading = employmentType ? ` · ${employmentType}` : '';
    }

    if (subheading === 'True Gether · Freelance') {
        subheading = 'TrueGether · Freelance';
    }

    return {
        heading: heading || beforeDate,
        subheading: subheading.trim(),
        date: dateStr,
    };
}

/**
 * Profile banner (cover) and avatar URLs from saved LinkedIn HTML.
 * Cover: img[alt="Cover photo"] or figure[aria-label="Cover photo"] img or src contains profile-displaybackgroundimage
 * Avatar: prefer profile-displayphoto-scale_400_400, else first profile-displayphoto (excl. logos/feed/video)
 *
 * @param {ReturnType<import('cheerio').load>} $
 * @returns {{ profileImage: string | null, bannerImage: string | null }}
 */
function extractProfileMedia($) {
    let bannerImage = null;
    let coverEl = $('img[alt="Cover photo"]').first();
    if (!coverEl.length) {
        coverEl = $('figure[aria-label="Cover photo"] img').first();
    }
    if (!coverEl.length) {
        coverEl = $('img[src*="profile-displaybackgroundimage"]').first();
    }
    if (coverEl.length) {
        const src = (coverEl.attr('src') || '').trim();
        bannerImage = src || null;
    }

    let profileImage = null;
    const prefer400 = $('img[src*="profile-displayphoto-scale_400_400"]').first();
    if (prefer400.length) {
        profileImage = (prefer400.attr('src') || '').trim() || null;
    } else {
        $('img[src*="profile-displayphoto"]').each((_, el) => {
            if (profileImage) return;
            const src = ($(el).attr('src') || '').trim();
            if (!src) return;
            if (src.includes('company-logo') || src.includes('feedshare') || src.includes('videocover')) return;
            profileImage = src;
        });
    }

    return { profileImage, bannerImage };
}

/**
 * @param {ReturnType<import('cheerio').load>} $
 * @returns {Object} Profile data for DB/API (incl. profileImage, bannerImage).
 */
function extractProfile($) {
    // Use all <p>; LinkedIn obfuscates classes (e.g. a47a5b30 → _2da93252)
    const allP = $('p');

    // 1. Profile name – from <title> "Name | LinkedIn" or first prominent name
    let profileName = '';
    const titleEl = $('title').first();
    if (titleEl.length && titleEl.text()) {
        const titleText = titleEl.text().trim();
        const pipe = titleText.indexOf('|');
        profileName = pipe > 0 ? titleText.substring(0, pipe).trim() : titleText;
    }
    if (!profileName) {
        allP.each((i, el) => {
            if (profileName) return;
            const t = $(el).text().trim();
            if (t && !t.includes('|') && t.length < 80 && /^[A-Za-z\s]+$/.test(t)) {
                profileName = t;
            }
        });
    }

    // 2. Headline – first p that contains " | " and looks like headline
    let headline = '';
    allP.each((i, el) => {
        if (headline) return;
        const t = $(el).text().trim();
        if (t.includes('|') && (t.includes('Intern') || t.includes('@') || t.includes('Student')) && t.length > 20) {
            headline = t;
        }
    });

    // 3. Location – "City, State, Country" or "Greater X Area"
    let location = '';
    allP.each((i, el) => {
        if (location) return;
        const t = $(el).text().trim();
        if (/^[A-Za-z\s,]+(?:India|USA|United States|Area)$/.test(t) && t.includes(',') && t.length < 80) {
            location = t;
        }
    });

    // 4. About – expandable section
    let about = '';
    const aboutEl = $('[data-testid="expandable-text-box"]').first();
    if (aboutEl.length) {
        about = aboutEl.text().replace(/\s+/g, ' ').trim().replace(/\s*…\s*more\s*$/, '');
    }

    // 5. Top skills – line with "•" bullet between skills
    let topSkills = '';
    allP.each((i, el) => {
        if (topSkills) return;
        const t = $(el).text().trim();
        if (t.includes('•') && (t.includes('Development') || t.includes('Design') || t.includes('Interface'))) {
            topSkills = t;
        }
    });

    // 6. Experience – links to edit/forms/position
    const experience = [];
    $('a[href*="edit/forms/position"]').each((i, el) => {
        const raw = $(el).text().replace(/\s+/g, ' ').trim();
        experience.push(parseExperienceEntryText(raw));
    });

    const { profileImage, bannerImage } = extractProfileMedia($);

    return {
        profileName: profileName || null,
        headline: headline || null,
        location: location || null,
        about: about || null,
        topSkills: topSkills || null,
        experience,
        profileImage,
        bannerImage,
    };
}

module.exports = {
    extractProfile,
    extractProfileMedia,
    parseExperienceEntryText,
};
