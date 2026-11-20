const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

// Provider setup.
// Primary RPC: HARDHAT_NETWORK_URL first (the demo Compose maps the Sepolia
// RPC into it), then SEPOLIA_RPC_URL. A separate fallback RPC is tried if
// the primary cannot be reached (see verifyNetwork below).
const PRIMARY_RPC_URL =
  process.env.HARDHAT_NETWORK_URL ||
  process.env.SEPOLIA_RPC_URL ||
  'http://localhost:8545';
const FALLBACK_RPC_URL =
  process.env.SEPOLIA_RPC_FALLBACK_URL || process.env.RPC_FALLBACK_URL || null;
let activeRpcUrl = PRIMARY_RPC_URL;
let provider = new ethers.JsonRpcProvider(PRIMARY_RPC_URL);

const isLocalRpcUrl = (rpcUrl) => {
  try {
    const parsed = new URL(rpcUrl);
    return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  } catch (_error) {
    return false;
  }
};

// Hardhat's well-known account zero is used only for a loopback development RPC.
// It is never selected for Sepolia or any other remote network.
const LOCAL_HARDHAT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const PRIVATE_KEY = isLocalRpcUrl(activeRpcUrl)
  ? LOCAL_HARDHAT_PRIVATE_KEY
  : process.env.DEPLOYER_PRIVATE_KEY;
let signer = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : null;

// Contract setup
let contract = null;
let contractABI = null;

const loadContract = (activeProvider) => {
  try {
    const artifactPath = path.resolve(
      __dirname,
      '../../../../blockchain/artifacts/contracts/CertificateRegistry.sol/CertificateRegistry.json'
    );
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    contractABI = artifact.abi;

    const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
    if (CONTRACT_ADDRESS && contractABI) {
      contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        contractABI,
        signer || activeProvider
      );
      console.log('✅ Smart contract loaded at:', CONTRACT_ADDRESS);
    } else {
      console.warn('⚠️  CONTRACT_ADDRESS not set. Running in mock mode.');
    }
  } catch (err) {
    console.warn('⚠️  Contract artifact not found. Running in mock mode.', err.message);
  }
};

loadContract(provider);

/**
 * Check the RPC is reachable and on the expected chain, switching to the
 * fallback RPC once if the primary fails. Call at service startup.
 * Expected chain: EXPECTED_CHAIN_ID when set; otherwise 11155111 (Sepolia)
 * when the primary URL names Sepolia, and no check for a local chain.
 * Throws when no RPC answers or the chain ID does not match, so the
 * service fails fast instead of silently issuing against the wrong chain.
 * @returns {Promise<{rpcUrl: string, chainId: number, fallbackUsed: boolean}>}
 */
const verifyNetwork = async () => {
  const expectedChainId = process.env.EXPECTED_CHAIN_ID
    ? Number(process.env.EXPECTED_CHAIN_ID)
    : PRIMARY_RPC_URL.toLowerCase().includes('sepolia')
      ? 11155111
      : null;
  const candidates = [
    { url: PRIMARY_RPC_URL, fallbackUsed: false },
    ...(FALLBACK_RPC_URL && FALLBACK_RPC_URL !== PRIMARY_RPC_URL
      ? [{ url: FALLBACK_RPC_URL, fallbackUsed: true }]
      : []),
  ];
  let lastError = null;
  for (const candidate of candidates) {
    try {
      const candidateProvider = new ethers.JsonRpcProvider(candidate.url);
      const network = await candidateProvider.getNetwork();
      const chainId = Number(network.chainId);
      if (expectedChainId !== null && chainId !== expectedChainId) {
        throw new Error(
          `Chain ID mismatch on ${candidate.url}: expected ${expectedChainId}, got ${chainId}`
        );
      }
      if (candidate.fallbackUsed || candidate.url !== activeRpcUrl) {
        activeRpcUrl = candidate.url;
        provider = candidateProvider;
        signer = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY, provider) : null;
        loadContract(provider);
        console.log(`⚠️  Using fallback RPC: ${candidate.url}`);
      }
      console.log(`✅ Blockchain RPC reachable: ${candidate.url} (chainId ${chainId})`);
      return { rpcUrl: candidate.url, chainId, fallbackUsed: candidate.fallbackUsed };
    } catch (error) {
      lastError = error;
      console.error(`❌ Blockchain RPC check failed for ${candidate.url}:`, error.message);
    }
  }
  throw new Error(`No blockchain RPC reachable: ${lastError ? lastError.message : 'unknown error'}`);
};

const getNetworkInfo = () => ({ rpcUrl: activeRpcUrl, fallbackRpcUrl: FALLBACK_RPC_URL });

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
      // Recover the original transaction hash from the CertificateIssued
      // event, so a duplicate / timeout retry does not lose the tx.
      let txHash = null;
      let blockNumber = null;
      try {
        const events = await contract.queryFilter(
          contract.filters.CertificateIssued(certId)
        );
        const first = events && events[0];
        if (first) {
          txHash = first.transactionHash || null;
          blockNumber = first.blockNumber != null ? Number(first.blockNumber) : null;
        }
      } catch (eventError) {
        console.warn('⚠️  Could not recover original tx from events:', eventError.message);
      }
      return {
        txHash,
        blockNumber,
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
  verifyNetwork,
  getNetworkInfo,
};
