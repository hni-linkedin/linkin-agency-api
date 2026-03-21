const logger = require('../utils/logger');
const { getNetworkOverview } = require('../services/networkOverviewService');

async function getNetworkOverviewHandler(req, res) {
  try {
    const { clientId } = req.params;
    const data = await getNetworkOverview(clientId);
    return res.json(data);
  } catch (err) {
    logger.error(
      `Network overview failed for clientId=${req.params.clientId}: ${err?.message}`,
      err?.stack
    );
    return res.status(500).json({
      success: false,
      error: err?.message || 'Internal server error',
    });
  }
}

module.exports = {
  getNetworkOverviewHandler,
};
