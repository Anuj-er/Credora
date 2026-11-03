import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiFileText, FiCheckCircle, FiGrid, FiShare2, FiEye, FiCopy, FiSearch, FiX } from 'react-icons/fi';
import QRCode from 'react-qr-code';
import { useAuth } from '../context/AuthContext';
import certificateService from '../services/certificateService';
import DashboardLayout from '../components/DashboardLayout';
import StatsCard from '../components/StatsCard';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import PaginationControls from '../components/PaginationControls';

const routeViews = {
  '/student': 'Overview',
  '/student/certificates': 'My Certificates',
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname.replace(/\/+$/, '') || '/student';
  const activeTab = routeViews[currentPath] || 'Overview';
  const [certificates, setCertificates] = useState([]);
  const [recentCertificates, setRecentCertificates] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, revoked: 0, pending: 0, expired: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [certificatePage, setCertificatePage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [certificateSearch, setCertificateSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [qrModal, setQrModal] = useState({ open: false, cert: null });

  useEffect(() => {
    if (!routeViews[currentPath]) navigate('/student', { replace: true });
  }, [currentPath, navigate]);

  useEffect(() => {
    fetchCertificates(certificatePage, certificateSearch);
  }, [user, certificatePage, certificateSearch]);

  const fetchCertificates = async (page = 1, search = '') => {
    setLoading(true);
    try {
      const [res, statsRes] = await Promise.all([
        certificateService.getStudentCertificates(user?.email || '', page, search),
        certificateService.getCertificateStats(),
      ]);
      setCertificates(res.certificates || []);
      setPagination(res.pagination || { page: 1, limit: 10, total: 0, pages: 0 });
      setStats(statsRes.stats || { total: 0, active: 0, revoked: 0, pending: 0, expired: 0 });
      setRecentCertificates(statsRes.recentCertificates || []);
    } catch (err) {
      console.error('Failed to fetch certificates:', err);
    } finally {
      setLoading(false);
    }
  };

  const submitCertificateSearch = (event) => {
    event.preventDefault();
    setCertificatePage(1);
    setCertificateSearch(searchText.trim());
  };

  const copyLink = async (verificationToken) => {
    if (!verificationToken) return toast.error('A verification link is not available for this record.');
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/verify/${verificationToken}`);
      toast.success('Verification link copied.');
    } catch (_error) {
      toast.error('Could not copy the link. You can scan the QR code instead.');
    }
  };

  const activeCerts = stats.active || 0;

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

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-96"><LoadingSpinner text="Loading your certificates..." /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="dashboard-page">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user?.name || 'Student'}</h1>
          <p className="text-slate-500 mt-1">View and manage your academic certificates</p>
        </motion.div>

        {/* Overview */}
        {activeTab === 'Overview' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              <StatsCard title="Total Certificates" value={stats.total} icon={<FiFileText />} color="blue" />
              <StatsCard title="Active Certificates" value={activeCerts} icon={<FiCheckCircle />} color="green" />
              <StatsCard title="Expired" value={stats.expired || 0} icon={<FiFileText />} color="yellow" />
              <StatsCard title="Revoked" value={stats.revoked || 0} icon={<FiFileText />} color="red" />
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Recent Certificates</h3>
              {recentCertificates.length === 0 ? (
                <EmptyState icon={FiFileText} title="No certificates yet" description="Your issued certificates will appear here." />
              ) : (
                <div className="space-y-4">
                  {recentCertificates.slice(0, 5).map((cert) => (
                    <div key={cert.certificateId} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div>
                        <p className="font-medium text-slate-900">{cert.courseName}</p>
                        <p className="text-sm text-slate-500">{cert.institutionName} - {new Date(cert.issueDate || cert.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {statusBadge(certificateStatus(cert))}
                        <button onClick={() => navigate(`/certificate/${cert.certificateId}`)} className="text-cyan-300 hover:text-cyan-100" aria-label={`Open ${cert.courseName} credential`}>
                          <FiEye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* My Certificates */}
        {activeTab === 'My Certificates' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <form onSubmit={submitCertificateSearch} className="credential-search-form mb-5">
              <div className="credential-search-input">
                <FiSearch aria-hidden="true" />
                <input type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} maxLength={100} placeholder="Search by qualification or record ID" aria-label="Search my credentials" />
                {searchText && <button type="button" onClick={() => { setSearchText(''); setCertificateSearch(''); setCertificatePage(1); }} aria-label="Clear search"><FiX aria-hidden="true" /></button>}
              </div>
              <button type="submit" className="btn-secondary min-h-10 px-4 py-2 text-xs">Search</button>
            </form>
            {certificates.length === 0 ? (
              <EmptyState icon={FiFileText} title={certificateSearch ? 'No matching credentials' : 'No certificates'} description={certificateSearch ? 'Try another qualification or record ID.' : "You don't have any certificates yet. They will appear here once issued by your institution."} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {certificates.map((cert) => (
                  <motion.div
                    key={cert.certificateId}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="card hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="font-semibold text-slate-900">{cert.courseName}</h4>
                        <p className="text-sm text-slate-500">{cert.institutionName}</p>
                      </div>
                      {statusBadge(certificateStatus(cert))}
                    </div>

                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Certificate ID</span>
                        <span className="font-mono text-xs text-slate-700">{cert.certificateId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Issue Date</span>
                        <span className="text-slate-700">{new Date(cert.issueDate || cert.createdAt).toLocaleDateString()}</span>
                      </div>
                      {cert.grade && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Grade</span>
                          <span className="font-semibold text-slate-700">{cert.grade}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-4 border-t border-slate-100">
                      <button
                        onClick={() => navigate(`/certificate/${cert.certificateId}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <FiEye className="w-4 h-4" /> View credential
                      </button>
                      <button
                        onClick={() => setQrModal({ open: true, cert })}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <FiGrid className="w-4 h-4" /> Show QR
                      </button>
                      <button
                        onClick={() => copyLink(cert.verificationToken)}
                        disabled={!cert.verificationToken}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <FiShare2 className="w-4 h-4" /> Share
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
            <PaginationControls page={certificatePage} pagination={pagination} onPageChange={setCertificatePage} />
          </motion.div>
        )}

        {/* QR Code Modal */}
        <Modal isOpen={qrModal.open} onClose={() => setQrModal({ open: false, cert: null })} title="Certificate QR Code">
          {qrModal.cert && (
            <div className="text-center">
              <div className="qr-canvas flex justify-center mb-4 p-4 rounded-lg">
                {qrModal.cert.verificationToken
                  ? <QRCode value={`${window.location.origin}/verify/${qrModal.cert.verificationToken}`} size={220} />
                  : <p className="text-sm text-slate-500">This older record has no secure verification link.</p>}
              </div>
              <p className="text-sm text-slate-500 mb-2">Scan to verify this certificate</p>
              <p className="font-mono text-xs text-slate-400">{qrModal.cert.certificateId}</p>
              <button
                onClick={() => copyLink(qrModal.cert.verificationToken)}
                className="mt-4 btn-primary flex items-center justify-center gap-2 mx-auto"
              >
                <FiCopy className="w-4 h-4" /> Copy Verification Link
              </button>
            </div>
          )}
        </Modal>

      </div>
    </DashboardLayout>
  );
}
