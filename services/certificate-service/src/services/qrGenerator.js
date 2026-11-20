const QRCode = require('qrcode');

// No localhost fallback: a QR code pointing at localhost is useless in
// production and silently wrong. FRONTEND_URL must be set explicitly
// (the demo Compose sets it from PUBLIC_URL); local development sets it
// in .env to http://localhost:5173.
const FRONTEND_URL = (process.env.FRONTEND_URL || process.env.PUBLIC_URL || '').replace(/\/$/, '');
if (!FRONTEND_URL) {
  throw new Error(
    'FRONTEND_URL (or PUBLIC_URL) must be set to generate QR codes — refusing to fall back to localhost'
  );
}

/**
 * Generate a QR code as a base64 data URL containing the verification URL
 * for the given private share token.
 * @param {string} verificationToken - A random token that is not written on-chain.
 * @returns {Promise<string>} Base64-encoded data URL of the QR code image.
 */
const generateQR = async (verificationToken) => {
  const verificationUrl = `${FRONTEND_URL}/verify/${verificationToken}`;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    width: 300,
    margin: 2,
    color: {
      dark: '#1a1a2e',
      light: '#ffffff',
    },
  });
  return qrDataUrl;
};

module.exports = { generateQR };
