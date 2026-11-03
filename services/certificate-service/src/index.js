const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const certificateRoutes = require('./routes/certificateRoutes');
const { startIPFSWorker } = require('./workers/ipfsWorker');
const { startBlockchainWorker } = require('./workers/blockchainWorker');

const app = express();
const PORT = process.env.PORT || process.env.CERTIFICATE_SERVICE_PORT || 3002;

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// ── MongoDB connection ────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cert-certificates';

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('✅ Certificate service connected to MongoDB');

    // Start BullMQ workers after MongoDB is connected
    startIPFSWorker();
    startBlockchainWorker();
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/certificates', certificateRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'healthy' : 'starting',
    service: 'certificate-service',
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
  console.log(`📜 Certificate Service running on port ${PORT}`);
});

module.exports = app;
