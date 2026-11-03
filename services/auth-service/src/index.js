const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const Redis = require('ioredis');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || process.env.AUTH_SERVICE_PORT || 3001;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// ── Redis connection ──────────────────────────────────────────────────────────
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => console.log('✅ Auth service connected to Redis'));
redis.on('error', (err) => console.error('❌ Redis error:', err.message));

// ── MongoDB connection ────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cert-auth';

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('✅ Auth service connected to MongoDB'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'healthy' : 'starting',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: databaseReady ? 'connected' : 'disconnected',
  });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🔐 Auth Service running on port ${PORT}`);
});

module.exports = app;
