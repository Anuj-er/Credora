const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roleCheck');
const {
  issueCertificate,
  previewCertificatePdf,
  getCertificate,
  getCertificatePdf,
  verifyCertificate,
  getStudentCertificates,
  getInstitutionCertificates,
  getAdminCertificates,
  revokeCertificate,
  getAuditTrail,
  getCertificateStats,
} = require('../controllers/certificateController');

// Public route — no authentication required
router.get('/verify/:certId', verifyCertificate);

// Protected routes
router.post('/preview', authenticate, authorize('university', 'admin'), previewCertificatePdf);
router.post('/issue', authenticate, authorize('university', 'admin'), issueCertificate);
router.get('/stats', authenticate, authorize('admin', 'university', 'student'), getCertificateStats);
router.get('/student/:email', authenticate, authorize('student', 'admin'), getStudentCertificates);
router.get('/institution/:id', authenticate, authorize('university', 'admin'), getInstitutionCertificates);
router.get('/all', authenticate, authorize('admin'), getAdminCertificates);
router.get('/audit/:certId', authenticate, getAuditTrail);
router.get('/:certId/pdf', authenticate, authorize('student', 'university', 'admin'), getCertificatePdf);
router.get('/:certId', authenticate, authorize('student', 'university', 'admin'), getCertificate);
router.put('/revoke/:certId', authenticate, authorize('university', 'admin'), revokeCertificate);

module.exports = router;
