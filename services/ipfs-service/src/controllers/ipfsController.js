const pinataService = require('../services/pinataService');

/**
 * POST /api/ipfs/upload
 * Upload a file to IPFS via Pinata
 */
exports.upload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided. Use multipart form-data with field name "file".',
      });
    }

    const data = await pinataService.uploadFile(req.file.buffer, req.file.originalname);

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ipfs/upload-json
 * Upload JSON data to IPFS via Pinata
 */
exports.uploadJSON = async (req, res, next) => {
  try {
    const { data: jsonData, name } = req.body;

    if (!jsonData) {
      return res.status(400).json({
        success: false,
        message: 'JSON data is required in request body as "data" field.',
      });
    }

    const data = await pinataService.uploadJSON(jsonData, name);

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/ipfs/:hash
 * Get file URL by IPFS hash
 */
exports.getFile = async (req, res, next) => {
  try {
    const { hash } = req.params;

    if (!hash) {
      return res.status(400).json({
        success: false,
        message: 'IPFS hash is required',
      });
    }

    const data = await pinataService.getFile(hash);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/ipfs/:hash
 * Unpin a file from IPFS
 */
exports.unpin = async (req, res, next) => {
  try {
    const { hash } = req.params;

    if (!hash) {
      return res.status(400).json({
        success: false,
        message: 'IPFS hash is required',
      });
    }

    const data = await pinataService.unpinFile(hash);

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
