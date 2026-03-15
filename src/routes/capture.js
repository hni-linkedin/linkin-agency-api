const express = require('express');
const router = express.Router();
const apiKeyAuth = require('../middleware/apiKey');
const upload = require('../middleware/upload');
const {
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
} = require('../controllers/captureController');

// Apply API Key auth middleware to all routes in this router
router.use(apiKeyAuth);

router.post('/', upload.single('htmlFile'), createCapture);
router.get('/', listCaptures);
router.get('/:id', getCaptureById);
router.get('/client/:clientId', getCapturesByClient);
router.get('/impressions/:clientId', getImpressionsByClient);
router.get('/engagements/:clientId', getEngagementsByClient);
router.get('/audience/:clientId', getAudienceByClient);
router.get('/demographics/:clientId', getDemographicsByClient);
router.get('/summary/:clientId', getSummaryByClient);
router.get('/home/:clientId', getHomeDataByClient);
router.delete('/:id', deleteCapture);

module.exports = router;
