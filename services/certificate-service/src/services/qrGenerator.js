const QRCode = require('qrcode');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

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
