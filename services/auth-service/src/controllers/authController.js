const jwt = require('jsonwebtoken');
const { validationResult, body } = require('express-validator');
const User = require('../models/User');
const Institution = require('../models/Institution');
const Redis = require('ioredis');
const getJwtSecret = require('../../../../shared/getJwtSecret');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
});

const JWT_SECRET = getJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Generate a signed JWT for a given user.
 * @param {Object} user - The user document.
 * @returns {string} Signed JWT string.
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      institutionId: user.institutionId,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

/**
 * Validation rules for the register endpoint.
 */
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('role')
    .optional()
    .isIn(['university', 'student', 'verifier'])
    .withMessage('Invalid role'),
];

/**
 * Validation rules for the login endpoint.
 */
const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { name, email, password, role, institutionCode, walletAddress } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists.',
      });
    }

    let institutionId;
    if (role === 'university') {
      if (!institutionCode?.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Institution code is required for university accounts.',
        });
      }

      const institution = await Institution.findOne({
        code: institutionCode.trim().toUpperCase(),
        isApproved: true,
      });
      if (!institution) {
        return res.status(403).json({
          success: false,
          message: 'Institution code is invalid or not approved.',
        });
      }
      institutionId = institution._id;
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'verifier',
      institutionId,
      walletAddress,
    });

    const token = generateToken(user);

    // Cache user session in Redis (expires in 24 hours)
    await redis.setex(
      `session_${user._id}`,
      86400,
      JSON.stringify({ id: user._id, email: user.email, role: user.role })
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          walletAddress: user.walletAddress,
        },
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Login an existing user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated.',
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user);

    // Cache user session in Redis
    await redis.setex(
      `session_${user._id}`,
      86400,
      JSON.stringify({ id: user._id, email: user.email, role: user.role })
    );

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          institutionId: user.institutionId,
          walletAddress: user.walletAddress,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/profile
 * @access  Private
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('institutionId');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile.',
    });
  }
};

/**
 * @desc    Update current user profile (name, walletAddress)
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const { name, walletAddress } = req.body;
    const updateFields = {};

    if (name !== undefined) updateFields.name = name.trim();
    if (walletAddress !== undefined) updateFields.walletAddress = walletAddress;

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update.',
      });
    }

    const user = await User.findByIdAndUpdate(req.user.id, updateFields, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: { user },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile.',
    });
  }
};

/**
 * @desc    Logout user — blacklist the JWT in Redis
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res) => {
  try {
    const token = req.token;

    // Decode token to get expiry so blacklist entry auto-expires
    const decoded = jwt.decode(token);
    const ttl = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 86400;

    // Blacklist the token
    await redis.setex(`bl_${token}`, Math.max(ttl, 1), 'true');

    // Remove session cache
    await redis.del(`session_${req.user.id}`);

    res.json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed.',
    });
  }
};

/**
 * @desc    Get all users (admin only) with pagination
 * @route   GET /api/auth/users
 * @access  Private (admin)
 */
const getAllUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const search = String(req.query.q || '').trim().slice(0, 100);
    const pattern = search ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null;
    const filter = pattern ? { $or: [{ name: pattern }, { email: pattern }, { role: pattern }] } : {};

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .populate('institutionId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users.',
    });
  }
};

/**
 * @desc    Update a user's role (admin only)
 * @route   PUT /api/auth/users/:id/role
 * @access  Private (admin)
 */
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['admin', 'university', 'student', 'verifier'];

    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      });
    }

    // Prevent admin from changing their own role
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own role.',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Invalidate cached session
    await redis.del(`session_${user._id}`);

    res.json({
      success: true,
      message: `User role updated to '${role}'.`,
      data: { user },
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role.',
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  logout,
  getAllUsers,
  updateUserRole,
  registerValidation,
  loginValidation,
};
