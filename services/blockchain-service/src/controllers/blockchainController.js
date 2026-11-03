const contractService = require('../services/contractService');

/**
 * POST /api/blockchain/register
 * Register a certificate on the blockchain
 */
exports.register = async (req, res, next) => {
  try {
    const { certificateId, credentialHash } = req.body;

    if (!certificateId || !/^0x[0-9a-fA-F]{64}$/.test(credentialHash || '')) {
      return res.status(400).json({
        success: false,
        message: 'A certificate ID and 32-byte credential hash are required.',
      });
    }

    const data = await contractService.registerCertificate(certificateId, credentialHash);

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/blockchain/verify/:certId
 * Verify a certificate on the blockchain
 */
exports.verify = async (req, res, next) => {
  try {
    const { certId } = req.params;

    if (!certId) {
      return res.status(400).json({
        success: false,
        message: 'Certificate ID is required',
      });
    }

    const data = await contractService.verifyCertificateOnChain(certId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/blockchain/revoke/:certId
 * Revoke a certificate on the blockchain
 */
exports.revoke = async (req, res, next) => {
  try {
    const { certId } = req.params;
    if (!certId) {
      return res.status(400).json({
        success: false,
        message: 'Certificate ID is required',
      });
    }

    const data = await contractService.revokeCertificateOnChain(certId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/blockchain/audit/:certId
 * Get audit trail for a certificate
 */
exports.audit = async (req, res, next) => {
  try {
    const { certId } = req.params;

    if (!certId) {
      return res.status(400).json({
        success: false,
        message: 'Certificate ID is required',
      });
    }

    const data = await contractService.getAuditTrail(certId);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/blockchain/authorize-issuer
 * Authorize an address as an issuer
 */
exports.authorize = async (req, res, next) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Ethereum address is required',
      });
    }

    const data = await contractService.authorizeIssuer(address);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/blockchain/is-authorized/:address
 * Check if an address is an authorized issuer
 */
exports.checkAuthorized = async (req, res, next) => {
  try {
    const { address } = req.params;

    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Ethereum address is required',
      });
    }

    const data = await contractService.isAuthorizedIssuer(address);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
