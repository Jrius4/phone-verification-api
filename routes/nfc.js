const expressN = require('express');
const { driverAuth: dAuth3 } = require('../middleware/auth');
const nfcCtrl = require('../controllers/nfc');
const nfcRouter = expressN.Router();
nfcRouter.get('/tags', dAuth3, nfcCtrl.listTags);
nfcRouter.post('/tags/register', dAuth3, nfcCtrl.registerTag);
nfcRouter.delete('/tags/:id', dAuth3, nfcCtrl.removeTag);
module.exports = nfcRouter;