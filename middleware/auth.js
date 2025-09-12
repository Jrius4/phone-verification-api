const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Farmer = require('../models/Farmer');
const Buyer = require('../models/Buyer');
// Rate limiting for auth endpoints
// Fixing the route issue by making it a function
const rateLimit = require('express-rate-limit');



// Verify driver token (for driver-specific endpoints)
const driverAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
   
    if (!decoded.sub) {
      return res.status(401).json({
        success: false,
        message: 'Invalid driver token.'
      });
    }

    // Check if driver exists and is active
    const driver = await Driver.findById(decoded.sub);

    if (!driver) {
      return res.status(401).json({
        success: false,
        message: 'Driver not found or inactive.'
      });
    }

    req.user = driver;
    req.user.sub = driver._id;
    next();
  } catch (error) {
    console.error('Driver auth middleware error:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Driver token expired.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error in driver authentication.'
    });
  }
};

// Role-based authorization
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions.'
      });
    }

    next();
  };
};

// Admin only middleware
const requireAdmin = requireRole(['admin']);

// Admin or moderator middleware
const requireAdminOrModerator = requireRole(['admin', 'moderator']);
const requireDriver = requireRole(['admin', 'moderator', 'driver']);
const requireFarmer = requireRole(['admin', 'moderator', 'farmer']);
const requireBuyer = requireRole(['admin', 'moderator', 'buyer']);
const requireDriverOrFarmer = requireRole(['admin', 'moderator', 'driver', 'farmer']);
const requireDriverOrBuyer = requireRole(['admin', 'moderator', 'driver', 'buyer']);
const requireFarmerOrBuyer = requireRole(['admin', 'moderator', 'farmer', 'buyer']);
const requireAnyRole = requireRole(['admin', 'moderator', 'driver', 'farmer', 'buyer']);

// Optional auth - doesn't fail if no token, but adds user if present
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      if (user && user.isActive) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};



// Rate limiting function for auth endpoints
const authRateLimit = (windowMinutes = 15, maxAttempts = 5) => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000, // Convert minutes to milliseconds
    max: maxAttempts,
    message: {
      success: false,
      message: `Too many authentication attempts. Please try again in ${windowMinutes} minutes.`
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: `Too many authentication attempts. Please try again in ${windowMinutes} minutes.`,
        retryAfter: Math.ceil(windowMinutes * 60) // Retry after in seconds
      });
    },
    skip: (req) => {
      // Skip rate limiting for successful requests after failed attempts
      return req.rateLimit.remaining === 0 && req.rateLimit.current === maxAttempts;
    }
  });
};

// More aggressive rate limiting for failed attempts
const failedAuthRateLimit = () => {
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 failed attempts per hour
    message: {
      success: false,
      message: 'Too many failed authentication attempts. Account may be locked.'
    },
    skipSuccessfulRequests: true, // Only count failed attempts
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: 'Too many failed attempts. Account temporarily locked.',
        retryAfter: 3600 // Retry after 1 hour in seconds
      });
    }
  });
};

// IP-based rate limiting for general auth endpoints
const ipAuthRateLimit = () => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per IP per window
    message: {
      success: false,
      message: 'Too many requests from this IP. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
  });
};

// Specific rate limit for login endpoints
const loginRateLimit = authRateLimit(15, 5); // 5 attempts per 15 minutes

// Specific rate limit for registration endpoints
const registerRateLimit = authRateLimit(60, 3); // 3 registrations per hour

// Specific rate limit for password reset endpoints
const passwordResetRateLimit = authRateLimit(30, 3); // 3 attempts per 30 minutes

// Verify JWT token middleware
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
   
    if (!decoded.sub) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload.'
      });
    }

    let userRole = null;
    switch (decoded.role) {
      case 'driver':
        if (decoded.sub) {
          userRole = await Driver.findById(decoded.sub);
          if (!userRole) {
            return res.status(401).json({
              success: false,
              message: 'Driver not found.'
            });
          }
        } else {
          return res.status(401).json({
            success: false,
            message: 'Invalid driver token payload.'
          });
        }
        break;

      case 'farmer':
        if (decoded.sub) {
          userRole = await Farmer.findById(decoded.sub);
          if (!userRole) {
            return res.status(401).json({
              success: false,
              message: 'Driver not found.'
            });
          }
        } else {
          return res.status(401).json({
            success: false,
            message: 'Invalid driver token payload.'
          });
        }
        break;

      case 'buyer':
        if (decoded.sub) {
          userRole = await Buyer.findById(decoded.sub);
          if (!userRole) {
            return res.status(401).json({
              success: false,
              message: 'Driver not found.'
            });
          }
        } else {
          return res.status(401).json({
            success: false,
            message: 'Invalid driver token payload.'
          });
        }
        break;

      case 'user':
        userRole = await User.findById(decoded.sub).select('-password');
        if (!userRole) {
          return res.status(401).json({
            success: false,
            message: 'User not found.'
          });
        }
        break;
      default:
        return res.status(401).json({
          success: false,
          message: 'Invalid token subject.'
        });
    }

    const user = userRole;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is no longer valid.'
      });
    }

    if (!user.role) {
      user.role = decoded.role; // Ensure role is set
    } else {
      user.group = decoded.role;
    }
    user.sub = userRole._id; // Attach user ID from token

    req.user = user;
    req.phoneNumber = user.phoneNumber;
    req.role = user.role || decoded.role; // Attach role from token if not in user object
   
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error in authentication.'
    });
  }
};





module.exports = {
  auth,
  driverAuth,
  requireRole,
  requireAdmin,
  requireAdminOrModerator,
  requireDriver,
  requireFarmer,
  requireBuyer,
  requireDriverOrFarmer,
  requireDriverOrBuyer,
  requireFarmerOrBuyer,
  requireAnyRole,
  optionalAuth,
  authRateLimit,
  failedAuthRateLimit,
  ipAuthRateLimit,
  loginRateLimit,
  registerRateLimit,
  passwordResetRateLimit
};