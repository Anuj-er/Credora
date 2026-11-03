const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roleCheck');
const {
  register,
  login,
  getProfile,
  updateProfile,
  logout,
  getAllUsers,
  updateUserRole,
  registerValidation,
  loginValidation,
} = require('../controllers/authController');
const institutionController = require('../controllers/institutionController');

// Public routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);

// Protected routes
router.post('/logout', authenticate, logout);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);

// Admin-only routes
router.get('/users', authenticate, authorize('admin'), getAllUsers);
router.put('/users/:id/role', authenticate, authorize('admin'), updateUserRole);
router.post('/institutions', authenticate, authorize('admin'), institutionController.register);
router.get('/institutions', authenticate, authorize('admin'), institutionController.list);
router.put('/institutions/:id/approve', authenticate, authorize('admin'), institutionController.approve);

module.exports = router;
