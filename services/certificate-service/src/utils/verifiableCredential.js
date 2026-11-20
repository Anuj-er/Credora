const { getTransactionUrl } = require('./transactionExplorer');

// NOTE: This Verifiable Credential is currently UNSIGNED — it carries no
// `proof` field. The credential data is the same data Credora already
// verifies against the on-chain salted commitment, but a standard verifier
// cannot yet check its authenticity without trusting Credora's API.
// The next step is signing it with an Ed25519 Data Integrity proof
// (e.g. Ed25519Signature2020) using a key held by the issuing institution,
// and publishing the institution's verification method via its did:web
// document. Until then, treat this document as a standards-shaped
// representation of a Credora credential, not as a self-verifying credential.

/**
 * Build a W3C Verifiable Credentials Data Model 2.0 JSON document for a
 * Credora certificate. No personal data beyond what the public verify page
 * already shows is added here; the verification token is used as the
 * credential id because the public verify URL is the credential's address.
 */
const buildVerifiableCredential = (certificate, { baseUrl }) => {
  const origin = String(baseUrl || 'http://localhost:5173').replace(/\/$/, '');
  const verificationUrl = `${origin}/verify/${certificate.verificationToken}`;
  const studentEmail = String(certificate.studentEmail || '').trim().toLowerCase();

  const credentialSubject = {
    id: studentEmail ? `mailto:${studentEmail}` : undefined,
    name: certificate.studentName,
    course: certificate.courseName,
  };
  if (certificate.studentId) credentialSubject.studentId = certificate.studentId;
  if (certificate.grade) credentialSubject.grade = certificate.grade;
  if (certificate.certificateTitle) credentialSubject.achievement = certificate.certificateTitle;
  if (certificate.criteria) credentialSubject.criteria = certificate.criteria;

  const credential = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://www.w3.org/ns/credentials/examples/v2',
    ],
    id: verificationUrl,
    type: ['VerifiableCredential', 'AcademicCredential'],
    issuer: {
      id: origin,
      name: certificate.institutionName,
    },
    issuanceDate: new Date(certificate.issueDate).toISOString(),
    credentialSubject,
    credentialStatus: {
      id: verificationUrl,
      type: 'CredentialStatus',
      status: certificate.status,
    },
    credora: {
      certificateId: certificate.certificateId,
      blockchainStatus: certificate.blockchainStatus || 'pending',
      txHash: certificate.txHash || null,
      transactionUrl: getTransactionUrl(certificate.txHash),
      proofVersion: certificate.proofVersion || 1,
    },
  };
  if (certificate.validUntil) {
    credential.expirationDate = new Date(certificate.validUntil).toISOString();
  }
  return credential;
};

module.exports = { buildVerifiableCredential };
