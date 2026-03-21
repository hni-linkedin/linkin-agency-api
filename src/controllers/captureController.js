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
            const d = parseResult.data;
            summary = {
                profileName: d.profileName ?? null,
                headline: d.headline ?? null,
                location: d.location ?? null,
                about: d.about ? (d.about.length > 200 ? d.about.slice(0, 200) + '…' : d.about) : null,
                topSkills: d.topSkills ?? null,
                experienceCount: Array.isArray(d.experience) ? d.experience.length : 0,
                experience: Array.isArray(d.experience) ? d.experience.slice(0, 5) : [],
            };
        } else if (data.pageType === 'network_connections') {
            const d = parseResult.data;
            summary = {
                connectionCount: Array.isArray(d.connections) ? d.connections.length : 0,
                totalCount: d.totalCount ?? null,
                connections: (d.connections || []).slice(0, 5),
            };
        } else if (data.pageType === 'network_following') {
            const d = parseResult.data;
            summary = {
                followingCount: Array.isArray(d.following) ? d.following.length : 0,
                following: (d.following || []).slice(0, 5),
            };
        } else if (data.pageType === 'network_followers') {
            const d = parseResult.data;
            summary = {
                followerCount: Array.isArray(d.followers) ? d.followers.length : 0,
                followers: (d.followers || []).slice(0, 5),
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
        const { page = 1, limit = 10, offset, clientId, pageType } = req.query;

        const query = { deleted: false };
        if (clientId) query.clientId = clientId;
        if (pageType) query.pageType = pageType;

        const parsePositiveInt = (v) => {
            const n = parseInt(v, 10);
            return Number.isFinite(n) && n > 0 ? n : null;
        };

        const parseNonNegativeInt = (v) => {
            const n = parseInt(v, 10);
            return Number.isFinite(n) && n >= 0 ? n : null;
        };

        const limitNum = parsePositiveInt(limit);
        const offsetNum = parseNonNegativeInt(offset);
        const pageNum = parsePositiveInt(page);

        // If offset is provided, it takes precedence over page-based calculation.
        const effectiveSkip =
            offsetNum !== null
                ? offsetNum
                : (pageNum !== null && limitNum !== null ? (pageNum - 1) * limitNum : 0);

        const captures = await Capture.find(query)
            .select('-parsedData -agentVersion -cloudinaryUrl -cloudinaryId')
            .sort({ capturedAt: -1 })
            .skip(effectiveSkip)
            .limit(limitNum || 10);

        const total = await Capture.countDocuments(query);

        // `count` should represent the total number of matching docs (no pagination)
        res.json({ success: true, count: total, total, data: captures });
    } catch (error) {
        next(error);
    }
};

// GET /api/capture/:id
const getCaptureById = async (req, res, next) => {
    try {
        const capture = await Capture.findOne({ _id: req.params.id, deleted: false })
            .select('-parsedData -agentVersion -cloudinaryUrl -cloudinaryId');
        if (!capture) {
            return res.status(404).json({ success: false, error: 'Capture not found' });
        }
        res.json({ success: true, data: capture });
    } catch (error) {
        next(error);
    }
};

// GET /api/capture/profile/:clientId – latest profile_main parsed data for frontend
const getProfileByClient = async (req, res, next) => {
    try {
        const capture = await Capture.findOne({
            clientId: req.params.clientId,
            pageType: 'profile_main',
            deleted: false,
        }).sort({ capturedAt: -1 });

        if (!capture) {
            return res.status(404).json({ success: false, error: 'Profile capture not found' });
        }

        res.json({
            success: true,
            data: capture.parsedData?.data || null,
            capturedAt: capture.capturedAt,
            captureId: capture._id,
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/capture/client/:clientId
const getCapturesByClient = async (req, res, next) => {
    try {
        const { clientId } = req.params;
        const { pageType, groupBy, latestOnly, page, limit, offset } = req.query;

        // Base filter
        let filter = { clientId, deleted: false };
        if (pageType) {
            filter.pageType = pageType;
        }

        const parsePositiveInt = (v) => {
            const n = parseInt(v, 10);
            return Number.isFinite(n) && n > 0 ? n : null;
        };

        const parseNonNegativeInt = (v) => {
            const n = parseInt(v, 10);
            return Number.isFinite(n) && n >= 0 ? n : null;
        };

        const pageNum = parsePositiveInt(page);
        const limitNum = parsePositiveInt(limit);
        const offsetNum = parseNonNegativeInt(offset);

        const skipVal =
            offsetNum !== null && limitNum !== null
                ? offsetNum
                : (pageNum !== null && limitNum !== null ? (pageNum - 1) * limitNum : null);

        const hasPagination = skipVal !== null;

        // Handle GroupBy PageType (for Freshness Map)
        if (groupBy === 'pageType') {
            // Total number of groups (distinct pageType), without skip/limit
            const countResult = await Capture.aggregate([
                { $match: filter },
                { $group: { _id: '$pageType' } },
                { $count: 'count' }
            ]);
            const totalGroups = countResult?.[0]?.count ?? 0;

            const pipeline = [
                { $match: filter },
                { $sort: { capturedAt: -1 } },
                {
                    $group: {
                        _id: '$pageType',
                        latestCapture: { $first: '$$ROOT' }
                    }
                },
                { $replaceRoot: { newRoot: '$latestCapture' } },
                { $sort: { capturedAt: -1 } }
            ];

            // Ensure grouped response doesn't include large/undesired fields
            pipeline.push({ $project: { parsedData: 0, agentVersion: 0, cloudinaryUrl: 0, cloudinaryId: 0 } });

            if (hasPagination) {
                pipeline.push({ $skip: skipVal });
                pipeline.push({ $limit: limitNum });
            }

            const captures = await Capture.aggregate(pipeline);
            // `count` should represent the total number of groups (no pagination)
            return res.json({ success: true, count: totalGroups, data: captures });
        }

        // Standard fetch
        // Total number of matching docs (no pagination)
        const totalMatches = await Capture.countDocuments(filter);

        const query = Capture.find(filter)
            .select('-parsedData -agentVersion -cloudinaryUrl -cloudinaryId')
            .sort({ capturedAt: -1 });
        if (latestOnly === 'true') {
            query.limit(1);
        } else if (hasPagination) {
            query.skip(skipVal).limit(limitNum);
        }

        const captures = await query.exec();
        // `count` represents total matches, while `data` is just the current page slice
        res.json({ success: true, count: totalMatches, data: captures });
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
        })
            .select('-parsedData -agentVersion -cloudinaryUrl -cloudinaryId')
            .sort({ capturedAt: -1 });
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
        })
            .select('-parsedData -agentVersion -cloudinaryUrl -cloudinaryId')
            .sort({ capturedAt: -1 });
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
        })
            .select('-parsedData -agentVersion -cloudinaryUrl -cloudinaryId')
            .sort({ capturedAt: -1 });
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
        })
            .select('-parsedData -agentVersion -cloudinaryUrl -cloudinaryId')
            .sort({ capturedAt: -1 });
        res.json({ success: true, count: captures.length, data: captures });
    } catch (error) {
        next(error);
    }
};

// GET /api/capture/audience-demographics/:clientId
// Latest analytics_audience_demographics parsed data for the frontend.
const getAudienceDemographicsByClient = async (req, res, next) => {
    try {
        const capture = await Capture.findOne({
            clientId: req.params.clientId,
            pageType: 'analytics_audience_demographics',
            deleted: false
        })
            // Keep response focused; omit large/raw storage fields.
            .select('clientId clientName pageType capturedAt tabUrl parsedData parseSuccess')
            .sort({ capturedAt: -1 });

        if (!capture) {
            return res.status(404).json({ success: false, error: 'Audience demographics capture not found' });
        }

        res.json({
            success: true,
            // Backward-compatible: `data` is only the parsedData.data payload.
            data: capture.parsedData?.data || null,
            capturedAt: capture.capturedAt,
            captureId: capture._id,
        });
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
            { $replaceRoot: { newRoot: '$latestCapture' } },
            // Reduce payload size: don't send parsedData / agentVersion in freshness panel
            { $project: { parsedData: 0, agentVersion: 0, cloudinaryUrl: 0, cloudinaryId: 0 } }
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
            const rest = { ...data };
            delete rest.top_posts;
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
            // Home summary keeps `profile` small to reduce payload size.
            // Parser output uses `profileName`; frontend wants `{ name, headline }`.
            profile: profile?.parsedData?.data
                ? {
                    name: profile.parsedData.data.profileName ?? null,
                    headline: profile.parsedData.data.headline ?? null
                }
                : null,
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
    getProfileByClient,
    getCapturesByClient,
    getImpressionsByClient,
    getEngagementsByClient,
    getAudienceByClient,
    getDemographicsByClient,
    getAudienceDemographicsByClient,
    getSummaryByClient,
    getHomeDataByClient,
    deleteCapture
};
