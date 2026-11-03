const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const Redis = require('ioredis');

const app = express();
const PORT = process.env.PORT || process.env.GATEWAY_PORT || 3000;

// ── Redis connection ──────────────────────────────────────────────────────────
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) return null;
    return Math.min(times * 200, 2000);
  },
});

redis.on('connect', () => console.log('✅ Gateway connected to Redis'));
redis.on('error', (err) => console.error('❌ Redis error:', err.message));

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(morgan('combined'));

// ── Rate limiting with Redis store ────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  }),
  message: {
    success: false,
    message: 'Too many requests, please try again after 15 minutes.',
  },
});

app.use(limiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const redisReady = redis.status === 'ready';
  res.status(redisReady ? 200 : 503).json({
    status: redisReady ? 'healthy' : 'starting',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    redis: redisReady ? 'connected' : 'disconnected',
  });
});

// ── Proxy configuration ──────────────────────────────────────────────────────
const proxyOptions = (target) => ({
  target,
  changeOrigin: true,
  timeout: 30000,
  proxyTimeout: 30000,
  onError: (err, _req, res) => {
    console.error(`Proxy error: ${err.message}`);
    if (!res.headersSent) {
      res.status(502).json({
        success: false,
        message: 'Service temporarily unavailable',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      });
    }
  },
  onProxyReq: (proxyReq, req) => {
    console.log(`[PROXY] ${req.method} ${req.originalUrl} → ${target}`);
  },
});

// Auth Service
app.use(
  '/api/auth',
  createProxyMiddleware(
    proxyOptions(process.env.AUTH_SERVICE_URL || 'http://localhost:3001')
  )
);

// Certificate Service
app.use(
  '/api/certificates',
  createProxyMiddleware(
    proxyOptions(process.env.CERTIFICATE_SERVICE_URL || 'http://localhost:3002')
  )
);

// Blockchain Service
app.use(
  '/api/blockchain',
  createProxyMiddleware(
    proxyOptions(process.env.BLOCKCHAIN_SERVICE_URL || 'http://localhost:3003')
  )
);

// IPFS Service
app.use(
  '/api/ipfs',
  createProxyMiddleware(
    proxyOptions(process.env.IPFS_SERVICE_URL || 'http://localhost:3004')
  )
);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log(`   Auth Service    → ${process.env.AUTH_SERVICE_URL || 'http://localhost:3001'}`);
  console.log(`   Cert Service    → ${process.env.CERTIFICATE_SERVICE_URL || 'http://localhost:3002'}`);
  console.log(`   Blockchain Svc  → ${process.env.BLOCKCHAIN_SERVICE_URL || 'http://localhost:3003'}`);
  console.log(`   IPFS Service    → ${process.env.IPFS_SERVICE_URL || 'http://localhost:3004'}`);
});

module.exports = app;
