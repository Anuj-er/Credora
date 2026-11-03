const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

// Provider setup
const NETWORK_URL = process.env.HARDHAT_NETWORK_URL || 'http://localhost:8545';
const provider = new ethers.JsonRpcProvider(NETWORK_URL);

// Hardhat's well-known account zero is used only for a loopback development RPC.
// It is never selected for Sepolia or any other remote network.
const localRpc = (() => {
  try {
    const rpcUrl = new URL(NETWORK_URL);
    return ['localhost', '127.0.0.1', '::1'].includes(rpcUrl.hostname);
  } catch (_error) {
    return false;
  }
})();
const LOCAL_HARDHAT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const PRIVATE_KEY = localRpc ? LOCAL_HARDHAT_PRIVATE_KEY : process.env.DEPLOYER_PRIVATE_KEY;
const signer = PRIVATE_KEY
  ? new ethers.Wallet(PRIVATE_KEY, provider)
  : null;

// Contract setup
let contract = null;
let contractABI = null;

try {
  const artifactPath = path.resolve(
    __dirname,
    '../../../../blockchain/artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json'
  );
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  contractABI = artifact.abi;

  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  if (CONTRACT_ADDRESS && contractABI) {
    contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer || provider);
    console.log('✅ Smart contract loaded at:', CONTRACT_ADDRESS);
  } else {
    console.warn('⚠️  CONTRACT_ADDRESS not set. Running in mock mode.');
  }
} catch (err) {
  console.warn('⚠️  Contract artifact not found. Running in mock mode.', err.message);
}

const redis = global.redisClient;

/**
 * Register a certificate on the blockchain
 */
async function registerCertificate(certId, credentialHash) {
  try {
    if (!contract) {
      console.warn('⚠️  Contract not loaded — returning mock response');
      return {
        warning: 'Running in mock mode — contract not deployed',
        txHash: null,
        blockNumber: null,
        certId,
      };
    }

    const existing = await contract.certificates(certId);
    if (existing.credentialHash !== ethers.ZeroHash) {
      if (existing.credentialHash.toLowerCase() !== String(credentialHash).toLowerCase()) {
        throw new Error('This certificate ID is already anchored to a different credential proof.');
      }
      return {
        txHash: null,
        blockNumber: null,
        certId,
        alreadyRegistered: true,
        isRevoked: existing.isRevoked,
        revokedAt: existing.revokedAt ? Number(existing.revokedAt) : null,
      };
    }

    const tx = await contract.issueCertificate(certId, credentialHash);
    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      certId,
    };
  } catch (error) {
    console.error('❌ registerCertificate error:', error.message);
    throw new Error(`Failed to register certificate on blockchain: ${error.message}`);
  }
}

/**
 * Verify a certificate on the blockchain (with Redis caching)
 */
async function verifyCertificateOnChain(certId) {
  try {
    const cacheKey = `onchain_verify_v2_${certId}`;

    // Check Redis cache first
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return { ...JSON.parse(cached), fromCache: true };
      }
    }

    if (!contract) {
      console.warn('⚠️  Contract not loaded — returning mock response');
      return {
        warning: 'Running in mock mode — contract not deployed',
        certId,
        isValid: false,
        credentialHash: null,
        issuer: null,
        issuedAt: null,
        isRevoked: false,
        revokedAt: null,
      };
    }

    const certData = await contract.verifyCertificate(certId);

    const result = {
      certId,
      isValid: true,
      credentialHash: certData.credentialHash,
      issuer: certData.issuer,
      issuedAt: certData.issuedAt ? Number(certData.issuedAt) : null,
      isRevoked: certData.isRevoked || false,
      revokedAt: certData.revokedAt ? Number(certData.revokedAt) : null,
    };

    // Cache for 600 seconds
    if (redis) {
      await redis.setex(cacheKey, 600, JSON.stringify(result));
    }

    return result;
  } catch (error) {
    console.error('❌ verifyCertificateOnChain error:', error.message);
    throw new Error(`Failed to verify certificate on blockchain: ${error.message}`);
  }
}

/**
 * Revoke a certificate on the blockchain
 */
async function revokeCertificateOnChain(certId) {
  try {
    if (!contract) {
      console.warn('⚠️  Contract not loaded — returning mock response');
      return {
        warning: 'Running in mock mode — contract not deployed',
        certId,
        revoked: false,
        txHash: null,
        blockNumber: null,
      };
    }

    const existing = await contract.certificates(certId);
    if (existing.credentialHash === ethers.ZeroHash) {
      throw new Error('Certificate does not exist on the blockchain.');
    }
    if (existing.isRevoked) {
      if (redis) {
        await redis.del(`onchain_verify_${certId}`, `onchain_verify_v2_${certId}`);
      }
      return {
        certId,
        revoked: true,
        alreadyRevoked: true,
        txHash: null,
        blockNumber: null,
        revokedAt: Number(existing.revokedAt),
      };
    }

    const tx = await contract.revokeCertificate(certId);
    const receipt = await tx.wait();

    // Invalidate cache
    if (redis) {
      await redis.del(`onchain_verify_${certId}`, `onchain_verify_v2_${certId}`);
    }

    return {
      certId,
      revoked: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    console.error('❌ revokeCertificateOnChain error:', error.message);
    throw new Error(`Failed to revoke certificate on blockchain: ${error.message}`);
  }
}

/**
 * Get audit trail for a certificate
 */
async function getAuditTrail(certId) {
  try {
    if (!contract) {
      console.warn('⚠️  Contract not loaded — returning mock response');
      return {
        warning: 'Running in mock mode — contract not deployed',
        certId,
        entries: [],
      };
    }

    const trail = await contract.getAuditTrail(certId);

    const entries = trail.map((entry) => ({
      action: entry.action,
      timestamp: Number(entry.timestamp),
      performer: entry.performedBy,
    }));

    return { certId, entries };
  } catch (error) {
    console.error('❌ getAuditTrail error:', error.message);
    throw new Error(`Failed to get audit trail: ${error.message}`);
  }
}

/**
 * Authorize an issuer address
 */
async function authorizeIssuer(address) {
  try {
    if (!contract) {
      console.warn('⚠️  Contract not loaded — returning mock response');
      return {
        warning: 'Running in mock mode — contract not deployed',
        address,
        authorized: false,
        txHash: null,
        blockNumber: null,
      };
    }

    const tx = await contract.authorizeIssuer(address);
    const receipt = await tx.wait();

    // Invalidate cache
    if (redis) {
      await redis.del(`issuer_auth_${address}`);
    }

    return {
      address,
      authorized: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error) {
    console.error('❌ authorizeIssuer error:', error.message);
    throw new Error(`Failed to authorize issuer: ${error.message}`);
  }
}

/**
 * Check if an address is an authorized issuer (with Redis caching)
 */
async function isAuthorizedIssuer(address) {
  try {
    const cacheKey = `issuer_auth_${address}`;

    // Check Redis cache first
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return { ...JSON.parse(cached), fromCache: true };
      }
    }

    if (!contract) {
      console.warn('⚠️  Contract not loaded — returning mock response');
      return {
        warning: 'Running in mock mode — contract not deployed',
        address,
        isAuthorized: false,
      };
    }

    const isAuth = await contract.isAuthorizedIssuer(address);

    const result = { address, isAuthorized: isAuth };

    // Cache for 600 seconds
    if (redis) {
      await redis.setex(cacheKey, 600, JSON.stringify(result));
    }

    return result;
  } catch (error) {
    console.error('❌ isAuthorizedIssuer error:', error.message);
    throw new Error(`Failed to check issuer authorization: ${error.message}`);
  }
}

module.exports = {
  registerCertificate,
  verifyCertificateOnChain,
  revokeCertificateOnChain,
  getAuditTrail,
  authorizeIssuer,
  isAuthorizedIssuer,
};
