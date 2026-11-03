const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  certificateId: { type: String, required: true, unique: true, index: true },
  verificationToken: { type: String, select: false },
  verificationTokenHash: { type: String, select: false, index: true },
  studentName: { type: String, required: true },
  studentEmail: { type: String },
  studentId: { type: String },
  certificateTitle: { type: String, default: 'Certificate of Achievement' },
  courseName: { type: String, required: true },
  grade: { type: String },
  teacherName: { type: String },
  teacherTitle: { type: String },
  sponsors: { type: [String], default: [] },
  criteria: { type: String, default: '' },
  validUntil: { type: Date },
  institutionLogo: { type: String, select: false },
  institutionLogoHash: { type: String, select: false },
  proofVersion: { type: Number, default: 1 },
  issueDate: { type: Date, default: Date.now },
  institutionName: { type: String, required: true },
  institutionId: { type: mongoose.Schema.Types.ObjectId },
  issuedBy: { type: String, required: true },
  // Only an encrypted copy is pinned. The private app copy is used for secure downloads.
  encryptedDocument: { type: Buffer, select: false },
  documentIv: { type: String, select: false },
  documentAuthTag: { type: String, select: false },
  commitmentSalt: { type: String, select: false },
  documentHash: { type: String },
  credentialHash: { type: String, index: true },
  ipfsHash: { type: String, select: false },
  ipfsUrl: { type: String, select: false },
  documentStorageStatus: { type: String, enum: ['local', 'pending', 'pinned', 'failed'], default: 'local' },
  txHash: { type: String },
  revocationTxHash: { type: String },
  blockchainStatus: { type: String, enum: ['pending', 'confirmed', 'failed'], default: 'pending' },
  qrCode: { type: String, select: false },
  status: { type: String, enum: ['active', 'revoked', 'pending'], default: 'pending' },
  revocationStatus: { type: String, enum: ['none', 'pending', 'failed', 'confirmed'], default: 'none' },
  revokedAt: { type: Date },
  revokedReason: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, {
  timestamps: true,
  toJSON: {
    transform(_document, value) {
      delete value.encryptedDocument;
      delete value.documentIv;
      delete value.documentAuthTag;
      delete value.commitmentSalt;
      delete value.verificationToken;
      delete value.verificationTokenHash;
      delete value.qrCode;
      delete value.__v;
      return value;
    },
  },
});

certificateSchema.index({ studentName: 1 });
certificateSchema.index({ institutionName: 1 });
certificateSchema.index({ status: 1 });
certificateSchema.index({ studentEmail: 1, createdAt: -1 });
certificateSchema.index({ institutionId: 1, createdAt: -1 });
certificateSchema.index({ institutionId: 1, revocationStatus: 1, createdAt: -1 });
certificateSchema.index({ status: 1, validUntil: 1 });

module.exports = mongoose.model('Certificate', certificateSchema);
