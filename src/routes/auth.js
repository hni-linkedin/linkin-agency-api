const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const authenticate = require('../middleware/authenticate');
const { hashToken, signAccessToken, signRefreshToken } = require('../utils/tokens');

const router = express.Router();
const REFRESH_COOKIE = 'refreshToken';

function refreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await user.comparePassword(password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    const refreshHash = hashToken(refreshToken);
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    await RefreshToken.create({
      userId: user._id,
      token: refreshHash,
      expiresAt: new Date(payload.exp * 1000),
    });

    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    return res.json({
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name || null,
        forcePasswordChange: user.forcePasswordChange,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/refresh', async (req, res, _next) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      return res.status(401).json({ error: 'Missing refresh token' });
    }

    const tokenHash = hashToken(refreshToken);
    const tokenDoc = await RefreshToken.findOne({ token: tokenHash });
    if (!tokenDoc || tokenDoc.expiresAt <= new Date()) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.userId).lean();
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const accessToken = signAccessToken(user);
    return res.json({ accessToken });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await RefreshToken.deleteMany({ userId: req.user._id });
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    const user = await User.findById(req.user._id);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validPassword = await user.comparePassword(currentPassword);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.forcePasswordChange = false;
    await user.save();

    return res.status(200).json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.patch('/profile', authenticate, async (req, res, next) => {
  try {
    const { name } = req.body || {};
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const user = await User.findOneAndUpdate(
      { _id: req.user._id, isActive: true },
      { $set: { name: name.trim() } },
      { new: true }
    )
      .select('_id email role name forcePasswordChange')
      .lean();

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name,
        forcePasswordChange: user.forcePasswordChange,
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
