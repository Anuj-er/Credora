const axios = require('axios');
const FormData = require('form-data');

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_KEY = process.env.PINATA_SECRET_API_KEY || process.env.PINATA_SECRET_KEY;
const PINATA_BASE_URL = 'https://api.pinata.cloud';
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud/ipfs/';
const getGatewayUrl = (ipfsHash) => `${PINATA_GATEWAY.replace(/\/+$/, '')}/${ipfsHash}`;

const isMockMode = !PINATA_API_KEY || PINATA_API_KEY.includes('your-pinata') || !PINATA_SECRET_KEY || PINATA_SECRET_KEY.includes('your-pinata');
const crypto = require('crypto');

const redis = global.redisClient;

/**
 * Upload a file buffer to Pinata/IPFS
 */
async function uploadFile(fileBuffer, fileName) {
  try {
    if (isMockMode) {
      console.warn('⚠️ Pinata API keys not provided/default. Using simulated IPFS hash for local testing.');
      const mockHash = 'Qm' + crypto.createHash('sha256').update(fileBuffer).digest('hex').substring(0, 44);
      const ipfsUrl = getGatewayUrl(mockHash);
      if (redis) {
        await redis.setex(`ipfs_url_${mockHash}`, 3600, ipfsUrl);
      }
      return { ipfsHash: mockHash, ipfsUrl, mocked: true };
    }

    const formData = new FormData();
    const contentType = fileName.toLowerCase().endsWith('.pdf')
      ? 'application/pdf'
      : 'application/octet-stream';
    formData.append('file', fileBuffer, { filename: fileName, contentType });

    const metadata = JSON.stringify({ name: fileName });
    formData.append('pinataMetadata', metadata);

    const response = await axios.post(
      `${PINATA_BASE_URL}/pinning/pinFileToIPFS`,
      formData,
      {
        maxBodyLength: Infinity,
        headers: {
          ...formData.getHeaders(),
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_KEY,
        },
      }
    );

    const ipfsHash = response.data.IpfsHash;
    const ipfsUrl = getGatewayUrl(ipfsHash);

    // Cache hash → URL mapping for 1 hour
    if (redis) {
      await redis.setex(`ipfs_url_${ipfsHash}`, 3600, ipfsUrl);
    }

    return { ipfsHash, ipfsUrl };
  } catch (error) {
    console.error('❌ uploadFile error:', error.response?.data || error.message);
    throw new Error(`Failed to upload file to IPFS: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Upload JSON data to Pinata/IPFS
 */
async function uploadJSON(jsonData, name) {
  try {
    if (isMockMode) {
      console.warn('⚠️ Pinata API keys not provided/default. Using simulated IPFS hash for local testing.');
      const mockHash = 'Qm' + crypto.createHash('sha256').update(JSON.stringify(jsonData)).digest('hex').substring(0, 44);
      const ipfsUrl = getGatewayUrl(mockHash);
      if (redis) {
        await redis.setex(`ipfs_url_${mockHash}`, 3600, ipfsUrl);
      }
      return { ipfsHash: mockHash, ipfsUrl, mocked: true };
    }

    const body = {
      pinataContent: jsonData,
      pinataMetadata: { name: name || 'credora-json-data' },
    };

    const response = await axios.post(
      `${PINATA_BASE_URL}/pinning/pinJSONToIPFS`,
      body,
      {
        headers: {
          'Content-Type': 'application/json',
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_KEY,
        },
      }
    );

    const ipfsHash = response.data.IpfsHash;
    const ipfsUrl = getGatewayUrl(ipfsHash);

    // Cache hash → URL mapping for 1 hour
    if (redis) {
      await redis.setex(`ipfs_url_${ipfsHash}`, 3600, ipfsUrl);
    }

    return { ipfsHash, ipfsUrl };
  } catch (error) {
    console.error('❌ uploadJSON error:', error.response?.data || error.message);
    throw new Error(`Failed to upload JSON to IPFS: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Get file URL by IPFS hash (with Redis cache)
 */
async function getFile(ipfsHash) {
  try {
    // Check Redis cache first
    if (redis) {
      const cached = await redis.get(`ipfs_url_${ipfsHash}`);
      if (cached) {
        return { ipfsHash, ipfsUrl: cached, fromCache: true };
      }
    }

    const ipfsUrl = getGatewayUrl(ipfsHash);

    // Cache the URL
    if (redis) {
      await redis.setex(`ipfs_url_${ipfsHash}`, 3600, ipfsUrl);
    }

    return { ipfsHash, ipfsUrl };
  } catch (error) {
    console.error('❌ getFile error:', error.message);
    throw new Error(`Failed to get IPFS file: ${error.message}`);
  }
}

/**
 * Unpin a file from Pinata/IPFS
 */
async function unpinFile(ipfsHash) {
  try {
    await axios.delete(`${PINATA_BASE_URL}/pinning/unpin/${ipfsHash}`, {
      headers: {
        pinata_api_key: PINATA_API_KEY,
        pinata_secret_api_key: PINATA_SECRET_KEY,
      },
    });

    // Remove from Redis cache
    if (redis) {
      await redis.del(`ipfs_url_${ipfsHash}`);
    }

    return { ipfsHash, unpinned: true };
  } catch (error) {
    console.error('❌ unpinFile error:', error.response?.data || error.message);
    throw new Error(`Failed to unpin file from IPFS: ${error.response?.data?.message || error.message}`);
  }
}

module.exports = {
  uploadFile,
  uploadJSON,
  getFile,
  unpinFile,
};
