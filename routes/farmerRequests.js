const express = require('express');
const { listJobs, jobDetails, getFilters } = require('../controllers/farmerRequestsController');
const {requireFarmer} = require('../middleware/auth');
const farmerRouter = express.Router();

farmerRouter.use(requireFarmer);

farmerRouter.get('/', listJobs);
farmerRouter.get('/filters', getFilters); // New endpoint for available filters
farmerRouter.get('/:id', jobDetails);

module.exports = farmerRouter;