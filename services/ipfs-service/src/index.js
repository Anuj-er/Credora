const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const Redis = require('ioredis');

const ipfsRoutes = require('./routes/ipfsRoutes');

const app = express();
const PORT = process.env.PORT || process.env.IPFS_SERVICE_PORT || 3004;

// Redis connection
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

redis.on('connect', () => {
  console.log('✅ IPFS Service connected to Redis');
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
});

// Make redis available globally
global.redisClient = redis;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
  const redisReady = redis.status === 'ready';
  res.status(redisReady ? 200 : 503).json({
    success: true,
    service: 'ipfs-service',
    status: redisReady ? 'healthy' : 'starting',
    timestamp: new Date().toISOString(),
    redis: redisReady ? 'connected' : 'disconnected',
  });
});

// Routes
app.use('/api/ipfs', ipfsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

app.listen(PORT, () => {
  console.log(`📦 IPFS Service running on port ${PORT}`);
});

module.exports = app;
