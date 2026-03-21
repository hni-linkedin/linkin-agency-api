const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../src/models/User');

dotenv.config({ path: path.join(__dirname, '..', '.env'), override: true });

function getMongoUri() {
  const uri = process.env.MONGODB_URI?.trim();
  if (uri) return uri;

  const user = process.env.MONGO_USER?.trim();
  const pass = process.env.MONGO_PASSWORD?.trim();
  const host = process.env.MONGO_HOST?.trim();
  const db = process.env.MONGO_DB?.trim();
  if (user && pass && host && db) {
    return `mongodb+srv://${user}:${encodeURIComponent(pass)}@${host}/${db}`;
  }

  throw new Error('Set MONGODB_URI or MONGO_USER/MONGO_PASSWORD/MONGO_HOST/MONGO_DB');
}

async function seed() {
  try {
    await mongoose.connect(getMongoUri());
    const exists = await User.findOne({ role: 'admin' });
    if (exists) {
      console.log('Admin already exists');
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(process.env.ADMIN_INIT_PASSWORD, 12);
    await User.create({
      email: process.env.ADMIN_EMAIL,
      passwordHash,
      role: 'admin',
      forcePasswordChange: false,
      isActive: true,
    });
    console.log('Admin seeded');
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed admin:', error.message);
    process.exit(1);
  }
}

seed();
