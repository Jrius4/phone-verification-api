const expressPay = require('express');
const { auth: authMw3 } = require('../middleware/auth');
const pay = require('../controllers/payments');
const paymentsRouter = expressPay.Router();
paymentsRouter.post('/jobs/:jobId/release-nfc', authMw3, pay.releaseTransportByNfc);
module.exports = paymentsRouter;