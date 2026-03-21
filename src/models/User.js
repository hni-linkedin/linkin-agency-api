const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['admin', 'manager', 'client'], required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    clientId: { type: String },
    name: { type: String, default: null, trim: true },
    isActive: { type: Boolean, default: true },
    forcePasswordChange: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Ensure uniqueness only for actual client slugs (non-null strings).
UserSchema.index(
  { clientId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientId: { $type: 'string' } },
  }
);

UserSchema.methods.comparePassword = async function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

module.exports = mongoose.model('User', UserSchema);
