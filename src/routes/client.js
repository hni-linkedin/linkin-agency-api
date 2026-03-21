const express = require('express');
const Report = require('../models/Report');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const requirePasswordChange = require('../middleware/requirePasswordChange');

const router = express.Router();

router.use(authenticate, authorize('client'), requirePasswordChange);

router.get('/reports', async (req, res, next) => {
  try {
    const reports = await Report.find({
      clientId: req.user._id,
      status: 'published',
    })
      .sort({ publishedAt: -1 })
      .lean();

    return res.json({ reports });
  } catch (error) {
    return next(error);
  }
});

router.get('/reports/:reportId', async (req, res, next) => {
  try {
    const report = await Report.findOne({
      _id: req.params.reportId,
      clientId: req.user._id,
      status: 'published',
    }).lean();

    if (!report) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.json({ report });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
