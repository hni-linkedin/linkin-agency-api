const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const requirePasswordChange = require('../middleware/requirePasswordChange');
const { sendCredentialsEmail } = require('../utils/sendCredentials');

const router = express.Router();

function generateTempPassword() {
  return crypto.randomBytes(9).toString('base64url');
}

router.use(authenticate, authorize('admin'), requirePasswordChange);

router.post('/managers', async (req, res, next) => {
  try {
    const email = req.body?.email ? String(req.body.email).toLowerCase().trim() : null;
    const managerEmail = email || `manager_${Date.now()}@linkinagency.local`;
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const manager = await User.create({
      email: managerEmail,
      passwordHash,
      role: 'manager',
      createdBy: req.user._id,
      forcePasswordChange: true,
      isActive: true,
      parentId: null,
    });

    sendCredentialsEmail({
      to: managerEmail,
      role: 'manager',
      email: managerEmail,
      password: tempPassword,
    }).catch(() => {});

    return res.status(201).json({
      manager: { id: manager._id, email: manager.email },
      credentials: { email: managerEmail, password: tempPassword },
    });
  } catch (error) {
    if (error?.code === 11000) {
      const field = Object.keys(error?.keyPattern || {})[0] || 'unknown';
      if (field === 'email') {
        return res.status(409).json({ error: 'Manager email already exists' });
      }
      return res.status(409).json({ error: `Duplicate value for unique field: ${field}` });
    }
    return next(error);
  }
});

router.get('/managers', async (req, res, next) => {
  try {
    const managers = await User.aggregate([
      { $match: { role: 'manager' } },
      {
        $lookup: {
          from: 'users',
          let: { managerId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$role', 'client'] }, { $eq: ['$parentId', '$$managerId'] }],
                },
              },
            },
          ],
          as: 'clients',
        },
      },
      {
        $project: {
          _id: 1,
          email: 1,
          isActive: 1,
          createdAt: 1,
          clientsCount: { $size: '$clients' },
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    return res.json({
      managers: managers.map((m) => ({
        id: m._id,
        email: m.email,
        isActive: m.isActive,
        createdAt: m.createdAt,
        clientsCount: m.clientsCount,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/managers/:id', async (req, res, next) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be boolean' });
    }

    const manager = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'manager' },
      { $set: { isActive } },
      { new: true }
    ).lean();

    if (!manager) {
      return res.status(404).json({ error: 'Manager not found' });
    }

    return res.json({ manager: { id: manager._id, email: manager.email, isActive: manager.isActive } });
  } catch (error) {
    return next(error);
  }
});

router.delete('/managers/:id', async (req, res, next) => {
  try {
    const manager = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'manager' },
      { $set: { isActive: false } },
      { new: true }
    ).lean();

    if (!manager) {
      return res.status(404).json({ error: 'Manager not found' });
    }

    await User.updateMany(
      { role: 'client', parentId: manager._id },
      { $set: { isActive: false } }
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
