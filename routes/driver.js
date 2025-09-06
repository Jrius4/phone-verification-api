const express = require('express');
const Joi = require('joi');
const {
  registerDriver,
  getDrivers,
  getDriver,
  updateDriver,
  deleteDriver,
  approveDriver,
  getDriverStats,
  me,
  saveDeliverRequest,
  getDeliveryRequests,
  getAllDeliveryRequests
} = require('../controllers/driverController');
const {
  validateRequest,
  driverRegistrationSchema,
  driverUpdateSchema,requestSchema
} = require('../middleware/validation');
const { auth,requireAdmin,requireAdminOrModerator, requireDriver } = require('./../middleware/auth'); // You'll need to create this

const router = express.Router();

// Public routes
router.post('/register', validateRequest(driverRegistrationSchema), registerDriver);
router.get('/stats', getDriverStats);

// requests
router.post("/requests",auth,validateRequest(requestSchema), saveDeliverRequest);
router.get("/requests",auth,requireAdminOrModerator, getAllDeliveryRequests);
router.get("/requests/:id/quoutes",auth, getDeliveryRequests);

// Protected routes - admin/moderator only
router.get('/',auth,requireAdminOrModerator, getDrivers);
router.get('/me',auth,requireDriver, me);
router.get('/:id',auth,requireAdminOrModerator, getDriver);
router.put('/:id',auth,requireAdminOrModerator, validateRequest(driverUpdateSchema), updateDriver);
router.delete('/:id',auth,requireAdmin, deleteDriver);
router.patch('/:id/approve',auth,requireAdmin, approveDriver);

module.exports = router;