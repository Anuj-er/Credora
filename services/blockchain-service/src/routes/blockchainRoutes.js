const router = require('express').Router();
const ctrl = require('../controllers/blockchainController');
const requireInternalService = require('../../../../shared/internalServiceAuth');

router.post('/register', requireInternalService, ctrl.register);
router.get('/verify/:certId', ctrl.verify);
router.post('/revoke/:certId', requireInternalService, ctrl.revoke);
router.get('/audit/:certId', ctrl.audit);
router.post('/authorize-issuer', requireInternalService, ctrl.authorize);
router.get('/is-authorized/:address', ctrl.checkAuthorized);

module.exports = router;
