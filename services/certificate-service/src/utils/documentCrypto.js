const crypto = require('crypto');

function getEncryptionKey() {
  const secret = process.env.CERTIFICATE_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret || secret === 'default_jwt_secret' || secret.startsWith('replace-with-')) {
    throw new Error('Set CERTIFICATE_ENCRYPTION_KEY (recommended) or a strong JWT_SECRET before issuing certificates.');
  }
  if (secret.length < 32) {
    throw new Error('Certificate encryption secret must contain at least 32 characters.');
  }
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

function encryptDocument(plainBuffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()]);
  return {
    encryptedDocument: encrypted,
    documentIv: iv.toString('hex'),
    documentAuthTag: cipher.getAuthTag().toString('hex'),
  };
}

function decryptDocument({ encryptedDocument, documentIv, documentAuthTag }) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(documentIv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(documentAuthTag, 'hex'));
  return Buffer.concat([decipher.update(encryptedDocument), decipher.final()]);
}

module.exports = { encryptDocument, decryptDocument };
