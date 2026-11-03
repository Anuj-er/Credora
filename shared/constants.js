// Service Ports
const PORTS = {
  GATEWAY: 3000,
  AUTH: 3001,
  CERTIFICATE: 3002,
  BLOCKCHAIN: 3003,
  IPFS: 3004,
};

// Cache TTLs (in seconds)
const CACHE_TTL = {
  CERT_CACHE_TTL: 300,        // 5 minutes
  SESSION_TTL: 86400,          // 24 hours
  VERIFICATION_CACHE_TTL: 600, // 10 minutes
};

// User Roles
const ROLES = {
  ADMIN: 'admin',
  UNIVERSITY: 'university',
  STUDENT: 'student',
  VERIFIER: 'verifier',
};

module.exports = {
  PORTS,
  CACHE_TTL,
  ROLES,
};
