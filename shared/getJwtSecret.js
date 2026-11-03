module.exports = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || secret === 'default_jwt_secret' || secret.startsWith('replace-with-')) {
    throw new Error('JWT_SECRET must be set to a private value of at least 32 characters.');
  }
  return secret;
};
