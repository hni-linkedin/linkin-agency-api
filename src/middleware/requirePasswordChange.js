module.exports = (req, res, next) => {
  if (req.user.forcePasswordChange) {
    return res.status(403).json({
      error: 'PASSWORD_CHANGE_REQUIRED',
      message: 'You must set a new password before continuing.',
    });
  }
  return next();
};
