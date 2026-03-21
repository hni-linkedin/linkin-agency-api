const express = require('express');
const apiKeyAuth = require('../middleware/apiKey');
const { getNetworkOverviewHandler } = require('../controllers/networkOverviewController');

const router = express.Router();

router.use(apiKeyAuth);
router.get('/overview/:clientId', getNetworkOverviewHandler);

module.exports = router;
