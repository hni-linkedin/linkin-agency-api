const cheerio = require('cheerio');
const logger = require('../utils/logger');
const { extractImpressions } = require('./extractImpressions');
const { extractEngagements } = require('./extractEngagements');
const { extractAudience } = require('./extractAudience');
const { extractDemographics } = require('./extractDemographics');
const { extractSearchAppearancesWhere } = require('./extractSearchAppearancesWhere');
const { extractSearchAppearancesCompanies } = require('./extractSearchAppearancesCompanies');
const { extractSearchAppearancesTitles } = require('./extractSearchAppearancesTitles');
const { extractSearchAppearancesFoundFor } = require('./extractSearchAppearancesFoundFor');
const { extractProfileViews } = require('./extractProfileViews');
const { extractProfile } = require('./extractProfile');
const { extractConnections } = require('./extractConnections');
const { extractFollowers } = require('./extractFollowers');
const { extractFollowing } = require('./extractFollowing');

/**
 * 7.4 Parser Rules
 * - The parser must never throw an uncaught exception
 * - If a selector finds nothing, return null for that field — do not return undefined
 * - If the entire parse fails, return the top-level object with parse_error set and data as an empty object {}
 * - Numbers must be returned as JavaScript Numbers (not strings)
 */

const parseHtml = (htmlString, pageType) => {
    const parsedAt = new Date().toISOString();
    let result = {
        pageType,
        parsedAt,
        parse_error: null,
        data: {}
    };

    try {
        const $ = cheerio.load(htmlString);

        switch (pageType) {
            case 'profile_main':
                result.data = parseProfileMain($);
                break;
            case 'analytics_posts_impressions_7d':
            case 'analytics_posts_impressions_28d':
            case 'analytics_posts_impressions_90d':
                result.data = parseAnalyticsPosts($, pageType);
                break;
            case 'analytics_posts_engagements_7d':
            case 'analytics_posts_engagements_28d':
            case 'analytics_posts_engagements_90d':
                result.data = extractEngagements($);
                break;
            case 'analytics_audience':
            case 'analytics_audience_7d':
            case 'analytics_audience_28d':
            case 'analytics_audience_90d':
                result.data = extractAudience($);
                break;
            case 'analytics_audience_demographics':
                result.data = extractDemographics($);
                break;
            case 'analytics_search_appearances_where':
                result.data = extractSearchAppearancesWhere($);
                break;
            case 'analytics_search_appearances_companies':
                result.data = extractSearchAppearancesCompanies($);
                break;
            case 'analytics_search_appearances_titles':
                result.data = extractSearchAppearancesTitles($);
                break;
            case 'analytics_search_appearances_found_for':
                result.data = extractSearchAppearancesFoundFor($);
                break;
            case 'analytics_profile_views':
                result.data = extractProfileViews($);
                break;
            case 'network_connections':
                result.data = extractConnections($);
                break;
            case 'network_followers':
                result.data = extractFollowers($);
                break;
            case 'network_following':
                result.data = extractFollowing($);
                break;
            default:
                // Other types returns empty data
                break;
        }

    } catch (error) {
        logger.error('Parser error', error);
        result.parse_error = error.message;
        result.data = {};
    }

    return result;
};

// --- Helper: Clean and parse number ---
const parseNumber = (str) => {
    if (!str) return null;
    // Remove everything except numbers, dots, and minus signs
    const cleaned = str.replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
};

// --- Parsers logic implementation ---

const parseProfileMain = ($) => {
    return extractProfile($);
};

const parseAnalyticsPosts = ($, pageType) => {
    return extractImpressions($);
};

module.exports = {
    parseHtml
};
