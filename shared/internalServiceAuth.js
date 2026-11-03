const crypto = require('crypto');
const getInternalServiceToken = require('./getInternalServiceToken');

module.exports = (req, res, next) => {
  let expected;
  try {
    expected = getInternalServiceToken();
  } catch (_error) {
    return res.status(503).json({ success: false, message: 'Internal service authentication is not configured.' });
  }
  const provided = req.get('x-internal-service-token') || '';
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  const valid = expectedBuffer.length === providedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  if (!valid) return res.status(401).json({ success: false, message: 'Internal service authentication required.' });
  return next();
};
