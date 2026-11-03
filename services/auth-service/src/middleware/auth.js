const jwt = require('jsonwebtoken');
const Redis = require('ioredis');
const getJwtSecret = require('../../../../shared/getJwtSecret');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
});

/**
 * JWT authentication middleware.
 * Extracts the token from the Authorization header, verifies it,
 * checks the Redis blacklist for logged-out tokens, and attaches
 * the decoded user payload to req.user.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const token = authHeader.split(' ')[1];

    // Check if token is blacklisted (logged-out)
    const isBlacklisted = await redis.get(`bl_${token}`);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Token has been invalidated. Please log in again.',
      });
    }

    const decoded = jwt.verify(token, getJwtSecret());

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      institutionId: decoded.institutionId,
    };
    req.token = token;

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please log in again.',
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Authentication error.',
    });
  }
};

module.exports = authenticate;
