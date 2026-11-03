import QRCode from 'react-qr-code';

const statusStyles = {
  draft: { label: 'Draft preview', className: 'is-draft' },
  valid: { label: 'Proof confirmed', className: 'is-verified' },
  active: { label: 'Proof confirmed', className: 'is-verified' },
  revoked: { label: 'Revoked on-chain', className: 'is-revoked' },
  pending: { label: 'Awaiting confirmation', className: 'is-pending' },
  expired: { label: 'Expired', className: 'is-expired' },
  revocation_pending: { label: 'Revocation pending', className: 'is-pending' },
  revocation_failed: { label: 'Revocation needs retry', className: 'is-pending' },
  unverified: { label: 'Not verified', className: 'is-unverified' },
  tampered: { label: 'Proof mismatch', className: 'is-revoked' },
};

const formatDate = (value) => {
  if (!value) return 'Date not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not available';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

export default function CredentialPreview({
  certificate = {},
  status = 'draft',
  shareUrl,
  className = '',
}) {
  const state = statusStyles[status] || statusStyles.unverified;

  return (
    <article className={`credential-preview ${state.className} ${className}`} aria-label="Academic credential preview">
      <header className="credential-preview-header">
        <div className="credential-preview-issuer">
          {certificate.institutionLogo && (
            <img className="credential-institution-logo" src={certificate.institutionLogo} alt={`${certificate.institutionName || 'University'} logo`} />
          )}
          <div className="credential-preview-brand">
            <span className="brand-mark" aria-hidden="true" />
            <span>CREDORA <small>VERIFIABLE RECORD</small></span>
          </div>
        </div>
        <span className="credential-state">{state.label}</span>
      </header>

      <div className="credential-preview-main">
        <p className="mono-label">ACADEMIC CREDENTIAL</p>
        <h2>{certificate.certificateTitle || 'Certificate of Achievement'}</h2>
        <p className="credential-award-label">This credential is awarded to</p>
        <h3>{certificate.studentName || 'Recipient name'}</h3>
        <p className="credential-qualification-label">for</p>
        <p className="credential-qualification">{certificate.courseName || 'Credential or qualification'}</p>
        <p className="credential-issued-by">issued by <strong>{certificate.institutionName || 'Issuing institution'}</strong></p>
      </div>

      <div className="credential-preview-footer">
        <div className="credential-preview-facts">
          <div>
            <span>ISSUE DATE</span>
            <strong>{formatDate(certificate.issueDate)}</strong>
          </div>
          <div>
            <span>RESULT</span>
            <strong>{certificate.grade || 'Not specified'}</strong>
          </div>
          {certificate.validUntil && (
            <div>
              <span>VALID UNTIL</span>
              <strong>{formatDate(certificate.validUntil)}</strong>
            </div>
          )}
          <div className="credential-id-fact">
            <span>RECORD ID</span>
            <strong>{certificate.certificateId || 'Assigned when issued'}</strong>
          </div>
        </div>
        {shareUrl && (
          <div className="credential-preview-qr">
            <div className="qr-canvas"><QRCode value={shareUrl} size={84} /></div>
            <span>SCAN TO VERIFY</span>
          </div>
        )}
      </div>

      {certificate.criteria && (
        <div className="credential-criteria">
          <span>ACHIEVEMENT CRITERIA</span>
          <p>{certificate.criteria}</p>
        </div>
      )}

      {(certificate.teacherName || (Array.isArray(certificate.sponsors) && certificate.sponsors.length > 0)) && (
        <div className="credential-credits">
          {certificate.teacherName && (
            <p><span>INSTRUCTOR</span><strong>{certificate.teacherName}{certificate.teacherTitle ? ` · ${certificate.teacherTitle}` : ''}</strong></p>
          )}
          {Array.isArray(certificate.sponsors) && certificate.sponsors.length > 0 && (
            <p><span>SPONSORED BY</span><strong>{certificate.sponsors.join(' · ')}</strong></p>
          )}
        </div>
      )}

      <div className="credential-preview-note">
        {status === 'draft'
          ? 'Preview only · a permanent proof is recorded after issuance.'
          : status === 'tampered'
            ? 'Values shown are from Credora’s stored record and are not trusted because the proof did not match.'
            : status === 'unverified'
              ? 'The credential details are shown, but the blockchain check could not confirm them.'
          : status === 'expired'
            ? 'The credential proof matches, but its validity period has ended.'
          : status === 'revocation_pending'
            ? 'A revocation request is processing. The on-chain status remains unchanged until it confirms.'
          : status === 'revocation_failed'
            ? 'The revocation attempt failed. The credential remains active on-chain until a new request confirms.'
          : 'Check the status above before relying on this credential.'}
      </div>
    </article>
  );
}
