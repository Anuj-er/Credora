const router = require('express').Router();
const multer = require('multer');
const ctrl = require('../controllers/ipfsController');
const requireInternalService = require('../../../../shared/internalServiceAuth');

router.use(requireInternalService);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post('/upload', upload.single('file'), ctrl.upload);
router.post('/upload-json', ctrl.uploadJSON);
router.get('/:hash', ctrl.getFile);
router.delete('/:hash', ctrl.unpin);

module.exports = router;
