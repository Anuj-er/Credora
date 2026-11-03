const getJwtSecret = require('./getJwtSecret');

module.exports = () => {
  const configured = process.env.INTERNAL_SERVICE_TOKEN;
  if (configured && !configured.startsWith('replace-with-')) {
    if (configured.length < 32) {
      throw new Error('INTERNAL_SERVICE_TOKEN must contain at least 32 characters.');
    }
    return configured;
  }
  return getJwtSecret();
};
