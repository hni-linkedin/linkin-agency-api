const logger = require('../utils/logger');
const { capturePayloadSchema } = require('../utils/validators');
const { uploadHtmlToCloudinary } = require('../services/cloudinaryService');
const { parseHtml } = require('../services/parserService');
const Capture = require('../models/Capture');

// POST /api/capture
const createCapture = async (req, res, next) => {
    try {
        // 1. Zod Validation for body fields
        const validation = capturePayloadSchema.safeParse(req.body);
        if (!validation.success) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validation.error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }))
            });
        }

        const data = validation.data;
        const file = req.file;

        // Check if multer parsed the file
        if (!file) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: [{ field: 'htmlFile', message: 'htmlFile is required and must be text/html' }]
            });
        }

        // 2. Upload to Cloudinary
        const dateStr = new Date(data.capturedAt).toISOString().split('T')[0]; // YYYY-MM-DD
        const timestamp = new Date(data.capturedAt).getTime();

        // Path: linkinagency/clients/{clientId}/{pageType}/{YYYY-MM-DD}
        const folder = `linkinagency/clients/${data.clientId}/${data.pageType}/${dateStr}`;

        const cloudinaryOptions = {
            folder,
            public_id: timestamp.toString(),
            overwrite: false,
            use_filename: false
        };

        const cloudinaryResult = await uploadHtmlToCloudinary(file.buffer, cloudinaryOptions);

        // 3. Parse HTML
        const htmlString = file.buffer.toString('utf-8');
        const parseResult = parseHtml(htmlString, data.pageType);

        // 4. Save to MongoDB
        const newCapture = new Capture({
            clientId: data.clientId,
            clientName: data.clientName,
            pageType: data.pageType,
            capturedAt: new Date(data.capturedAt),
            tabUrl: data.tabUrl,
            cloudinaryUrl: cloudinaryResult.secure_url,
            cloudinaryId: cloudinaryResult.public_id,
            parsedData: parseResult,
            parseSuccess: parseResult.parse_error === null,
            agentVersion: data.agentVersion,
            notes: data.notes,
            deleted: false
        });

        await newCapture.save();

        // 5. Build summary
        let summary = {};
        if (data.pageType === 'profile_main') {
            summary = {
                postImpressions: parseResult.data.postImpressions,
                followers: parseResult.data.followers,
                topPostCount: parseResult.data.recentPosts?.length || 0
            };
        } else if (data.pageType.includes('impressions')) {
            summary = {
                mainMetric: parseResult.data.impressions?.totalImpression || '0'
            };
        } else if (data.pageType.includes('engagements')) {
            summary = {
                mainMetric: parseResult.data.engagements?.totalEngagements || '0'
            };
        } else if (data.pageType === 'analytics_audience') {
            summary = {
                mainMetric: parseResult.data.followers?.totalFollowers || '0'
            };
        } else if (data.pageType === 'analytics_search_appearances') {
            summary = {
                topJobTitle: parseResult.data.topSearcherTitles?.[0]?.label || parseResult.data.titlesFoundFor?.[0]?.label || 'N/A'
            };
        } else if (data.pageType === 'analytics_search_appearances_where') {
            summary = { totalAppearances: parseResult.data.totalAppearances, delta: parseResult.data.delta };
        } else if (data.pageType === 'analytics_search_appearances_companies') {
            summary = { count: parseResult.data.topSearcherCompanies?.length ?? 0 };
        } else if (data.pageType === 'analytics_search_appearances_titles') {
            summary = { count: parseResult.data.topSearcherTitles?.length ?? 0 };
        } else if (data.pageType === 'analytics_search_appearances_found_for') {
            summary = { count: parseResult.data.titlesFoundFor?.length ?? 0 };
        }

        // Return 201 response
        return res.status(201).json({
            success: true,
            captureId: newCapture._id,
            cloudinaryUrl: cloudinaryResult.secure_url,
            pageType: data.pageType,
            parsedAt: parseResult.parsedAt,
            summary
        });

    } catch (error) {
        next(error);
    }
};

// GET /api/capture
const listCaptures = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, clientId, pageType } = req.query;

        const query = { deleted: false };
        if (clientId) query.clientId = clientId;
        if (pageType) query.pageType = pageType;

        const captures = await Capture.find(query)
            .sort({ capturedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Capture.countDocuments(query);

        res.json({ success: true, count: captures.length, total, data: captures });
    } catch (error) {
        next(error);
    }
};

// GET /api/capture/:id
const getCaptureById = async (req, res, next) => {
    try {
        const capture = await Capture.findOne({ _id: req.params.id, deleted: false });
        if (!capture) {
            return res.status(404).json({ success: false, error: 'Capture not found' });
        }
        res.json({ success: true, data: capture });
    } catch (error) {
        next(error);
    }
};

// GET /api/capture/client/:clientId
const getCapturesByClient = async (req, res, next) => {
    try {
        const { clientId } = req.params;
        const { pageType, groupBy, latestOnly } = req.query;

        // Base filter
        let filter = { clientId, deleted: false };
        if (pageType) {
            filter.pageType = pageType;
        }

        // Handle GroupBy PageType (for Freshness Map)
        if (groupBy === 'pageType') {
            const pipeline = [
                { $match: filter },
                { $sort: { capturedAt: -1 } },
                {
                    $group: {
                        _id: '$pageType',
                        latestCapture: { $first: '$$ROOT' }
                    }
                },
                { $replaceRoot: { newRoot: '$latestCapture' } }
            ];

            const captures = await Capture.aggregate(pipeline);
            return res.json({ success: true, count: captures.length, data: captures });
        }

        // Standard fetch
        const query = Capture.find(filter).sort({ capturedAt: -1 });
        if (latestOnly === 'true') {
            query.limit(1);
        }

        const captures = await query.exec();
        res.json({ success: true, count: captures.length, data: captures });
    } catch (error) {
        next(error);
    }
};

// GET /api/capture/impressions/:clientId
const getImpressionsByClient = async (req, res, next) => {
    try {
        const captures = await Capture.find({
            clientId: req.params.clientId,
            pageType: { $regex: /impressions/ },
            deleted: false
        }).sort({ capturedAt: -1 });
        res.json({ success: true, count: captures.length, data: captures });
    } catch (error) {
        next(error);
    }
};

// GET /api/capture/engagements/:clientId
const getEngagementsByClient = async (req, res, next) => {
    try {
        const captures = await Capture.find({
            clientId: req.params.clientId,
            pageType: { $regex: /engagements/ },
            deleted: false
        }).sort({ capturedAt: -1 });
        res.json({ success: true, count: captures.length, data: captures });
    } catch (error) {
        next(error);
    }
};

// GET /api/capture/audience/:clientId
const getAudienceByClient = async (req, res, next) => {
    try {
        const captures = await Capture.find({
            clientId: req.params.clientId,
            pageType: 'analytics_audience',
            deleted: false
        }).sort({ capturedAt: -1 });
        res.json({ success: true, count: captures.length, data: captures });
    } catch (error) {
        next(error);
    }
};

const SEARCH_APPEARANCE_PAGE_TYPES = [
    'analytics_search_appearances_where',
    'analytics_search_appearances_companies',
    'analytics_search_appearances_titles',
    'analytics_search_appearances_found_for'
];

// GET /api/capture/demographics/:clientId (search appearance sections)
const getDemographicsByClient = async (req, res, next) => {
    try {
        const captures = await Capture.find({
            clientId: req.params.clientId,
            pageType: { $in: SEARCH_APPEARANCE_PAGE_TYPES },
            deleted: false
        }).sort({ capturedAt: -1 });
        res.json({ success: true, count: captures.length, data: captures });
    } catch (error) {
        next(error);
    }
};

// GET /api/capture/summary/:clientId
const getSummaryByClient = async (req, res, next) => {
    try {
        const { clientId } = req.params;

        // Fetch specific page types; search appearances = 4 section types combined
        const [profile, impressions7d, impressions28d, engagements28d, audience, searchWhere, searchCompanies, searchTitles, searchFoundFor, views] = await Promise.all([
            Capture.findOne({ clientId, pageType: 'profile_main', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_posts_impressions_7d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_posts_impressions_28d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_posts_engagements_28d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_audience', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_search_appearances_where', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_search_appearances_companies', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_search_appearances_titles', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_search_appearances_found_for', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_profile_views', deleted: false }).sort({ capturedAt: -1 })
        ]);

        const search = [searchWhere, searchCompanies, searchTitles, searchFoundFor].some(c => c?.parsedData?.data)
            ? {
                where: searchWhere?.parsedData?.data || null,
                companies: searchCompanies?.parsedData?.data?.topSearcherCompanies ?? null,
                titles: searchTitles?.parsedData?.data?.topSearcherTitles ?? null,
                foundFor: searchFoundFor?.parsedData?.data?.titlesFoundFor ?? null
            }
            : null;

        const summary = {
            profile: profile?.parsedData?.data || null,
            impressions7d: impressions7d?.parsedData?.data ? {
                ...impressions7d.parsedData.data.impressions,
                top_posts: impressions7d.parsedData.data.top_posts
            } : null,
            impressions28d: impressions28d?.parsedData?.data ? {
                ...impressions28d.parsedData.data.impressions,
                top_posts: impressions28d.parsedData.data.top_posts
            } : null,
            engagements28d: engagements28d?.parsedData?.data ? {
                ...engagements28d.parsedData.data.engagements,
                top_posts: engagements28d.parsedData.data.top_posts
            } : null,
            audience: audience?.parsedData?.data || null,
            search,
            profileViews: views?.parsedData?.data || null,
            lastCapturedAt: profile?.capturedAt || impressions28d?.capturedAt || impressions7d?.capturedAt || new Date()
        };

        res.json({ success: true, data: summary });
    } catch (error) {
        next(error);
    }
};

// GET /api/capture/home/:clientId
const getHomeDataByClient = async (req, res, next) => {
    try {
        const { clientId } = req.params;

        // Freshness Pipeline for Freshness Panel
        const freshnessPipeline = [
            { $match: { clientId, deleted: false } },
            { $sort: { capturedAt: -1 } },
            {
                $group: {
                    _id: '$pageType',
                    latestCapture: { $first: '$$ROOT' }
                }
            },
            { $replaceRoot: { newRoot: '$latestCapture' } }
        ];

        // Fetch everything in parallel; search = 4 section types
        const [
            freshnessData,
            profile,
            impressions7d,
            impressions28d,
            impressions90d,
            engagements7d,
            engagements28d,
            engagements90d,
            audience,
            audience7d,
            audience28d,
            audience90d,
            searchWhere,
            searchCompanies,
            searchTitles,
            searchFoundFor,
            views
        ] = await Promise.all([
            Capture.aggregate(freshnessPipeline),
            Capture.findOne({ clientId, pageType: 'profile_main', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_posts_impressions_7d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_posts_impressions_28d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_posts_impressions_90d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_posts_engagements_7d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_posts_engagements_28d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_posts_engagements_90d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_audience', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_audience_7d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_audience_28d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_audience_90d', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_search_appearances_where', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_search_appearances_companies', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_search_appearances_titles', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_search_appearances_found_for', deleted: false }).sort({ capturedAt: -1 }),
            Capture.findOne({ clientId, pageType: 'analytics_profile_views', deleted: false }).sort({ capturedAt: -1 })
        ]);

        const stripTopPosts = (data) => {
            if (!data) return null;
            const { top_posts, ...rest } = data;
            return rest;
        };

        const search = [searchWhere, searchCompanies, searchTitles, searchFoundFor].some(c => c?.parsedData?.data)
            ? {
                where: searchWhere?.parsedData?.data || null,
                companies: searchCompanies?.parsedData?.data?.topSearcherCompanies ?? null,
                titles: searchTitles?.parsedData?.data?.topSearcherTitles ?? null,
                foundFor: searchFoundFor?.parsedData?.data?.titlesFoundFor ?? null
            }
            : null;

        const summary = {
            profile: profile?.parsedData?.data || null,
            impressions7d: stripTopPosts(impressions7d?.parsedData?.data),
            impressions28d: stripTopPosts(impressions28d?.parsedData?.data),
            impressions90d: stripTopPosts(impressions90d?.parsedData?.data),
            engagements7d: stripTopPosts(engagements7d?.parsedData?.data),
            engagements28d: stripTopPosts(engagements28d?.parsedData?.data),
            engagements90d: stripTopPosts(engagements90d?.parsedData?.data),
            audience: audience?.parsedData?.data || null,
            audience7d: audience7d?.parsedData?.data || null,
            audience28d: audience28d?.parsedData?.data || null,
            audience90d: audience90d?.parsedData?.data || null,
            search,
            profileViews: views?.parsedData?.data || null,
            topPosts: impressions28d?.parsedData?.data?.top_posts ?? null,
            lastCapturedAt: profile?.capturedAt || impressions28d?.capturedAt || impressions7d?.capturedAt || new Date()
        };

        const homeData = {
            summary,
            freshnessData
        };

        res.json({ success: true, data: homeData });
    } catch (error) {
        next(error);
    }
};

// DELETE /api/capture/:id
const deleteCapture = async (req, res, next) => {
    try {
        const capture = await Capture.findOneAndUpdate(
            { _id: req.params.id, deleted: false },
            { deleted: true },
            { new: true }
        );
        if (!capture) {
            return res.status(404).json({ success: false, error: 'Capture not found' });
        }
        res.json({ success: true, data: { _id: capture._id, deleted: true } });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createCapture,
    listCaptures,
    getCaptureById,
    getCapturesByClient,
    getImpressionsByClient,
    getEngagementsByClient,
    getAudienceByClient,
    getDemographicsByClient,
    getSummaryByClient,
    getHomeDataByClient,
    deleteCapture
};
