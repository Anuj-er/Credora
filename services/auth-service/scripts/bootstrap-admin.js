const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const mongoose = require('mongoose');
const User = require('../src/models/User');

async function bootstrapAdmin() {
  const email = process.env.LOCAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.LOCAL_ADMIN_PASSWORD;

  if (!email || !password || password.length < 24) {
    throw new Error('Set LOCAL_ADMIN_EMAIL and a LOCAL_ADMIN_PASSWORD of at least 24 characters in the private root .env.');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const existingAdmin = await User.findOne({ role: 'admin' }).select('_id');
  if (existingAdmin) {
    console.log('An admin account already exists; no account was created.');
    return;
  }

  const existingUser = await User.findOne({ email }).select('_id');
  if (existingUser) {
    throw new Error('LOCAL_ADMIN_EMAIL is already used by another account.');
  }

  await User.create({
    name: 'Credora Development Admin',
    email,
    password,
    role: 'admin',
  });

  console.log('Created the initial admin account in the configured development database.');
}

bootstrapAdmin()
  .catch(() => {
    console.error('Admin bootstrap failed. Check the MongoDB connection and local admin settings.');
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
