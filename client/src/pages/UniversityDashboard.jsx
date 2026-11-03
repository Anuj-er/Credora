import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  FiFileText, FiCheckCircle, FiXCircle, FiClock,
  FiPlusCircle, FiEye, FiSlash, FiRefreshCw, FiUploadCloud, FiSearch, FiX,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import certificateService from '../services/certificateService';
import CredentialPreview from '../components/CredentialPreview';
import DashboardLayout from '../components/DashboardLayout';
import StatsCard from '../components/StatsCard';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import PaginationControls from '../components/PaginationControls';

const routeViews = {
  '/university': 'Overview',
  '/university/issue': 'Issue Certificate',
  '/university/certificates': 'My Certificates',
  '/university/revocations': 'Revocations',
};

const localDateInput = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};

export default function UniversityDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname.replace(/\/+$/, '') || '/university';
  const activeTab = routeViews[currentPath] || 'Overview';
  const [stats, setStats] = useState({ total: 0, active: 0, revoked: 0, pending: 0, expired: 0 });
  const [certificates, setCertificates] = useState([]);
  const [recentCertificates, setRecentCertificates] = useState([]);
  const [certificatePagination, setCertificatePagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [certificatePage, setCertificatePage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [certificateSearch, setCertificateSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [refreshingIssued, setRefreshingIssued] = useState(false);
  const [revokeSubmitting, setRevokeSubmitting] = useState(false);
  const [revokeModal, setRevokeModal] = useState({ open: false, cert: null });
  const [revokeReason, setRevokeReason] = useState('');
  const [successModal, setSuccessModal] = useState({ open: false, cert: null });
  const [draftPdfUrl, setDraftPdfUrl] = useState('');
  const [draftPdfLoading, setDraftPdfLoading] = useState(false);
  const [draftPdfError, setDraftPdfError] = useState('');
  const [previewMode, setPreviewMode] = useState('pdf');
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [logoFileName, setLogoFileName] = useState('');
  const [logoError, setLogoError] = useState('');
  const [sponsorsText, setSponsorsText] = useState('');
  const logoFileInput = useRef(null);
  const firstDataLoad = useRef(true);
  const previousPath = useRef(currentPath);
  const [form, setForm] = useState({
    studentName: '', studentEmail: '', studentId: '',
    certificateTitle: 'Certificate of Achievement',
    courseName: '', grade: '', teacherName: '', teacherTitle: '', criteria: '', issueDate: localDateInput(), validUntil: '',
  });

  useEffect(() => {
    if (!routeViews[currentPath]) navigate('/university', { replace: true });
  }, [currentPath, navigate]);

  useEffect(() => {
    if (previousPath.current !== currentPath) {
      previousPath.current = currentPath;
      setCertificatePage(1);
    }
  }, [currentPath]);

  const fetchData = async ({ silent = false, page = certificatePage, view = activeTab, search = certificateSearch } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [statsRes, certsRes] = await Promise.allSettled([
        certificateService.getCertificateStats(),
        certificateService.getInstitutionCertificates(
          user?.institutionId?._id || user?.institutionId || 'default',
          page,
          view === 'Revocations' ? 'revocations' : 'certificates',
          search,
        ),
      ]);
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value.stats || stats);
        setRecentCertificates(statsRes.value.recentCertificates || []);
      }
      if (certsRes.status === 'fulfilled') {
        setCertificates(certsRes.value.certificates || []);
        setCertificatePagination(certsRes.value.pagination || { page: 1, limit: 10, total: 0, pages: 0 });
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const isFirstLoad = firstDataLoad.current;
    firstDataLoad.current = false;
    const page = ['My Certificates', 'Revocations'].includes(activeTab) ? certificatePage : 1;
    fetchData({ silent: !isFirstLoad, page, view: activeTab });
  }, [activeTab, certificatePage, certificateSearch, user?.institutionId]);

  useEffect(() => {
    if (currentPath !== '/university/issue') return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setDraftPdfLoading(true);
      setDraftPdfError('');
      try {
        const response = await certificateService.previewCertificatePdf({
          ...form,
          studentName: form.studentName.trim(),
          certificateTitle: form.certificateTitle.trim() || 'Certificate of Achievement',
          courseName: form.courseName.trim(),
          grade: form.grade.trim(),
          teacherName: form.teacherName.trim(),
          teacherTitle: form.teacherTitle.trim(),
          criteria: form.criteria.trim(),
          sponsors: parsedSponsors(),
          institutionLogo: logoDataUrl || undefined,
        }, controller.signal);
        if (!controller.signal.aborted) setDraftPdfUrl(URL.createObjectURL(response.data));
      } catch (error) {
        if (!controller.signal.aborted) {
          setDraftPdfError(error.response?.data?.message || 'The PDF preview could not be updated.');
        }
      } finally {
        if (!controller.signal.aborted) setDraftPdfLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [currentPath, form, logoDataUrl, sponsorsText, user?.institutionId]);

  useEffect(() => () => {
    if (draftPdfUrl) URL.revokeObjectURL(draftPdfUrl);
  }, [draftPdfUrl]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submitSearch = (event) => {
    event.preventDefault();
    setCertificatePage(1);
    setCertificateSearch(searchText.trim());
  };

  const parsedSponsors = () => sponsorsText.split(/[\n,;]+/).map((sponsor) => sponsor.trim()).filter(Boolean);

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0];
    setLogoError('');
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setLogoError('Choose a PNG or JPEG image.');
      event.target.value = '';
      return;
    }
    if (file.size > 128 * 1024) {
      setLogoError('The logo must be 128 KB or smaller.');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoDataUrl(String(reader.result || ''));
      setLogoFileName(file.name);
    };
    reader.onerror = () => setLogoError('This logo could not be read. Please choose another file.');
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setLogoDataUrl('');
    setLogoFileName('');
    setLogoError('');
    if (logoFileInput.current) logoFileInput.current.value = '';
  };

  const handleIssue = async (e) => {
    e.preventDefault();
    const email = form.studentEmail.trim();
    if (!form.studentName.trim() || !form.courseName.trim() || !email) return toast.error('Student name, student email, and credential name are required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error('Enter a valid student email address.');
    if (form.issueDate && form.issueDate > localDateInput()) return toast.error('Issue date cannot be in the future.');
    if (form.criteria.trim().length > 300) return toast.error('Credential criteria must be 300 characters or fewer.');
    if (form.validUntil && form.issueDate && form.validUntil < form.issueDate) return toast.error('Expiration date cannot be before the issue date.');
    if (parsedSponsors().length > 5 || parsedSponsors().some((sponsor) => sponsor.length > 100)) return toast.error('Use up to five sponsor names, with no more than 100 characters each.');
    setIssuing(true);
    try {
      const res = await certificateService.issueCertificate({
        ...form,
        studentName: form.studentName.trim(),
        studentEmail: email,
        studentId: form.studentId.trim(),
        certificateTitle: form.certificateTitle.trim() || 'Certificate of Achievement',
        courseName: form.courseName.trim(),
        grade: form.grade.trim(),
        teacherName: form.teacherName.trim(),
        teacherTitle: form.teacherTitle.trim(),
        criteria: form.criteria.trim(),
        sponsors: parsedSponsors(),
        institutionLogo: logoDataUrl || undefined,
        institutionName: user?.institutionId?.name || user?.name || 'University',
      });
      const cert = { ...res.certificate, verificationToken: res.verificationToken };
      toast.success('Credential created; proof confirmation has started.');
      setSuccessModal({ open: true, cert });
      setForm({ studentName: '', studentEmail: '', studentId: '', certificateTitle: 'Certificate of Achievement', courseName: '', grade: '', teacherName: '', teacherTitle: '', criteria: '', issueDate: localDateInput(), validUntil: '' });
      setSponsorsText('');
      clearLogo();
      setSearchText('');
      setCertificateSearch('');
      setCertificatePage(1);
      await fetchData({ silent: true, page: 1, search: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to issue certificate.');
    } finally {
      setIssuing(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeModal.cert || !revokeReason.trim()) return toast.error('Provide a reason before submitting the request.');
    setRevokeSubmitting(true);
    try {
      await certificateService.revokeCertificate(revokeModal.cert.certificateId, revokeReason.trim());
      toast.success('Request submitted. The certificate remains active until the blockchain confirms revocation.');
      setRevokeModal({ open: false, cert: null });
      setRevokeReason('');
      await fetchData({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to revoke.');
    } finally {
      setRevokeSubmitting(false);
    }
  };

  const refreshIssuedStatus = async () => {
    if (!successModal.cert?.certificateId) return;
    setRefreshingIssued(true);
    try {
      const response = await certificateService.getCertificate(successModal.cert.certificateId);
      setSuccessModal((current) => current.open ? {
        ...current,
        cert: { ...current.cert, ...response.certificate, verificationToken: current.cert.verificationToken },
      } : current);
      await fetchData({ silent: true });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not refresh credential status.');
    } finally {
      setRefreshingIssued(false);
    }
  };

  const statusBadge = (status) => {
    const map = {
      active: 'badge-active',
      expired: 'badge-revoked',
      revoked: 'badge-revoked',
      pending: 'badge-pending',
      'revocation pending': 'badge-pending',
      'revocation failed': 'badge-revoked',
    };
    return (
      <span className={`${map[status] || 'badge-pending'} capitalize`}>
        {status}
      </span>
    );
  };

  const certificateStatus = (certificate) => certificate.status === 'revoked'
    ? 'revoked'
    : certificate.revocationStatus === 'pending'
      ? 'revocation pending'
      : certificate.revocationStatus === 'failed'
        ? 'revocation failed'
        : certificate.status === 'active' && certificate.blockchainStatus === 'confirmed' && certificate.validUntil && new Date(certificate.validUntil).getTime() < Date.now()
          ? 'expired'
          : certificate.status;

  const visibleCertificates = activeTab === 'Revocations'
    ? certificates.filter((cert) => cert.revocationStatus && cert.revocationStatus !== 'none')
    : certificates;

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-96"><LoadingSpinner text="Loading dashboard..." /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        <header className="dashboard-heading">
          <h1>University workspace</h1>
          <p>Issue credentials and keep track of every record.</p>
        </header>
        {/* Overview */}
        {activeTab === 'Overview' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              <StatsCard title="Total Issued" value={stats.total} icon={<FiFileText />} color="blue" />
              <StatsCard title="Active" value={stats.active} icon={<FiCheckCircle />} color="green" />
              <StatsCard title="Expired" value={stats.expired || 0} icon={<FiClock />} color="yellow" />
              <StatsCard title="Revoked" value={stats.revoked} icon={<FiXCircle />} color="red" />
              <StatsCard title="Pending" value={stats.pending} icon={<FiClock />} color="yellow" />
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Certificates</h3>
              {recentCertificates.length === 0 ? (
                <EmptyState icon={FiFileText} title="No certificates yet" description="Issue your first certificate to get started." />
              ) : (
                <div className="table-scroll-region">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Certificate ID</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Student</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Course</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                    </tr></thead>
                    <tbody>
                      {recentCertificates.map((cert) => (
                        <tr key={cert.certificateId} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono text-xs">{cert.certificateId}</td>
                          <td className="py-3 px-4">{cert.studentName}</td>
                          <td className="py-3 px-4">{cert.courseName}</td>
                          <td className="py-3 px-4">{statusBadge(certificateStatus(cert))}</td>
                          <td className="py-3 px-4 text-slate-500">{new Date(cert.issueDate || cert.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Issue Certificate */}
        {activeTab === 'Issue Certificate' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="issue-workspace">
            <section className="card">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <FiPlusCircle className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Issue a credential</h3>
                  <p className="text-sm text-slate-500">Enter the details exactly as they should appear to a verifier.</p>
                </div>
              </div>

              <form onSubmit={handleIssue} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <label className="label">Certificate title</label>
                    <input name="certificateTitle" value={form.certificateTitle} onChange={handleChange} required maxLength={80} className="input-field" placeholder="Certificate of Achievement" />
                    <p className="mt-1.5 text-xs text-slate-500">Edit the wording that appears as the main heading on the certificate.</p>
                  </div>
                  <div>
                    <label className="label">Student Name *</label>
                    <input name="studentName" value={form.studentName} onChange={handleChange} required maxLength={120} autoComplete="name" className="input-field" placeholder="As it should appear on the certificate" />
                  </div>
                  <div>
                    <label className="label">Student Sign-in Email *</label>
                    <input name="studentEmail" type="email" value={form.studentEmail} onChange={handleChange} required maxLength={254} autoComplete="email" className="input-field" placeholder="student@university.edu" aria-describedby="student-email-help" />
                    <p id="student-email-help" className="mt-1.5 text-xs text-slate-500">Use the email they will use to register; this connects the credential to their workspace.</p>
                  </div>
                  <div>
                    <label className="label">Student ID <span className="text-slate-500">(optional)</span></label>
                    <input name="studentId" value={form.studentId} onChange={handleChange} maxLength={80} className="input-field" placeholder="University roll or registration number" />
                  </div>
                  <div>
                    <label className="label">Credential / Qualification *</label>
                    <input name="courseName" value={form.courseName} onChange={handleChange} required maxLength={160} className="input-field" placeholder="Bachelor of Computer Science" />
                  </div>
                  <div>
                    <label className="label">Result / Grade <span className="text-slate-500">(optional)</span></label>
                    <input name="grade" value={form.grade} onChange={handleChange} maxLength={30} className="input-field" placeholder="8.7 CGPA, First Class, Pass" />
                  </div>
                  <div>
                    <label className="label">Issue Date *</label>
                    <input name="issueDate" type="date" value={form.issueDate} onChange={handleChange} required max={localDateInput()} className="input-field" />
                  </div>
                  <div>
                    <label className="label">Valid Until <span className="text-slate-500">(optional)</span></label>
                    <input name="validUntil" type="date" value={form.validUntil} onChange={handleChange} min={form.issueDate} className="input-field" />
                    <p className="mt-1.5 text-xs text-slate-500">Leave blank for a credential with no expiry date.</p>
                  </div>
                  <div>
                    <label className="label">Instructor / Teacher <span className="text-slate-500">(optional)</span></label>
                    <input name="teacherName" value={form.teacherName} onChange={handleChange} maxLength={120} className="input-field" placeholder="Dr. A. Sharma" />
                  </div>
                  <div>
                    <label className="label">Instructor title <span className="text-slate-500">(optional)</span></label>
                    <input name="teacherTitle" value={form.teacherTitle} onChange={handleChange} maxLength={80} className="input-field" placeholder="Faculty advisor" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Achievement criteria <span className="text-slate-500">(optional)</span></label>
                    <textarea name="criteria" value={form.criteria} onChange={handleChange} maxLength={300} rows={2} className="input-field min-h-20" placeholder="What did the student need to demonstrate to earn this credential?" />
                    <p className="mt-1.5 text-xs text-slate-500">Visible to anyone with the verification link. {form.criteria.length}/300 characters.</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Sponsors <span className="text-slate-500">(optional)</span></label>
                    <textarea value={sponsorsText} onChange={(event) => setSponsorsText(event.target.value)} maxLength={520} rows={2} className="input-field min-h-20" placeholder="One sponsor per line, or separate names with commas" />
                    <p className="mt-1.5 text-xs text-slate-500">Up to five sponsors can be shown on the certificate and verification preview. {parsedSponsors().length}/5 entered.</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">University logo <span className="text-slate-500">(optional)</span></label>
                    <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-700 p-3">
                      {logoDataUrl && <img src={logoDataUrl} alt="University logo preview" className="credential-logo-upload-preview" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-200">{logoFileName || 'Add your university or department logo'}</p>
                        <p className="mt-1 text-xs text-slate-500">PNG or JPEG · 128 KB maximum</p>
                      </div>
                      <input ref={logoFileInput} id="credential-university-logo" type="file" accept="image/png,image/jpeg" onChange={handleLogoChange} className="sr-only" />
                      <label htmlFor="credential-university-logo" className="btn-secondary min-h-9 cursor-pointer px-3 py-2 text-xs"><FiUploadCloud aria-hidden="true" /> {logoDataUrl ? 'Replace logo' : 'Upload logo'}</label>
                      {logoDataUrl && <button type="button" onClick={clearLogo} className="btn-ghost min-h-9 px-2 text-xs">Remove</button>}
                    </div>
                    {logoError && <p role="alert" className="mt-2 text-xs text-rose-800">{logoError}</p>}
                  </div>
                </div>

                <div className="issue-guidance">
                  Review the preview before issuing. Once recorded, the credential cannot be edited; a correction requires a revocation request and a new credential.
                </div>
                <button type="submit" disabled={issuing} className="btn-primary w-full flex items-center justify-center gap-2">
                  {issuing ? <LoadingSpinner text="Creating credential…" /> : <><FiPlusCircle /> Issue credential</>}
                </button>
              </form>
            </section>
            <aside className="issue-preview-sticky">
              <p className="eyebrow text-slate-400 mb-3">LIVE PREVIEW</p>
              <div className="preview-mode-tabs" role="tablist" aria-label="Credential preview type">
                <button type="button" role="tab" aria-selected={previewMode === 'pdf'} className={previewMode === 'pdf' ? 'active' : ''} onClick={() => setPreviewMode('pdf')}><FiFileText aria-hidden="true" /> PDF certificate</button>
                <button type="button" role="tab" aria-selected={previewMode === 'share'} className={previewMode === 'share' ? 'active' : ''} onClick={() => setPreviewMode('share')}><FiEye aria-hidden="true" /> Verification page</button>
              </div>
              {previewMode === 'pdf' ? (
                <div className="private-pdf-preview draft-pdf-preview">
                  <div className="private-pdf-toolbar"><span>Draft certificate</span><span>{draftPdfLoading ? 'Updating…' : 'Live PDF'}</span></div>
                  {draftPdfUrl
                    ? <iframe title="Live draft certificate PDF" src={draftPdfUrl} className="private-pdf-frame draft-pdf-frame" />
                    : <div className="draft-pdf-empty">{draftPdfError || 'Preparing your PDF preview…'}</div>}
                  {draftPdfError && draftPdfUrl && <p role="status" className="draft-pdf-warning">{draftPdfError}</p>}
                </div>
              ) : (
                <CredentialPreview
                  certificate={{
                    ...form,
                    institutionLogo: logoDataUrl,
                    sponsors: parsedSponsors(),
                    institutionName: user?.institutionId?.name || user?.institutionName || user?.name || 'Issuing institution',
                  }}
                  status="draft"
                />
              )}
              <p className="mt-3 text-xs text-slate-500">The PDF preview uses the final certificate layout and updates as you edit. The issued copy adds the verification QR and record ID. The verification page preview shows what a link recipient sees.</p>
            </aside>
          </motion.div>
        )}

        {/* My Certificates */}
        {(activeTab === 'My Certificates' || activeTab === 'Revocations') && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="card">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">
                {activeTab === 'Revocations' ? 'Revocation requests' : 'All issued certificates'}
              </h3>
              {activeTab === 'Revocations' && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-500">A request is final only after blockchain confirmation. Failed requests can be retried.</p>
                  <button type="button" onClick={() => fetchData({ silent: true })} className="btn-secondary min-h-9 px-3 py-2 text-xs"><FiRefreshCw aria-hidden="true" /> Refresh status</button>
                </div>
              )}
              <form onSubmit={submitSearch} className="credential-search-form">
                <div className="credential-search-input">
                  <FiSearch aria-hidden="true" />
                  <input type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} maxLength={100} placeholder="Search student, qualification, or record ID" aria-label="Search credential records" />
                  {searchText && <button type="button" onClick={() => { setSearchText(''); setCertificateSearch(''); setCertificatePage(1); }} aria-label="Clear search"><FiX aria-hidden="true" /></button>}
                </div>
                <button type="submit" className="btn-secondary min-h-10 px-4 py-2 text-xs">Search</button>
              </form>
              {visibleCertificates.length === 0 ? (
                <EmptyState
                  icon={activeTab === 'Revocations' ? FiXCircle : FiFileText}
                  title={certificateSearch ? 'No matching records' : activeTab === 'Revocations' ? 'No revocation requests' : 'No certificates'}
                  description={certificateSearch ? 'Try a different student name, qualification, or record ID.' : activeTab === 'Revocations' ? 'Requests and their blockchain confirmation status will appear here.' : "You haven't issued any certificates yet."}
                  actionLabel={activeTab === 'Revocations' ? undefined : 'Issue Certificate'}
                  onAction={activeTab === 'Revocations' ? undefined : () => navigate('/university/issue')}
                />
              ) : (
                <div className="table-scroll-region">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Certificate ID</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Student</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Course</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr></thead>
                    <tbody>
                      {visibleCertificates.map((cert) => (
                        <tr key={cert.certificateId} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono text-xs">{cert.certificateId}</td>
                          <td className="py-3 px-4">{cert.studentName}</td>
                          <td className="py-3 px-4">{cert.courseName}</td>
                          <td className="py-3 px-4">{statusBadge(certificateStatus(cert))}</td>
                          <td className="py-3 px-4 text-slate-500">{new Date(cert.issueDate || cert.createdAt).toLocaleDateString()}</td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <button onClick={() => window.open(`/certificate/${cert.certificateId}`, '_blank', 'noopener,noreferrer')} className="text-indigo-600 hover:text-indigo-800" title="View credential">
                                <FiEye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setRevokeModal({ open: true, cert })}
                                disabled={cert.status !== 'active' || cert.blockchainStatus !== 'confirmed' || cert.revocationStatus === 'pending' || cert.status === 'revoked'}
                                className="text-rose-700 hover:text-rose-900 disabled:cursor-not-allowed disabled:opacity-35"
                                title={cert.status === 'revoked' ? 'Already revoked' : cert.revocationStatus === 'pending' ? 'Revocation request is processing' : cert.blockchainStatus !== 'confirmed' ? 'Available after issuance is confirmed' : cert.revocationStatus === 'failed' ? 'Retry revocation request' : 'Request revocation'}
                                aria-label={cert.revocationStatus === 'failed' ? `Retry revocation for ${cert.certificateId}` : `Request revocation for ${cert.certificateId}`}
                              >
                                {cert.revocationStatus === 'failed' ? <FiRefreshCw className="w-4 h-4" /> : <FiSlash className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <PaginationControls page={certificatePage} pagination={certificatePagination} onPageChange={setCertificatePage} />
            </div>
          </motion.div>
        )}

        {/* Revoke Modal */}
        <Modal
          isOpen={revokeModal.open}
          onClose={() => {
            if (revokeSubmitting) return;
            setRevokeModal({ open: false, cert: null });
            setRevokeReason('');
          }}
          title="Request credential revocation"
        >
          {revokeModal.cert && (
            <form onSubmit={(event) => { event.preventDefault(); handleRevoke(); }} className="space-y-4">
              <div className="revocation-guidance">
                This cannot be undone after blockchain confirmation. Until then, the credential remains active and its public link reports “revocation pending”.
              </div>
              <div className="rounded-md border border-slate-700 p-3 text-sm">
                <p className="text-slate-400">{revokeModal.cert.studentName}</p>
                <p className="mt-1 font-medium text-slate-100">{revokeModal.cert.courseName}</p>
                <p className="mt-2 font-mono text-xs text-slate-500">{revokeModal.cert.certificateId}</p>
              </div>
              <div>
                <label htmlFor="revocation-reason" className="label">Reason for this request *</label>
                <textarea
                  id="revocation-reason"
                  value={revokeReason}
                  onChange={(event) => setRevokeReason(event.target.value)}
                  className="input-field"
                  rows={4}
                  maxLength={500}
                  required
                  placeholder="Give a concise reason for the institution’s record."
                />
                <p className="revocation-reason-note">{revokeReason.length}/500 characters. The reason stays in Credora’s private record; the blockchain stores only the revocation status.</p>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => { setRevokeModal({ open: false, cert: null }); setRevokeReason(''); }}
                  disabled={revokeSubmitting}
                  className="btn-secondary"
                >Cancel</button>
                <button type="submit" disabled={revokeSubmitting || !revokeReason.trim()} className="btn-danger">
                  {revokeSubmitting ? 'Submitting request…' : 'Submit revocation request'}
                </button>
              </div>
            </form>
          )}
        </Modal>

        {/* Success Modal */}
        <Modal isOpen={successModal.open} onClose={() => setSuccessModal({ open: false, cert: null })} title="Credential issued">
          {successModal.cert && (
            <div className="space-y-4">
              <CredentialPreview
                certificate={successModal.cert}
                status={successModal.cert.blockchainStatus === 'confirmed' ? 'valid' : 'pending'}
                shareUrl={successModal.cert.verificationToken ? `${window.location.origin}/verify/${successModal.cert.verificationToken}` : undefined}
              />
              {successModal.cert.transactionUrl && (
                <a href={successModal.cert.transactionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex text-sm font-medium text-cyan-300 hover:text-cyan-100">
                  View issuance transaction on blockchain explorer ↗
                </a>
              )}
              <p className="text-sm text-slate-400">The student can see this record after signing in with the email entered above. Wait for the proof to be confirmed before asking anyone to rely on the public link.</p>
              {successModal.cert.blockchainStatus !== 'confirmed' && (
                <button type="button" onClick={refreshIssuedStatus} disabled={refreshingIssued} className="btn-secondary w-full">
                  <FiRefreshCw aria-hidden="true" /> {refreshingIssued ? 'Checking confirmation…' : 'Refresh blockchain status'}
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`${window.location.origin}/verify/${successModal.cert.verificationToken}`);
                    toast.success('Verification link copied.');
                  } catch (_error) {
                    toast.error('Could not copy the link. You can scan the QR instead.');
                  }
                }}
                disabled={!successModal.cert.verificationToken}
                className="btn-primary w-full"
              >
                Copy graduate’s verification link
              </button>
              <p className="text-xs text-slate-500">Anyone with this link can see the credential details and status. The original PDF stays private to the student and issuing institution.</p>
            </div>
          )}
        </Modal>
      </div>
    </DashboardLayout>
  );
}
