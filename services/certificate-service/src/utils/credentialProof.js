const crypto = require('crypto');

const sha256 = (value) => `0x${crypto.createHash('sha256').update(value).digest('hex')}`;

// Keep this legacy payload unchanged: existing credentials were anchored with it.
const normalizeCredential = (certificate) => ({
  certificateId: String(certificate.certificateId),
  studentName: String(certificate.studentName || '').trim(),
  studentEmail: String(certificate.studentEmail || '').trim().toLowerCase(),
  studentId: String(certificate.studentId || '').trim(),
  courseName: String(certificate.courseName || '').trim(),
  grade: String(certificate.grade || '').trim(),
  issueDate: new Date(certificate.issueDate).toISOString(),
  institutionName: String(certificate.institutionName || '').trim(),
  institutionId: String(certificate.institutionId || ''),
  issuedBy: String(certificate.issuedBy || ''),
  documentHash: String(certificate.documentHash || '').toLowerCase(),
});

const normalizeCredentialV2 = (certificate) => ({
  ...normalizeCredential(certificate),
  certificateTitle: String(certificate.certificateTitle || 'Certificate of Achievement').trim(),
  teacherName: String(certificate.teacherName || '').trim(),
  teacherTitle: String(certificate.teacherTitle || '').trim(),
  sponsors: Array.isArray(certificate.sponsors)
    ? certificate.sponsors.map((sponsor) => String(sponsor || '').trim()).filter(Boolean)
    : [],
  institutionLogoHash: String(certificate.institutionLogoHash || '').toLowerCase(),
});

const normalizeCredentialV3 = (certificate) => ({
  ...normalizeCredentialV2(certificate),
  criteria: String(certificate.criteria || '').trim(),
  validUntil: certificate.validUntil ? new Date(certificate.validUntil).toISOString() : '',
});

const createCredentialHash = (certificate, salt, proofVersion = certificate.proofVersion || 1) => {
  if (!salt) throw new Error('Credential proof salt is required.');
  const payload = Number(proofVersion) >= 3
    ? normalizeCredentialV3(certificate)
    : Number(proofVersion) === 2
      ? normalizeCredentialV2(certificate)
      : normalizeCredential(certificate);
  return sha256(JSON.stringify({ salt: String(salt), credential: payload }));
};

module.exports = { sha256, normalizeCredential, normalizeCredentialV2, normalizeCredentialV3, createCredentialHash };
