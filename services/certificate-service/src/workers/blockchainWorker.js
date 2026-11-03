const { Worker } = require('bullmq');
const axios = require('axios');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const getInternalServiceToken = require('../../../../shared/getInternalServiceToken');

const BLOCKCHAIN_SERVICE_URL = process.env.BLOCKCHAIN_SERVICE_URL || 'http://localhost:3003';
const INTERNAL_SERVICE_TOKEN = getInternalServiceToken();
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT, 10) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const redisConnection = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
};
const redis = new Redis(redisConnection);

const invalidateCertificateCache = async (certificateId) => {
  const Certificate = mongoose.model('Certificate');
  const certificate = await Certificate.findOne({ certificateId }).select('+verificationTokenHash');
  const cacheKeys = [
    `cert_${certificateId}`,
    `verify_${certificateId}`,
    `verify_v2_${certificateId}`,
    `onchain_verify_${certificateId}`,
    `onchain_verify_v2_${certificateId}`
  ];
  if (certificate?.verificationTokenHash) {
    cacheKeys.push(`verify_v3_${certificate.verificationTokenHash}`);
    cacheKeys.push(`verify_v4_${certificate.verificationTokenHash}`);
    cacheKeys.push(`verify_v5_${certificate.verificationTokenHash}`);
    cacheKeys.push(`verify_v6_${certificate.verificationTokenHash}`);
  }
  return redis.del(...cacheKeys);
};

/**
 * BullMQ worker that listens to the 'blockchain-register' queue.
 * Calls the blockchain service to register or revoke certificates on-chain,
 * then updates the certificate record with the transaction hash and status.
 */
const startBlockchainWorker = () => {
  const worker = new Worker(
    'blockchain-register',
    async (job) => {
      const Certificate = mongoose.model('Certificate');

      // Handle revocation jobs
      if (job.name === 'revoke-certificate') {
        const { certificateId } = job.data;
        console.log(`[Blockchain Worker] Revoking certificate: ${certificateId}`);

        try {
          const response = await axios.post(
            `${BLOCKCHAIN_SERVICE_URL}/api/blockchain/revoke/${certificateId}`,
            {},
            {
              timeout: 60000,
              headers: { 'x-internal-service-token': INTERNAL_SERVICE_TOKEN },
            }
          );

          if (response.data.data?.warning) {
            await Certificate.findOneAndUpdate(
              { certificateId },
              { $set: { revocationStatus: 'failed' } }
            );
          await invalidateCertificateCache(certificateId);
            console.warn(`[Blockchain Worker] Revocation not sent for ${certificateId}: contract is not configured`);
            return { warning: response.data.data.warning };
          }

          const txHash = response.data.data?.txHash;

          await Certificate.findOneAndUpdate(
            { certificateId },
            {
              ...(txHash ? { revocationTxHash: txHash } : {}),
              revocationStatus: 'confirmed',
              status: 'revoked',
              revokedAt: response.data.data?.revokedAt
                ? new Date(Number(response.data.data.revokedAt) * 1000)
                : new Date(),
            }
          );
          await invalidateCertificateCache(certificateId);

          console.log(`[Blockchain Worker] Revocation confirmed for ${certificateId}`);
          return { txHash };
        } catch (error) {
          console.error(`[Blockchain Worker] Revocation failed for ${certificateId}:`, error.message);
          await Certificate.findOneAndUpdate(
            { certificateId },
            { revocationStatus: 'failed' }
          );
          await invalidateCertificateCache(certificateId);
          throw error;
        }
      }

      // Handle registration jobs
      const { certificateId } = job.data;
      console.log(`[Blockchain Worker] Registering certificate: ${certificateId}`);

      try {
        const certificate = await Certificate.findOne({ certificateId }).select('+credentialHash');
        if (!certificate?.credentialHash) throw new Error('Certificate commitment is missing.');

        const response = await axios.post(
          `${BLOCKCHAIN_SERVICE_URL}/api/blockchain/register`,
          {
            certificateId,
            credentialHash: certificate.credentialHash,
          },
          {
            timeout: 300000, // Slow Sepolia confirmation must not time out and trigger a retry that hits the already-registered path with no transaction hash
            headers: { 'x-internal-service-token': INTERNAL_SERVICE_TOKEN },
          }
        );

        if (response.data.data?.warning) {
          await Certificate.findOneAndUpdate(
            { certificateId },
            {
              $set: { blockchainStatus: 'failed', status: 'pending' },
            }
          );
          await invalidateCertificateCache(certificateId);
          console.warn(`[Blockchain Worker] Registration not sent for ${certificateId}: contract is not configured`);
          return { warning: response.data.data.warning };
        }

        const txHash = response.data.data?.txHash;
        const alreadyRevoked = Boolean(response.data.data?.isRevoked);

        await Certificate.findOneAndUpdate(
          { certificateId },
          {
            ...(txHash ? { txHash } : {}),
            blockchainStatus: 'confirmed',
            status: alreadyRevoked ? 'revoked' : 'active',
            ...(alreadyRevoked ? {
              revocationStatus: 'confirmed',
              revokedAt: response.data.data?.revokedAt
                ? new Date(Number(response.data.data.revokedAt) * 1000)
                : new Date(),
            } : {}),
          }
        );
        await invalidateCertificateCache(certificateId);

        console.log(`[Blockchain Worker] Registration confirmed for ${certificateId}: ${txHash}`);
        return { txHash };
      } catch (error) {
        console.error(`[Blockchain Worker] Registration failed for ${certificateId}:`, error.message);
        await Certificate.findOneAndUpdate(
          { certificateId },
          { blockchainStatus: 'failed', status: 'pending' }
        );
        await invalidateCertificateCache(certificateId);
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 3,
    }
  );

  worker.on('completed', (job, result) => {
    console.log(`[Blockchain Worker] Job ${job.id} completed:`, result?.txHash);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Blockchain Worker] Job ${job.id} failed:`, err.message);
  });

  console.log('✅ Blockchain Worker started');
  return worker;
};

module.exports = { startBlockchainWorker };
