const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Report = require('../models/Report');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const requirePasswordChange = require('../middleware/requirePasswordChange');
const { sendCredentialsEmail } = require('../utils/sendCredentials');

const router = express.Router();

function generateTempPassword() {
  return crypto.randomBytes(9).toString('base64url');
}

function generateClientSlug() {
  return `cli_${crypto.randomBytes(4).toString('hex')}`;
}

router.use(authenticate, authorize('manager'), requirePasswordChange);

router.post('/clients', async (req, res, next) => {
  try {
    const { email, name } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const clientEmail = String(email).toLowerCase().trim();
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const client = await User.create({
      email: clientEmail,
      name: name || null,
      passwordHash,
      role: 'client',
      clientId: generateClientSlug(),
      parentId: req.user._id,
      createdBy: req.user._id,
      forcePasswordChange: true,
      isActive: true,
    });

    sendCredentialsEmail({
      to: clientEmail,
      role: 'client',
      email: clientEmail,
      password: tempPassword,
    }).catch(() => {});

    return res.status(201).json({
      client: { id: client._id, email: client.email, clientId: client.clientId },
      credentials: { email: clientEmail, password: tempPassword },
    });
  } catch (error) {
    if (error?.code === 11000) {
      const field = Object.keys(error?.keyPattern || {})[0] || 'unknown';
      return res.status(409).json({ error: `Duplicate value for unique field: ${field}` });
    }
    return next(error);
  }
});

router.get('/clients', async (req, res, next) => {
  try {
    const clients = await User.find({ role: 'client', parentId: req.user._id })
      .select('_id email name clientId isActive createdAt')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ clients });
  } catch (error) {
    return next(error);
  }
});

router.get('/clients/:clientId', async (req, res, next) => {
  try {
    const client = await User.findOne({
      role: 'client',
      clientId: req.params.clientId,
      parentId: req.user._id,
    })
      .select('_id email name clientId isActive createdAt')
      .lean();

    if (!client) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.json({ client });
  } catch (error) {
    return next(error);
  }
});

router.patch('/clients/:clientId', async (req, res, next) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be boolean' });
    }

    const client = await User.findOneAndUpdate(
      { role: 'client', clientId: req.params.clientId, parentId: req.user._id },
      { $set: { isActive } },
      { new: true }
    )
      .select('_id email clientId isActive')
      .lean();

    if (!client) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.json({ client });
  } catch (error) {
    return next(error);
  }
});

router.post('/clients/:clientId/reports', async (req, res, next) => {
  try {
    const { title, sections = [] } = req.body || {};
    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const client = await User.findOne({
      role: 'client',
      clientId: req.params.clientId,
      parentId: req.user._id,
    }).select('_id');

    if (!client) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const report = await Report.create({
      clientId: client._id,
      managerId: req.user._id,
      title,
      sections,
      status: 'draft',
    });

    return res.status(201).json({ report });
  } catch (error) {
    return next(error);
  }
});

router.get('/clients/:clientId/reports', async (req, res, next) => {
  try {
    const client = await User.findOne({
      role: 'client',
      clientId: req.params.clientId,
      parentId: req.user._id,
    }).select('_id');

    if (!client) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const reports = await Report.find({ clientId: client._id, managerId: req.user._id })
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({ reports });
  } catch (error) {
    return next(error);
  }
});

router.patch('/clients/:clientId/reports/:reportId', async (req, res, next) => {
  try {
    const client = await User.findOne({
      role: 'client',
      clientId: req.params.clientId,
      parentId: req.user._id,
    }).select('_id');

    if (!client) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updates = {};
    const { title, sections, status } = req.body || {};
    if (title !== undefined) updates.title = title;
    if (sections !== undefined) updates.sections = sections;
    if (status !== undefined) {
      updates.status = status;
      if (status === 'published') {
        updates.publishedAt = new Date();
      }
    }

    const report = await Report.findOneAndUpdate(
      {
        _id: req.params.reportId,
        clientId: client._id,
        managerId: req.user._id,
      },
      { $set: updates },
      { new: true }
    ).lean();

    if (!report) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.json({ report });
  } catch (error) {
    return next(error);
  }
});

router.delete('/clients/:clientId/reports/:reportId', async (req, res, next) => {
  try {
    const client = await User.findOne({
      role: 'client',
      clientId: req.params.clientId,
      parentId: req.user._id,
    }).select('_id');

    if (!client) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const deleted = await Report.findOneAndDelete({
      _id: req.params.reportId,
      clientId: client._id,
      managerId: req.user._id,
    }).lean();

    if (!deleted) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
