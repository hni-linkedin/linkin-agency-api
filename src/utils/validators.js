const { z } = require('zod');

const pageTypeEnum = z.enum([
    'analytics_posts_impressions_7d',
    'analytics_posts_impressions_28d',
    'analytics_posts_impressions_90d',
    'analytics_posts_engagements_7d',
    'analytics_posts_engagements_28d',
    'analytics_posts_engagements_90d',
    'analytics_audience',
    'analytics_audience_7d',
    'analytics_audience_28d',
    'analytics_audience_90d',
    'analytics_audience_demographics',
    'analytics_search_appearances',
    'analytics_profile_views',
    'profile_main',
    'network_connections',
    'network_following',
    'feed'
]);

const capturePayloadSchema = z.object({
    clientId: z.string().min(1, { message: "clientId is required" }),
    pageType: pageTypeEnum,
    capturedAt: z.string().datetime({ message: "capturedAt must be a valid ISO 8601 string" }),
    tabUrl: z.string().url({ message: "tabUrl must be a valid URL" }),
    clientName: z.string().optional(),
    notes: z.string().optional(),
    agentVersion: z.string().optional()
});

module.exports = {
    pageTypeEnum,
    capturePayloadSchema
};
