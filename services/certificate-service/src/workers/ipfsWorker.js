const { Worker } = require('bullmq');
const axios = require('axios');
const mongoose = require('mongoose');
const FormData = require('form-data');
const getInternalServiceToken = require('../../../../shared/getInternalServiceToken');

const IPFS_SERVICE_URL = process.env.IPFS_SERVICE_URL || 'http://localhost:3004';
const INTERNAL_SERVICE_TOKEN = getInternalServiceToken();
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT, 10) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const redisConnection = { host: REDIS_HOST, port: REDIS_PORT, password: REDIS_PASSWORD };

/**
 * BullMQ worker that listens to the 'ipfs-upload' queue.
 * Takes an encrypted certificate PDF, uploads the ciphertext to IPFS,
 * and records the CID without exposing a readable public PDF.
 */
const startIPFSWorker = () => {
  const worker = new Worker(
    'ipfs-upload',
    async (job) => {
      const { certificateId, encryptedPdfBase64, documentIv, documentAuthTag, fileName } = job.data;
      console.log(`[IPFS Worker] Processing upload for certificate: ${certificateId}`);

      try {
        // Lazy-load Certificate model to avoid circular dependency issues
        const Certificate = mongoose.model('Certificate');

        const ciphertext = Buffer.from(encryptedPdfBase64, 'base64');
        if (ciphertext.length < 16 || !documentIv || !documentAuthTag) {
          throw new Error('Encrypted certificate file is empty or incomplete.');
        }
        // Keep the IV and authentication tag beside the ciphertext so the encrypted
        // backup remains recoverable without publishing any student information.
        const encryptedBuffer = Buffer.from(JSON.stringify({
          version: 1,
          algorithm: 'aes-256-gcm',
          iv: documentIv,
          authTag: documentAuthTag,
          ciphertext: encryptedPdfBase64,
        }));
        const formData = new FormData();
        formData.append('file', encryptedBuffer, {
          filename: fileName,
          contentType: 'application/octet-stream',
        });

        const response = await axios.post(
          `${IPFS_SERVICE_URL}/api/ipfs/upload`,
          formData,
          {
            headers: {
              ...formData.getHeaders(),
              'x-internal-service-token': INTERNAL_SERVICE_TOKEN,
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 30000,
          }
        );

        const { ipfsHash, ipfsUrl, mocked } = response.data.data;

        const certificate = await Certificate.findOneAndUpdate(
          { certificateId },
          mocked
            ? { documentStorageStatus: 'local' }
            : { ipfsHash, ipfsUrl, documentStorageStatus: 'pinned' },
          { new: true }
        );

        console.log(`[IPFS Worker] Encrypted document storage complete for ${certificateId}`);
        return { ipfsHash: mocked ? undefined : ipfsHash, mocked: Boolean(mocked) };
      } catch (error) {
        console.error(`[IPFS Worker] Failed for ${certificateId}:`, error.message);
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`[IPFS Worker] Job ${job.id} completed:`, result.ipfsHash);
  });

  worker.on('failed', (job, err) => {
    console.error(`[IPFS Worker] Job ${job.id} failed:`, err.message);
    if (job && job.attemptsMade >= (job.opts.attempts || 1)) {
      const Certificate = mongoose.model('Certificate');
      Certificate.findOneAndUpdate(
        { certificateId: job.data.certificateId, documentStorageStatus: 'pending' },
        { documentStorageStatus: 'failed' }
      ).catch((updateError) => console.error('[IPFS Worker] Could not persist failure status:', updateError.message));
    }
  });

  console.log('✅ IPFS Worker started');
  return worker;
};

module.exports = { startIPFSWorker };
