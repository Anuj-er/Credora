import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiAlertTriangle, FiCheckCircle, FiCopy, FiSearch, FiShield, FiXCircle } from 'react-icons/fi';
import certificateService from '../services/certificateService';
import CredentialPreview from '../components/CredentialPreview';
import LoadingSpinner from '../components/LoadingSpinner';

const detailsForStatuses = new Set(['valid', 'active', 'expired', 'revoked', 'pending', 'revocation_pending', 'revocation_failed', 'tampered', 'unverified']);

const extractShareToken = (value) => {
  const input = String(value || '').trim();
  if (!input) return '';
  try {
    const url = /^https?:\/\//i.test(input) || input.startsWith('/')
      ? new URL(input, window.location.origin)
      : null;
    if (url) {
      const segments = url.pathname.split('/').filter(Boolean);
      const verifyIndex = segments.lastIndexOf('verify');
      return verifyIndex >= 0 ? segments[verifyIndex + 1] || '' : '';
    }
  } catch (_error) {
    return '';
  }
  return input;
};

export default function VerifyCertificate() {
  const { certId: routeToken } = useParams();
  const [shareLink, setShareLink] = useState(routeToken || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [searched, setSearched] = useState(false);
  const [inputError, setInputError] = useState('');

  useEffect(() => {
    if (!routeToken) return;
    setShareLink(routeToken);
    verify(routeToken);
    // The route token is the only trigger; verify is intentionally local to this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeToken]);

  const verify = async (value = shareLink) => {
    const token = extractShareToken(value);
    if (!token) {
      setInputError('Paste a valid verification link or token.');
      return;
    }
    setInputError('');
    setLoading(true);
    setSearched(true);
    setResult(null);
    try {
      const response = await certificateService.verifyCertificate(token);
      setResult(response || null);
    } catch (error) {
      if (error.response?.status === 404) {
        setResult(error.response.data?.data || { status: 'not_found' });
      } else if (error.response?.status === 503) {
        setResult(error.response.data?.data || {
          status: 'unverified',
          message: 'The blockchain could not be reached. Try again shortly.',
        });
      } else {
        setResult({ status: 'unverified', message: error.response?.data?.message || 'Verification could not be completed. Try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    verify();
  };

  const copyLink = async () => {
    const token = extractShareToken(shareLink);
    if (!token) return setInputError('There is no valid verification link to copy.');
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/verify/${token}`);
      toast.success('Verification link copied.');
    } catch (_error) {
      toast.error('Could not copy the link. Select and copy it from the address bar.');
    }
  };

  const isValid = result?.status === 'valid' || result?.status === 'active';
  const isExpired = result?.status === 'expired';
  const isRevoked = result?.status === 'revoked';
  const isRevocationFailed = result?.status === 'revocation_failed';
  const isMismatch = result?.status === 'tampered';
  const isUncertain = ['pending', 'revocation_pending', 'unverified'].includes(result?.status);
  const token = extractShareToken(shareLink);
  const verificationUrl = token ? `${window.location.origin}/verify/${token}` : '';

  return (
    <div className="verify-page">
      <div className="verify-result">
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="verify-intro">
          <p className="eyebrow text-indigo-600"><FiShield aria-hidden="true" /> CREDORA / PUBLIC VERIFICATION</p>
          <h1>Check a credential</h1>
          <p className="mt-3 max-w-xl text-slate-500">
            Open the certificate holder’s QR link to see the credential and check its current blockchain status.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="card verify-search mb-8"
        >
          <label htmlFor="credential-share-link" className="label">Verification link or token</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" aria-hidden="true" />
              <input
                id="credential-share-link"
                type="text"
                value={shareLink}
                onChange={(event) => { setShareLink(event.target.value); setInputError(''); }}
                placeholder="Paste the link from the certificate holder"
                className="input-field pl-12 text-base"
                autoComplete="off"
                aria-invalid={Boolean(inputError)}
                aria-describedby={inputError ? 'credential-link-error' : 'credential-link-help'}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary whitespace-nowrap">
              {loading ? 'Checking…' : 'Verify credential'}
            </button>
          </div>
          {inputError
            ? <p id="credential-link-error" className="mt-2 text-sm text-rose-400">{inputError}</p>
            : <p id="credential-link-help" className="mt-2 text-xs text-slate-500">A certificate ID alone cannot be used to look up a private record.</p>}
        </motion.form>

        {loading && (
          <div className="text-center py-12"><LoadingSpinner text="Comparing the credential with its blockchain proof…" /></div>
        )}

        {!loading && searched && result && (
          <motion.section
            key={`${result.certificateId || shareLink}-${result.status}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {result.status === 'not_found' ? (
              <div className="status-callout revoked">
                <div className="flex items-start gap-3">
                  <FiXCircle className="w-6 h-6 text-rose-400 shrink-0" aria-hidden="true" />
                  <div>
                    <h2 className="font-semibold text-slate-100">Credential link not found</h2>
                    <p className="mt-1 text-sm text-slate-400">Check the link or ask the issuing institution to provide a current verification link.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`status-callout ${isRevoked || isMismatch ? 'revoked' : isExpired ? 'expired' : isUncertain || isRevocationFailed ? 'pending' : ''}`}>
                <div className="flex items-start gap-3">
                  {isValid ? <FiCheckCircle className="w-6 h-6 text-emerald-400 shrink-0" aria-hidden="true" />
                    : isRevoked || isMismatch ? <FiXCircle className="w-6 h-6 text-rose-400 shrink-0" aria-hidden="true" />
                      : <FiAlertTriangle className="w-6 h-6 text-amber-400 shrink-0" aria-hidden="true" />}
                  <div>
                    <h2 className="font-semibold text-slate-100">
                      {isValid ? 'Proof confirmed on-chain' : isExpired ? 'Credential expired' : isRevoked ? 'Credential revoked' : isMismatch ? 'Credential proof does not match' : isRevocationFailed ? 'Revocation needs retry' : 'Verification is not complete'}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {result.message || (isValid
                        ? 'The displayed credential matches the proof recorded on the blockchain.'
                        : 'Do not rely on this credential as verified until the check completes.')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {detailsForStatuses.has(result.status) && result.studentName && (
              <>
                <CredentialPreview certificate={result} status={result.status} shareUrl={verificationUrl} />
                <div className="verify-proof-panel">
                  <div>
                    <p className="mono-label">PROOF CHECK</p>
                    <p className="mt-1 text-sm text-slate-200">
                      {isMismatch
                        ? 'The stored details do not match the blockchain fingerprint.'
                        : result.verifiedOnChain
                          ? 'Credential fingerprint checked against the blockchain record.'
                          : 'Credential proof has not been confirmed yet.'}
                    </p>
                    <p className="mt-2 max-w-2xl text-xs text-slate-400">This confirms the displayed record matches the fingerprint Credora anchored on-chain. It does not independently audit the institution’s source records.</p>
                  </div>
                  {result.txHash && (
                    <div className="verify-transaction">
                      <span className="mono-label">ISSUANCE TRANSACTION</span>
                      <code>{result.txHash}</code>
                      {result.transactionUrl && <a href={result.transactionUrl} target="_blank" rel="noopener noreferrer">View on blockchain explorer ↗</a>}
                    </div>
                  )}
                  {result.revocationTxHash && (
                    <div className="verify-transaction">
                      <span className="mono-label">REVOCATION TRANSACTION</span>
                      <code>{result.revocationTxHash}</code>
                      {result.revocationTransactionUrl && <a href={result.revocationTransactionUrl} target="_blank" rel="noopener noreferrer">View on blockchain explorer ↗</a>}
                    </div>
                  )}
                </div>
                <div className="verify-share-note">
                  <p>This share link reveals the details shown above to anyone who has it. The original PDF remains available only to the holder and issuing institution.</p>
                  <button type="button" onClick={copyLink} className="btn-secondary"><FiCopy aria-hidden="true" /> Copy verification link</button>
                </div>
              </>
            )}
          </motion.section>
        )}

        {!searched && !loading && (
          <div className="verify-empty">
            <FiSearch className="w-8 h-8 text-slate-500" aria-hidden="true" />
            <p>Paste the secure verification link provided by the certificate holder.</p>
          </div>
        )}
      </div>
    </div>
  );
}
