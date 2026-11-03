/**
 * Role-based authorization middleware factory.
 * Returns middleware that checks whether req.user.role is among the allowed roles.
 * @param  {...string} roles - Roles permitted to access the route.
 * @returns {Function} Express middleware function.
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(', ')}`,
      });
    }

    next();
  };
};

module.exports = authorize;
