import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiArrowLeft, FiCopy, FiDownload, FiEye, FiEyeOff, FiShare2 } from 'react-icons/fi';
import CredentialPreview from '../components/CredentialPreview';
import certificateService from '../services/certificateService';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';

const formatDate = (value) => value
  ? new Date(value).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
  : 'Not available';

export default function CertificateDetail() {
  const { certId } = useParams();
  const { user } = useAuth();
  const [certificate, setCertificate] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    setPdfUrl(null);
    Promise.allSettled([
      certificateService.getCertificate(certId),
      certificateService.getAuditTrail(certId),
    ]).then(([certResult, auditResult]) => {
      if (!mounted) return;
      if (certResult.status === 'fulfilled') setCertificate(certResult.value.certificate || null);
      else setError(certResult.reason?.response?.data?.message || 'Could not load this credential.');
      if (auditResult.status === 'fulfilled') {
        setAuditTrail(Array.isArray(auditResult.value) ? auditResult.value : auditResult.value.entries || auditResult.value.auditTrail || []);
      }
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [certId]);

  useEffect(() => {
    if (!pdfUrl) return undefined;
    return () => window.URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);

  const copyLink = async () => {
    if (!certificate?.verificationToken) return toast.error('A secure verification link is not available for this record.');
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/verify/${certificate.verificationToken}`);
      toast.success('Verification link copied.');
    } catch (_error) {
      toast.error('Could not copy the link. Select and copy it from the address bar.');
    }
  };

  const copyCertificateId = async () => {
    try {
      await navigator.clipboard.writeText(certificate.certificateId);
      toast.success('Record ID copied.');
    } catch (_error) {
      toast.error('Could not copy the record ID.');
    }
  };

  const downloadPdf = async () => {
    try {
      await certificateService.downloadCertificatePdf(certId);
      toast.success('Private certificate PDF downloaded.');
    } catch (downloadError) {
      toast.error(downloadError.response?.data?.message || 'Could not download the certificate PDF.');
    }
  };

  const togglePdfPreview = async () => {
    if (pdfUrl) {
      setPdfUrl(null);
      return;
    }
    setPdfLoading(true);
    try {
      const response = await certificateService.getCertificatePdfBlob(certId);
      setPdfUrl(window.URL.createObjectURL(response.data));
    } catch (previewError) {
      toast.error(previewError.response?.data?.message || 'Could not open the private certificate PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><LoadingSpinner text="Loading credential…" /></div>;

  if (error || !certificate) {
    return (
      <div className="not-found-shell">
        <div className="not-found-card">
          <p className="not-found-code">CREDORA / PRIVATE RECORD</p>
          <h2 className="mt-4 text-2xl font-semibold text-slate-100">Credential unavailable</h2>
          <p className="mt-2 text-sm text-slate-400">{error || 'This record could not be found or you do not have access to it.'}</p>
          <Link to="/verify" className="btn-primary mt-6">Go to verification</Link>
        </div>
      </div>
    );
  }

  const previewStatus = certificate.revocationStatus === 'pending'
    ? 'revocation_pending'
    : certificate.revocationStatus === 'failed'
      ? 'revocation_failed'
      : certificate.status === 'revoked'
        ? 'revoked'
        : certificate.blockchainStatus === 'confirmed' && certificate.status === 'active'
          ? certificate.validUntil && new Date(certificate.validUntil).getTime() < Date.now() ? 'expired' : 'valid'
          : 'pending';
  const backPath = user?.role === 'student'
    ? '/student/certificates'
    : user?.role === 'university'
      ? '/university/certificates'
      : user?.role === 'admin'
        ? '/admin/certificates'
        : '/verify';
  const backLabel = user?.role === 'student' ? 'Back to my credentials'
    : user?.role === 'university' ? 'Back to issued credentials'
      : user?.role === 'admin' ? 'Back to certificates'
        : 'Back to verification';

  return (
    <div className="certificate-page">
      <div className="max-w-6xl mx-auto space-y-6">
        <Link to={backPath} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-100">
          <FiArrowLeft className="w-4 h-4" aria-hidden="true" /> {backLabel}
        </Link>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow text-slate-400">CREDORA / PRIVATE CREDENTIAL</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-100">Credential record</h1>
            </div>
            <span className={`badge-${['revoked', 'revocation_failed'].includes(previewStatus) ? 'revoked' : previewStatus === 'valid' ? 'active' : 'pending'}`}>
              {previewStatus === 'valid' ? 'Proof confirmed on-chain' : previewStatus === 'expired' ? 'Expired' : previewStatus === 'revocation_pending' ? 'Revocation pending' : previewStatus === 'revocation_failed' ? 'Revocation needs retry' : previewStatus === 'revoked' ? 'Revoked' : 'Awaiting confirmation'}
            </span>
          </div>

          <CredentialPreview
            certificate={certificate}
            status={previewStatus}
            shareUrl={certificate.verificationToken ? `${window.location.origin}/verify/${certificate.verificationToken}` : undefined}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <section className="card lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">Private document</h2>
                  <p className="mt-1 text-xs text-slate-500">Only you and the issuing institution can open the original PDF.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={togglePdfPreview} disabled={pdfLoading} className="btn-secondary min-h-9 px-3 py-2 text-xs">
                    {pdfLoading ? <LoadingSpinner text="Opening…" /> : pdfUrl ? <><FiEyeOff aria-hidden="true" /> Close preview</> : <><FiEye aria-hidden="true" /> Preview PDF</>}
                  </button>
                  <button type="button" onClick={downloadPdf} className="btn-primary min-h-9 px-3 py-2 text-xs">
                    <FiDownload aria-hidden="true" /> Download PDF
                  </button>
                </div>
              </div>
              {pdfUrl ? (
                <div className="private-pdf-preview">
                  <div className="private-pdf-toolbar"><span>{certificate.certificateId}.pdf</span><span>Private preview</span></div>
                  <iframe title={`Private certificate PDF for ${certificate.studentName}`} src={pdfUrl} className="private-pdf-frame" />
                </div>
              ) : (
                <div className="issue-guidance">The public verification page shows the credential summary. This protected preview opens the actual certificate document.</div>
              )}
            </section>

            <aside className="card space-y-4">
              <div>
                <p className="mono-label text-slate-500">RECORD DETAILS</p>
                <dl className="record-details mt-3 space-y-3 text-sm">
                  <div><dt className="record-detail-label text-xs">Student email</dt><dd className="mt-0.5 break-all text-white">{certificate.studentEmail || 'Not recorded'}</dd></div>
                  <div><dt className="record-detail-label text-xs">Student ID</dt><dd className="mt-0.5 text-white">{certificate.studentId || 'Not recorded'}</dd></div>
                  <div><dt className="record-detail-label text-xs">Issue date</dt><dd className="mt-0.5 text-white">{formatDate(certificate.issueDate)}</dd></div>
                  {certificate.validUntil && <div><dt className="record-detail-label text-xs">Valid until</dt><dd className="mt-0.5 text-white">{formatDate(certificate.validUntil)}</dd></div>}
                  {certificate.criteria && <div><dt className="record-detail-label text-xs">Achievement criteria</dt><dd className="mt-0.5 text-white">{certificate.criteria}</dd></div>}
                </dl>
              </div>
              <div className="border-t border-slate-700 pt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="record-detail-label text-xs">Blockchain proof</span>
                  <span className={certificate.blockchainStatus === 'confirmed' ? 'badge-active' : 'badge-pending'}>{certificate.blockchainStatus === 'confirmed' ? 'proof confirmed' : certificate.blockchainStatus || 'pending'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="record-detail-label text-xs">Encrypted backup</span>
                  <span className="text-xs capitalize text-white">{certificate.documentStorageStatus || 'local'}</span>
                </div>
                {certificate.txHash && (
                  <div>
                    <p className="record-detail-label text-xs">Issuance transaction</p>
                    <code className="mt-1 block break-all text-[0.65rem] text-white">{certificate.txHash}</code>
                    {certificate.transactionUrl && <a href={certificate.transactionUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-xs font-medium text-cyan-300 hover:text-cyan-100">View on blockchain explorer ↗</a>}
                  </div>
                )}
                {certificate.revocationTxHash && (
                  <div>
                    <p className="record-detail-label text-xs">Revocation transaction</p>
                    <code className="mt-1 block break-all text-[0.65rem] text-white">{certificate.revocationTxHash}</code>
                    {certificate.revocationTransactionUrl && <a href={certificate.revocationTransactionUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-xs font-medium text-cyan-300 hover:text-cyan-100">View on blockchain explorer ↗</a>}
                  </div>
                )}
              </div>
              <div className="border-t border-slate-700 pt-4 space-y-2">
                <button type="button" onClick={copyLink} disabled={!certificate.verificationToken} className="btn-secondary w-full text-xs"><FiShare2 aria-hidden="true" /> Copy verification link</button>
                <button type="button" onClick={copyCertificateId} className="btn-secondary w-full text-xs"><FiCopy aria-hidden="true" /> Copy record ID</button>
              </div>
            </aside>
          </div>

          {certificate.status === 'revoked' && (
            <section className="status-callout revoked">
              <h2 className="font-semibold text-rose-200">This credential has been revoked</h2>
              <p className="mt-1 text-sm text-slate-400">The revocation is recorded on-chain{certificate.revokedAt ? ` as of ${formatDate(certificate.revokedAt)}` : ''}.</p>
              {certificate.revokedReason && <p className="mt-2 text-sm text-slate-300">Institution record: {certificate.revokedReason}</p>}
            </section>
          )}

          {auditTrail.length > 0 && (
            <section className="card">
              <h2 className="text-base font-semibold text-slate-100">Credential history</h2>
              <ol className="mt-4 divide-y divide-slate-800">
                {auditTrail.map((entry, index) => (
                  <li key={`${entry.action}-${entry.timestamp}-${index}`} className="flex items-start justify-between gap-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-200">{entry.action === 'ISSUED' ? 'Proof recorded' : 'Revocation recorded'}</p>
                      <p className="mt-1 text-xs text-slate-500">{entry.action === 'ISSUED' ? 'The credential fingerprint was anchored on-chain.' : 'The credential was revoked on-chain.'}</p>
                    </div>
                    {entry.timestamp && <time className="shrink-0 text-xs text-slate-500">{new Date(entry.timestamp * 1000).toLocaleString()}</time>}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </motion.div>
      </div>
    </div>
  );
}
