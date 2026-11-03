const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { Queue } = require('bullmq');
const axios = require('axios');
const Redis = require('ioredis');
const mongoose = require('mongoose');
const Certificate = require('../models/Certificate');
const { generateQR } = require('../services/qrGenerator');
const { generateCertificatePDF } = require('../services/pdfGenerator');
const { sha256, createCredentialHash } = require('../utils/credentialProof');
const { encryptDocument, decryptDocument } = require('../utils/documentCrypto');
const { parseInstitutionLogo } = require('../utils/institutionLogo');
const { getTransactionUrl } = require('../utils/transactionExplorer');

const parseValidityDate = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T23:59:59.999Z`)
    : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildCredentialSearch = (value) => {
  const search = String(value || '').trim().slice(0, 100);
  if (!search) return {};
  const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escaped, 'i');
  return {
    $or: [
      { certificateId: pattern },
      { studentName: pattern },
      { courseName: pattern },
      { certificateTitle: pattern },
      { institutionName: pattern },
      { studentEmail: pattern },
    ],
  };
};

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
});

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

const ipfsQueue = new Queue('ipfs-upload', { connection: redisConnection });
const blockchainQueue = new Queue('blockchain-register', { connection: redisConnection });

const BLOCKCHAIN_SERVICE_URL = process.env.BLOCKCHAIN_SERVICE_URL || 'http://localhost:3003';

const canAccessCertificate = (certificate, user) => {
  if (user.role === 'admin') return true;
  if (user.role === 'university') {
    return String(certificate.institutionId) === String(user.institutionId);
  }
  if (user.role === 'student') {
    return String(certificate.studentEmail || '').toLowerCase() === String(user.email || '').toLowerCase();
  }
  return false;
};

const serializePrivateCertificate = (certificate) => ({
  ...certificate.toJSON(),
  verificationToken: certificate.verificationToken,
  institutionLogo: certificate.institutionLogo || null,
  transactionUrl: getTransactionUrl(certificate.txHash),
  revocationTransactionUrl: getTransactionUrl(certificate.revocationTxHash),
});

/**
 * @desc    Issue a new academic certificate
 * @route   POST /api/certificates/issue
 * @access  Private (university)
 */
const issueCertificate = async (req, res) => {
  try {
    const studentName = String(req.body.studentName || '').trim();
    const studentEmail = String(req.body.studentEmail || '').trim().toLowerCase();
    const studentId = String(req.body.studentId || '').trim();
    const certificateTitle = String(req.body.certificateTitle || 'Certificate of Achievement').trim();
    const courseName = String(req.body.courseName || '').trim();
    const grade = String(req.body.grade || '').trim();
    const teacherName = String(req.body.teacherName || '').trim();
    const teacherTitle = String(req.body.teacherTitle || '').trim();
    const criteria = String(req.body.criteria || '').trim();
    const validUntil = parseValidityDate(req.body.validUntil);
    const sponsors = Array.isArray(req.body.sponsors)
      ? req.body.sponsors.map((sponsor) => String(sponsor || '').trim()).filter(Boolean)
      : [];
    const institutionLogo = parseInstitutionLogo(req.body.institutionLogo);

    if (!studentName || !courseName) {
      return res.status(400).json({
        success: false,
        message: 'Student name and course name are required.',
      });
    }
    if (studentName.length > 120 || studentEmail.length > 254 || studentId.length > 80 || courseName.length > 160 || grade.length > 30 || certificateTitle.length > 80 || teacherName.length > 120 || teacherTitle.length > 80 || criteria.length > 300 || sponsors.length > 5 || sponsors.some((sponsor) => sponsor.length > 100)) {
      return res.status(400).json({ success: false, message: 'One or more certificate fields exceed the allowed length.' });
    }

    if (!studentEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail)) {
      return res.status(400).json({ success: false, message: 'Enter a valid student email address.' });
    }

    const institutionId = req.user.role === 'university'
      ? req.user.institutionId
      : req.body.institutionId;
    if (!institutionId || !mongoose.Types.ObjectId.isValid(String(institutionId))) {
      return res.status(400).json({ success: false, message: 'A valid institution is required.' });
    }
    const institution = await mongoose.connection.collection('institutions').findOne({
      _id: new mongoose.Types.ObjectId(String(institutionId)),
      isApproved: true,
    });
    if (!institution) {
      return res.status(403).json({ success: false, message: 'The issuing institution is not approved.' });
    }

    const issuedAt = req.body.issueDate ? new Date(req.body.issueDate) : new Date();
    if (Number.isNaN(issuedAt.getTime())) {
      return res.status(400).json({ success: false, message: 'Enter a valid issue date.' });
    }
    if (issuedAt > new Date()) {
      return res.status(400).json({ success: false, message: 'Issue date cannot be in the future.' });
    }
    if (req.body.validUntil && !validUntil) {
      return res.status(400).json({ success: false, message: 'Enter a valid expiration date.' });
    }
    if (validUntil && validUntil < issuedAt) {
      return res.status(400).json({ success: false, message: 'Expiration date cannot be before the issue date.' });
    }

    const certificateId = `CERT-${uuidv4()}`;
    const verificationToken = crypto.randomBytes(32).toString('base64url');
    const qrCode = await generateQR(verificationToken);
    const certData = {
      certificateId,
      verificationToken,
      verificationTokenHash: sha256(verificationToken),
      studentName,
      studentEmail,
      studentId,
      certificateTitle,
      courseName,
      grade,
      teacherName,
      teacherTitle,
      sponsors,
      criteria,
      validUntil,
      institutionLogo: institutionLogo.dataUrl,
      institutionLogoHash: institutionLogo.hash,
      proofVersion: 3,
      issueDate: issuedAt,
      institutionName: institution.name,
      institutionId: institution._id,
      issuedBy: req.user.id,
      qrCode,
      status: 'pending',
      blockchainStatus: 'pending',
    };

    const pdfBuffer = await generateCertificatePDF({ ...certData, institutionLogoBuffer: institutionLogo.buffer, qrCode });
    const documentHash = sha256(pdfBuffer);
    const commitmentSalt = crypto.randomBytes(32).toString('hex');
    const credentialHash = createCredentialHash({ ...certData, documentHash }, commitmentSalt, 3);
    const encrypted = encryptDocument(pdfBuffer);

    const certificate = await Certificate.create({
      ...certData,
      documentHash,
      credentialHash,
      commitmentSalt,
      ...encrypted,
      documentStorageStatus: 'pending',
    });

    // Store an encrypted backup on IPFS, and anchor the salted credential proof on-chain.
    await ipfsQueue.add('upload-encrypted-certificate', {
      certificateId: certificate.certificateId,
      encryptedPdfBase64: encrypted.encryptedDocument.toString('base64'),
      documentIv: encrypted.documentIv,
      documentAuthTag: encrypted.documentAuthTag,
      fileName: `${certificateId}.pdf.enc`,
    }, {
      jobId: `ipfs-${certificateId}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
    await blockchainQueue.add('register-certificate', {
      certificateId,
      credentialHash,
    }, {
      jobId: `issue-${certificateId}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });

    res.status(201).json({
      success: true,
      message: 'Certificate created. Blockchain verification is processing.',
      data: {
        certificate: { ...serializePrivateCertificate(certificate), institutionLogo: institutionLogo.dataUrl },
        verificationToken,
      },
    });
  } catch (error) {
    console.error('Issue certificate error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 400 ? error.message : 'Failed to issue certificate.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Render the exact certificate PDF for review without creating a database record
 * or queueing IPFS/blockchain work.
 * @route POST /api/certificates/preview
 */
const previewCertificatePdf = async (req, res) => {
  try {
    const institutionId = req.user.role === 'university' ? req.user.institutionId : req.body.institutionId;
    if (!institutionId || !mongoose.Types.ObjectId.isValid(String(institutionId))) {
      return res.status(400).json({ success: false, message: 'A valid institution is required.' });
    }
    const institution = await mongoose.connection.collection('institutions').findOne({
      _id: new mongoose.Types.ObjectId(String(institutionId)),
      isApproved: true,
    });
    if (!institution) return res.status(403).json({ success: false, message: 'The issuing institution is not approved.' });

    const certificateTitle = String(req.body.certificateTitle || 'Certificate of Achievement').trim();
    const studentName = String(req.body.studentName || 'Recipient name').trim();
    const courseName = String(req.body.courseName || 'Credential or qualification').trim();
    const grade = String(req.body.grade || '').trim();
    const teacherName = String(req.body.teacherName || '').trim();
    const teacherTitle = String(req.body.teacherTitle || '').trim();
    const criteria = String(req.body.criteria || '').trim();
    const sponsors = Array.isArray(req.body.sponsors)
      ? req.body.sponsors.map((sponsor) => String(sponsor || '').trim()).filter(Boolean)
      : [];
    const issueDate = req.body.issueDate ? new Date(req.body.issueDate) : new Date();
    const validUntil = parseValidityDate(req.body.validUntil);

    if (Number.isNaN(issueDate.getTime()) || issueDate > new Date()) {
      return res.status(400).json({ success: false, message: 'Enter a valid issue date that is not in the future.' });
    }
    if (req.body.validUntil && !validUntil) {
      return res.status(400).json({ success: false, message: 'Enter a valid expiration date.' });
    }
    if (validUntil && validUntil < issueDate) {
      return res.status(400).json({ success: false, message: 'Expiration date cannot be before the issue date.' });
    }
    if (certificateTitle.length > 80 || studentName.length > 120 || courseName.length > 160 || grade.length > 30 || teacherName.length > 120 || teacherTitle.length > 80 || criteria.length > 300 || sponsors.length > 5 || sponsors.some((sponsor) => sponsor.length > 100)) {
      return res.status(400).json({ success: false, message: 'One or more certificate fields exceed the allowed length.' });
    }

    const institutionLogo = parseInstitutionLogo(req.body.institutionLogo);
    const pdfBuffer = await generateCertificatePDF({
      certificateId: 'PREVIEW - assigned on issue',
      certificateTitle,
      studentName,
      courseName,
      grade,
      teacherName,
      teacherTitle,
      sponsors,
      criteria,
      issueDate,
      validUntil,
      institutionName: institution.name,
      institutionLogoBuffer: institutionLogo.buffer,
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="credential-draft-preview.pdf"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Preview certificate PDF error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode === 400 ? error.message : 'Could not render the draft certificate PDF.',
    });
  }
};

/**
 * @desc    Get a single certificate by its certificateId
 * @route   GET /api/certificates/:certId
 * @access  Private (authenticated)
 */
const getCertificate = async (req, res) => {
  try {
    const { certId } = req.params;
    const certificate = await Certificate.findOne({ certificateId: certId })
      .select('+verificationToken +institutionLogo');
    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found.',
      });
    }
    if (!canAccessCertificate(certificate, req.user)) {
      return res.status(403).json({ success: false, message: 'You cannot access this certificate.' });
    }

    res.json({
      success: true,
      data: { certificate: serializePrivateCertificate(certificate) },
    });
  } catch (error) {
    console.error('Get certificate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve certificate.',
    });
  }
};

const getCertificatePdf = async (req, res) => {
  try {
    const certificate = await Certificate.findOne({ certificateId: req.params.certId })
      .select('+encryptedDocument +documentIv +documentAuthTag');
    if (!certificate) return res.status(404).json({ success: false, message: 'Certificate not found.' });
    if (!canAccessCertificate(certificate, req.user)) {
      return res.status(403).json({ success: false, message: 'You cannot download this certificate.' });
    }
    if (!certificate.encryptedDocument || !certificate.documentIv || !certificate.documentAuthTag) {
      return res.status(404).json({ success: false, message: 'The private certificate file is unavailable.' });
    }

    const pdfBuffer = decryptDocument(certificate);
    if (pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-' || sha256(pdfBuffer) !== certificate.documentHash) {
      return res.status(500).json({ success: false, message: 'The certificate file failed its integrity check.' });
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${certificate.certificateId}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Download certificate PDF error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to retrieve the certificate PDF.' });
  }
};

/**
 * @desc    Publicly verify a certificate by its certificateId
 * @route   GET /api/certificates/verify/:shareToken
 * @access  Public
 */
const verifyCertificate = async (req, res) => {
  let publicCredentialDetails = null;
  try {
    const { certId: shareToken } = req.params;
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(shareToken)) {
      return res.status(404).json({ success: false, data: { status: 'not_found', message: 'Verification link is invalid.' } });
    }
    const tokenHash = sha256(shareToken);
    const cacheKey = `verify_v6_${tokenHash}`;

    // Check Redis cache first
    const cachedResult = await redis.get(cacheKey);
    if (cachedResult) {
      return res.json({
        success: true,
        data: JSON.parse(cachedResult),
        source: 'cache',
      });
    }

    const certificate = await Certificate.findOne({ verificationTokenHash: tokenHash }).select('+commitmentSalt +institutionLogo +institutionLogoHash');

    if (!certificate) {
      const notFoundResult = { status: 'not_found', message: 'Certificate not found.' };
      await redis.setex(cacheKey, 60, JSON.stringify(notFoundResult));
      return res.status(404).json({
        success: false,
        data: notFoundResult,
      });
    }

    publicCredentialDetails = {
      certificateId: certificate.certificateId,
      studentName: certificate.studentName,
      certificateTitle: certificate.certificateTitle || 'Certificate of Achievement',
      courseName: certificate.courseName,
      institutionName: certificate.institutionName,
      institutionLogo: certificate.institutionLogo || null,
      teacherName: certificate.teacherName || '',
      teacherTitle: certificate.teacherTitle || '',
      sponsors: certificate.sponsors || [],
      criteria: certificate.criteria || '',
      validUntil: certificate.validUntil || null,
      issueDate: certificate.issueDate,
      grade: certificate.grade,
      blockchainStatus: certificate.blockchainStatus || 'pending',
      txHash: certificate.txHash,
      transactionUrl: getTransactionUrl(certificate.txHash),
      revocationTxHash: certificate.revocationTxHash,
      revocationTransactionUrl: getTransactionUrl(certificate.revocationTxHash),
    };

    if (!certificate.commitmentSalt || !certificate.credentialHash || !certificate.documentHash) {
      return res.json({
        success: true,
        data: {
          status: 'unverified',
          ...publicCredentialDetails,
          verifiedOnChain: false,
          message: 'This record was issued before Credora added privacy-preserving blockchain proofs. Reissue it to enable verification.',
        },
      });
    }

    const chainResponse = await axios.get(
      `${BLOCKCHAIN_SERVICE_URL}/api/blockchain/verify/${encodeURIComponent(certificate.certificateId)}`,
      { timeout: 12000 }
    );
    const chainRecord = chainResponse.data?.data;
    if (!chainRecord || chainRecord.warning || !chainRecord.isValid) {
      const unavailable = {
        status: 'unverified',
        ...publicCredentialDetails,
        verifiedOnChain: false,
        message: 'Credora could not confirm this certificate on the blockchain.',
      };
      return res.status(503).json({ success: false, data: unavailable });
    }

    const expectedHash = createCredentialHash(certificate, certificate.commitmentSalt, certificate.proofVersion || 1);
    if (expectedHash.toLowerCase() !== String(chainRecord.credentialHash || '').toLowerCase()) {
      const tampered = {
        status: 'tampered',
        ...publicCredentialDetails,
        verifiedOnChain: false,
        message: 'The credential details do not match the proof recorded on the blockchain.',
        blockchainStatus: 'confirmed',
        txHash: certificate.txHash,
      };
      await redis.setex(cacheKey, 60, JSON.stringify(tampered));
      return res.json({ success: true, data: tampered });
    }

    let status = 'valid';
    let message = 'The credential proof matches the blockchain record.';
    if (chainRecord.isRevoked) {
      status = 'revoked';
      message = 'The institution has revoked this certificate on the blockchain.';
    } else if (certificate.revocationStatus === 'pending') {
      status = 'revocation_pending';
      message = 'The institution requested revocation. The credential remains active until the blockchain confirms the change.';
    } else if (certificate.revocationStatus === 'failed') {
      status = 'revocation_failed';
      message = 'The revocation attempt failed. The credential remains active on-chain until a new request confirms.';
    } else if (certificate.status !== 'active' || certificate.blockchainStatus !== 'confirmed') {
      status = 'pending';
      message = 'The certificate exists, but its issuance is not yet confirmed on the blockchain.';
    } else if (certificate.validUntil && new Date(certificate.validUntil).getTime() < Date.now()) {
      status = 'expired';
      message = 'The credential proof matches, but its validity period has ended.';
    }

    const verificationResult = {
      status,
      message,
      certificateId: certificate.certificateId,
      studentName: certificate.studentName,
      certificateTitle: certificate.certificateTitle || 'Certificate of Achievement',
      courseName: certificate.courseName,
      institutionName: certificate.institutionName,
      institutionLogo: certificate.institutionLogo || null,
      teacherName: certificate.teacherName || '',
      teacherTitle: certificate.teacherTitle || '',
      sponsors: certificate.sponsors || [],
      criteria: certificate.criteria || '',
      validUntil: certificate.validUntil || null,
      issueDate: certificate.issueDate,
      grade: certificate.grade,
      blockchainStatus: certificate.blockchainStatus || 'confirmed',
      blockchainIssuer: chainRecord.issuer,
      verifiedOnChain: true,
      txHash: certificate.txHash,
      transactionUrl: getTransactionUrl(certificate.txHash),
      revocationTxHash: certificate.revocationTxHash,
      revocationTransactionUrl: getTransactionUrl(certificate.revocationTxHash),
      revokedAt: chainRecord.isRevoked && chainRecord.revokedAt
        ? new Date(Number(chainRecord.revokedAt) * 1000)
        : certificate.revokedAt,
    };

    await redis.setex(cacheKey, 60, JSON.stringify(verificationResult));

    res.json({
      success: true,
      data: verificationResult,
    });
  } catch (error) {
    console.error('Verify certificate error:', error);
    res.status(503).json({
      success: false,
      message: 'The blockchain verification service is unavailable. Try again shortly.',
      data: {
        status: 'unverified',
        ...(publicCredentialDetails || {}),
        verifiedOnChain: false,
      },
    });
  }
};

/**
 * @desc    Get all certificates for a student by email
 * @route   GET /api/certificates/student/:email
 * @access  Private (student, admin)
 */
const getStudentCertificates = async (req, res) => {
  try {
    const email = String(req.params.email || '').trim().toLowerCase();
    if (req.user.role !== 'admin' && String(req.user.email || '').toLowerCase() !== String(email).toLowerCase()) {
      return res.status(403).json({ success: false, message: 'You can only view your own certificates.' });
    }
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const query = { studentEmail: email, ...buildCredentialSearch(req.query.q) };

    const [certificates, total] = await Promise.all([
      Certificate.find(query).select('+verificationToken +institutionLogo').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Certificate.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        certificates: certificates.map(serializePrivateCertificate),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Get student certificates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student certificates.',
    });
  }
};

/**
 * @desc    Get all certificates for an institution
 * @route   GET /api/certificates/institution/:id
 * @access  Private (university, admin)
 */
const getInstitutionCertificates = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid institution ID.' });
    }
    if (req.user.role === 'university' && String(req.user.institutionId) !== String(id)) {
      return res.status(403).json({ success: false, message: 'You can only view certificates issued by your institution.' });
    }
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const query = {
      institutionId: id,
      ...(req.query.view === 'revocations' ? { revocationStatus: { $in: ['pending', 'failed', 'confirmed'] } } : {}),
      ...buildCredentialSearch(req.query.q),
    };

    const [certificates, total] = await Promise.all([
      Certificate.find(query).select('+verificationToken +institutionLogo').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Certificate.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        certificates: certificates.map(serializePrivateCertificate),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Get institution certificates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve institution certificates.',
    });
  }
};

const getAdminCertificates = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;
    const query = buildCredentialSearch(req.query.q);
    const [certificates, total] = await Promise.all([
      Certificate.find(query)
        .select('certificateId studentName courseName institutionName grade issueDate validUntil status blockchainStatus revocationStatus createdAt')
        .sort({ createdAt: -1 }).skip(skip).limit(limit),
      Certificate.countDocuments(query),
    ]);

    return res.json({
      success: true,
      data: {
        certificates: certificates.map(serializePrivateCertificate),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('Get admin certificates error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve certificate records.' });
  }
};

/**
 * @desc    Revoke a certificate
 * @route   PUT /api/certificates/revoke/:certId
 * @access  Private (university, admin)
 */
const revokeCertificate = async (req, res) => {
  try {
    const { certId } = req.params;
    const reason = String(req.body.reason || '').trim();

    if (!reason || reason.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'A revocation reason between 1 and 500 characters is required.',
      });
    }

    const certificate = await Certificate.findOne({ certificateId: certId }).select('+verificationTokenHash');
    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found.',
      });
    }

    if (req.user.role === 'university' && String(certificate.institutionId) !== String(req.user.institutionId)) {
      return res.status(403).json({ success: false, message: 'You can only revoke certificates issued by your institution.' });
    }

    if (certificate.status === 'revoked') {
      return res.status(400).json({
        success: false,
        message: 'Certificate is already revoked.',
      });
    }
    if (certificate.status !== 'active' || certificate.blockchainStatus !== 'confirmed') {
      return res.status(409).json({ success: false, message: 'Only blockchain-confirmed active certificates can be revoked.' });
    }
    if (certificate.revocationStatus === 'pending') {
      return res.status(409).json({ success: false, message: 'A revocation request is already processing.' });
    }

    certificate.revocationStatus = 'pending';
    certificate.revokedReason = reason;
    await certificate.save();

    // Invalidate caches
    await redis.del(`cert_${certId}`);
    await redis.del(
      `verify_${certId}`,
      `verify_v2_${certId}`,
      ...(certificate.verificationTokenHash ? [
        `verify_v3_${certificate.verificationTokenHash}`,
        `verify_v4_${certificate.verificationTokenHash}`,
        `verify_v5_${certificate.verificationTokenHash}`,
        `verify_v6_${certificate.verificationTokenHash}`,
      ] : [])
    );

    // Queue blockchain revocation
    try {
      await blockchainQueue.add('revoke-certificate', {
        certificateId: certId,
      }, {
        jobId: `revoke-${certId}-${Date.now()}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      });
    } catch (queueError) {
      certificate.revocationStatus = 'failed';
      await certificate.save();
      throw queueError;
    }

    res.status(202).json({
      success: true,
      message: 'Revocation request submitted. The status will change after blockchain confirmation.',
      data: { certificate },
    });
  } catch (error) {
    console.error('Revoke certificate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to revoke certificate.',
    });
  }
};

/**
 * @desc    Get audit trail for a certificate from the blockchain service
 * @route   GET /api/certificates/audit/:certId
 * @access  Private (authenticated)
 */
const getAuditTrail = async (req, res) => {
  try {
    const { certId } = req.params;
    const certificate = await Certificate.findOne({ certificateId: certId });
    if (!certificate) return res.status(404).json({ success: false, message: 'Certificate not found.' });
    if (!canAccessCertificate(certificate, req.user)) {
      return res.status(403).json({ success: false, message: 'You cannot access this certificate audit trail.' });
    }

    const response = await axios.get(
      `${BLOCKCHAIN_SERVICE_URL}/api/blockchain/audit/${certId}`,
      { timeout: 10000 }
    );

    res.json({
      success: true,
      data: response.data.data || response.data,
    });
  } catch (error) {
    console.error('Get audit trail error:', error.message);

    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: error.response.data?.message || 'Failed to retrieve audit trail.',
      });
    }

    res.status(503).json({
      success: false,
      message: 'Blockchain service is unavailable.',
    });
  }
};

/**
 * @desc    Get certificate statistics for dashboard
 * @route   GET /api/certificates/stats
 * @access  Private (admin, university, student)
 */
const getCertificateStats = async (req, res) => {
  try {
    if (req.user.role === 'university' && !req.user.institutionId) {
      return res.status(403).json({ success: false, message: 'Your university account is not linked to an institution.' });
    }
    const scope = req.user.role === 'university'
      ? { institutionId: req.user.institutionId }
      : req.user.role === 'student'
        ? { studentEmail: String(req.user.email || '').toLowerCase() }
        : {};
    const now = new Date();
    const activeScope = {
      ...scope,
      status: 'active',
      $or: [{ validUntil: { $exists: false } }, { validUntil: null }, { validUntil: { $gte: now } }],
    };
    const [total, active, revoked, pending, expired, recentCertificates] = await Promise.all([
      Certificate.countDocuments(scope),
      Certificate.countDocuments(activeScope),
      Certificate.countDocuments({ ...scope, status: 'revoked' }),
      Certificate.countDocuments({ ...scope, status: 'pending' }),
      Certificate.countDocuments({
        ...scope,
        status: 'active',
        validUntil: { $lt: now },
        revocationStatus: { $nin: ['pending', 'failed'] },
      }),
      Certificate.find(scope)
        .select('certificateId studentName certificateTitle courseName grade issueDate validUntil institutionName institutionLogo teacherName teacherTitle sponsors criteria status blockchainStatus revocationStatus createdAt')
        .select('+institutionLogo')
        .sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    res.json({
      success: true,
      data: {
        stats: { total, active, revoked, pending, expired },
        recentCertificates,
      },
    });
  } catch (error) {
    console.error('Get certificate stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve certificate statistics.',
    });
  }
};

module.exports = {
  issueCertificate,
  previewCertificatePdf,
  getCertificate,
  getCertificatePdf,
  verifyCertificate,
  getStudentCertificates,
  getInstitutionCertificates,
  getAdminCertificates,
  revokeCertificate,
  getAuditTrail,
  getCertificateStats,
};
