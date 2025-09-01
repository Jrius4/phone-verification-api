const express = require('express');
const {
  registerDriver,
  getDrivers,
  getDriver,
  updateDriver,
  deleteDriver,
  approveDriver,
  getDriverStats
} = require('../controllers/driverController');
const {
  validateRequest,
  driverRegistrationSchema,
  driverUpdateSchema
} = require('../middleware/validation');
const { auth,requireAdmin,requireAdminOrModerator } = require('./../middleware/auth'); // You'll need to create this

const router = express.Router();

// Public routes
router.post('/register', validateRequest(driverRegistrationSchema), registerDriver);
router.get('/stats', getDriverStats);

// Protected routes - admin/moderator only
router.get('/',auth,requireAdminOrModerator, getDrivers);
router.get('/:id',auth,requireAdminOrModerator, getDriver);
router.put('/:id',auth,requireAdminOrModerator, validateRequest(driverUpdateSchema), updateDriver);
router.delete('/:id',auth,requireAdmin, deleteDriver);
router.patch('/:id/approve',auth,requireAdmin, approveDriver);

module.exports = router;