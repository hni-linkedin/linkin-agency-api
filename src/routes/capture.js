const express = require('express');
const router = express.Router();
const apiKeyAuth = require('../middleware/apiKey');
const upload = require('../middleware/upload');
const {
    createCapture,
    listCaptures,
    getCaptureById,
    getProfileByClient,
    getConnectionsByClient,
    getFollowersNetworkByClient,
    getFollowingByClient,
    getCapturesByClient,
    getImpressionsByClient,
    getEngagementsByClient,
    getAudienceByClient,
    getDemographicsByClient,
    getAudienceDemographicsByClient,
    getSummaryByClient,
    getHomeDataByClient,
    deleteCapture
} = require('../controllers/captureController');

// Apply API Key auth middleware to all routes in this router
router.use(apiKeyAuth);

router.post('/', upload.single('htmlFile'), createCapture);
router.get('/', listCaptures);
router.get('/profile/:clientId', getProfileByClient);
// Paginated lists from latest network_* capture (must be before /:id)
router.get('/connections/:clientId', getConnectionsByClient);
router.get('/followers/:clientId', getFollowersNetworkByClient);
router.get('/following/:clientId', getFollowingByClient);
router.get('/:id', getCaptureById);
router.get('/client/:clientId', getCapturesByClient);
router.get('/impressions/:clientId', getImpressionsByClient);
router.get('/engagements/:clientId', getEngagementsByClient);
router.get('/audience/:clientId', getAudienceByClient);
router.get('/demographics/:clientId', getDemographicsByClient);
router.get('/audience-demographics/:clientId', getAudienceDemographicsByClient);
router.get('/summary/:clientId', getSummaryByClient);
router.get('/home/:clientId', getHomeDataByClient);
router.delete('/:id', deleteCapture);

module.exports = router;
