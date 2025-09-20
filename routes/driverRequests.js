const expressD = require('express');
const { driverAuth: dAuth } = require('../middleware/auth');
const dr = require('../controllers/driverRequests');
const driverReqRouter = expressD.Router();

driverReqRouter.use(dAuth);
driverReqRouter.get('/open', dr.openRequests);
driverReqRouter.post('/:id/quote', dr.submitQuote);
driverReqRouter.get('/:id/quotes/my', dr.getMyQuote);
driverReqRouter.get('/quotes', dr.listMyQuotes);
driverReqRouter.patch('/quotes/:id/withdraw', dr.withdrawQuote);
driverReqRouter.post('/quotes/:id/confirm', dr.confirmAcceptedQuote);
module.exports = driverReqRouter;