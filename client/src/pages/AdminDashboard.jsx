import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiFileText, FiCheckCircle, FiXCircle, FiClock, FiPlus, FiEye, FiSearch, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';
import DashboardLayout from '../components/DashboardLayout';
import StatsCard from '../components/StatsCard';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import certificateService from '../services/certificateService';
import institutionService from '../services/institutionService';
import authService from '../services/authService';
import PaginationControls from '../components/PaginationControls';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const routeViews = {
  '/admin': 'Overview',
  '/admin/institutions': 'Institutions',
  '/admin/users': 'Users',
  '/admin/certificates': 'Certificates',
};

const statusBadge = (status) => {
  const map = {
    active: 'badge-active',
    approved: 'badge-active',
    valid: 'badge-active',
    revoked: 'badge-revoked',
    expired: 'badge-revoked',
    inactive: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700',
    pending: 'badge-pending',
    'revocation pending': 'badge-pending',
    'revocation failed': 'badge-revoked',
  };
  const cls = map[(status || '').toLowerCase()] || 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700';
  return (
    <span className={`${cls} capitalize`}>
      {status}
    </span>
  );
};

const roleBadge = (role) => {
  const map = {
    admin: 'bg-purple-50 text-purple-700 border border-purple-200',
    university: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    student: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    verifier: 'bg-amber-50 text-amber-700 border border-amber-200',
  };
  const cls = map[(role || '').toLowerCase()] || 'bg-slate-100 text-slate-700';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {role}
    </span>
  );
};

const credentialStatus = (certificate) => certificate.status === 'revoked'
  ? 'revoked'
  : certificate.revocationStatus === 'pending'
    ? 'revocation pending'
    : certificate.revocationStatus === 'failed'
      ? 'revocation failed'
      : certificate.status === 'active' && certificate.validUntil && new Date(certificate.validUntil).getTime() < Date.now()
        ? 'expired'
        : certificate.status;

export default function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const currentPath = location.pathname.replace(/\/+$/, '') || '/admin';
  const activeTab = routeViews[currentPath] || 'Overview';
  const [loading, setLoading] = useState(true);

  // Overview
  const [stats, setStats] = useState({ total: 0, active: 0, revoked: 0, pending: 0, expired: 0 });
  const [recentCerts, setRecentCerts] = useState([]);
  const [certificatePage, setCertificatePage] = useState(1);
  const [searchText, setSearchText] = useState('');
  const [certificateSearch, setCertificateSearch] = useState('');
  const [certificatePagination, setCertificatePagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [certificatesLoading, setCertificatesLoading] = useState(false);

  // Institutions
  const [institutions, setInstitutions] = useState([]);
  const [instLoading, setInstLoading] = useState(false);
  const [addInstModal, setAddInstModal] = useState(false);
  const [instForm, setInstForm] = useState({ name: '', code: '', email: '', phone: '' });
  const [instSubmitting, setInstSubmitting] = useState(false);

  // Users
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [userPagination, setUserPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [userSearchText, setUserSearchText] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [roleChange, setRoleChange] = useState({ user: null, nextRole: '' });
  const [roleSaving, setRoleSaving] = useState(false);

  useEffect(() => {
    if (!routeViews[currentPath]) navigate('/admin', { replace: true });
  }, [currentPath, navigate]);

  useEffect(() => {
    fetchOverview();
  }, []);

  useEffect(() => {
    if (activeTab === 'Institutions' && institutions.length === 0) fetchInstitutions();
    if (activeTab === 'Users') fetchUsers(userPage, userSearch);
    if (activeTab === 'Certificates') fetchAdminCertificates(certificatePage, certificateSearch);
  }, [activeTab, certificatePage, certificateSearch, userPage, userSearch]);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const data = await certificateService.getCertificateStats();
      const dashboardStats = data.stats || data;
      setStats({
        total: dashboardStats.total ?? dashboardStats.totalCertificates ?? 0,
        active: dashboardStats.active ?? dashboardStats.activeCertificates ?? 0,
        revoked: dashboardStats.revoked ?? dashboardStats.revokedCertificates ?? 0,
        pending: dashboardStats.pending ?? dashboardStats.pendingCertificates ?? 0,
        expired: dashboardStats.expired ?? 0,
      });
      setRecentCerts(data.recentCertificates || data.recent || []);
    } catch (err) {
      toast.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminCertificates = async (page = 1, search = certificateSearch) => {
    setCertificatesLoading(true);
    try {
      const data = await certificateService.getAdminCertificates(page, search);
      setRecentCerts(data.certificates || []);
      setCertificatePagination(data.pagination || { page: 1, limit: 10, total: 0, pages: 0 });
    } catch (_error) {
      toast.error('Failed to load credential records');
    } finally {
      setCertificatesLoading(false);
    }
  };

  const submitCertificateSearch = (event) => {
    event.preventDefault();
    setCertificatePage(1);
    setCertificateSearch(searchText.trim());
  };

  const fetchInstitutions = async () => {
    setInstLoading(true);
    try {
      const data = await institutionService.getInstitutions();
      setInstitutions(Array.isArray(data) ? data : data.institutions || []);
    } catch (err) {
      toast.error('Failed to load institutions');
    } finally {
      setInstLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await institutionService.approveInstitution(id);
      toast.success('Institution approved');
      fetchInstitutions();
    } catch (err) {
      toast.error('Failed to approve institution');
    }
  };

  const handleAddInstitution = async (e) => {
    e.preventDefault();
    setInstSubmitting(true);
    try {
      await institutionService.registerInstitution(instForm);
      toast.success('Institution added');
      setAddInstModal(false);
      setInstForm({ name: '', code: '', email: '', phone: '' });
      fetchInstitutions();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add institution');
    } finally {
      setInstSubmitting(false);
    }
  };

  const fetchUsers = async (page = userPage, search = userSearch) => {
    setUsersLoading(true);
    try {
      const data = await authService.getAllUsers(page, 10, search);
      setUsers(Array.isArray(data) ? data : data.users || []);
      setUserPagination(data.pagination || { page, limit: 10, total: 0, pages: 0 });
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleRoleChange = (userId, newRole) => {
    const target = users.find((u) => String(u._id || u.id) === String(userId));
    if (target && target.role !== newRole) setRoleChange({ user: target, nextRole: newRole });
  };

  const confirmRoleChange = async () => {
    if (!roleChange.user || !roleChange.nextRole) return;
    setRoleSaving(true);
    try {
      await authService.updateUserRole(roleChange.user._id || roleChange.user.id, roleChange.nextRole);
      toast.success('Role updated');
      setRoleChange({ user: null, nextRole: '' });
      fetchUsers(userPage, userSearch);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update role');
    } finally {
      setRoleSaving(false);
    }
  };

  const submitUserSearch = (event) => {
    event.preventDefault();
    setUserPage(1);
    setUserSearch(userSearchText.trim());
  };

  if (loading && (activeTab === 'Overview' || activeTab === 'Certificates')) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner text="Loading dashboard..." />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <header className="dashboard-heading">
          <h1>Admin workspace</h1>
          <p>Manage institutions, accounts, and credential activity.</p>
        </header>

        {/* Overview */}
        {activeTab === 'Overview' && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
              <StatsCard title="Total Certificates" value={stats.total} icon={<FiFileText />} color="blue" />
              <StatsCard title="Active" value={stats.active} icon={<FiCheckCircle />} color="green" />
              <StatsCard title="Expired" value={stats.expired || 0} icon={<FiClock />} color="yellow" />
              <StatsCard title="Revoked" value={stats.revoked} icon={<FiXCircle />} color="red" />
              <StatsCard title="Pending" value={stats.pending} icon={<FiClock />} color="yellow" />
            </div>
          </div>
        )}

        {/* Certificates */}
        {activeTab === 'Certificates' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900">Credential records</h3>
            </div>
            <form onSubmit={submitCertificateSearch} className="credential-search-form px-6 py-4">
              <div className="credential-search-input">
                <FiSearch aria-hidden="true" />
                <input type="search" value={searchText} onChange={(event) => setSearchText(event.target.value)} maxLength={100} placeholder="Search student, institution, qualification, or record ID" aria-label="Search credential records" />
                {searchText && <button type="button" onClick={() => { setSearchText(''); setCertificateSearch(''); setCertificatePage(1); }} aria-label="Clear search"><FiX aria-hidden="true" /></button>}
              </div>
              <button type="submit" className="btn-secondary min-h-10 px-4 py-2 text-xs">Search</button>
            </form>
            <div className="table-scroll-region">
              <table className="admin-data-table w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Certificate ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Student Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Course</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Institution</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {certificatesLoading ? (
                    <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-400">Loading records…</td></tr>
                  ) : recentCerts.length > 0 ? recentCerts.map((cert, i) => (
                    <tr key={cert._id || cert.certificateId || i} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-mono text-xs text-indigo-600">{cert.certificateId || cert._id}</td>
                      <td className="px-6 py-3">{cert.studentName || cert.student?.name || '-'}</td>
                      <td className="px-6 py-3">{cert.courseName || cert.course || '-'}</td>
                      <td className="px-6 py-3">{cert.institutionName || cert.institution?.name || '-'}</td>
                      <td className="px-6 py-3">{statusBadge(credentialStatus(cert))}</td>
                      <td className="px-6 py-3 text-slate-500">{cert.issueDate ? new Date(cert.issueDate).toLocaleDateString() : '-'}</td>
                      <td className="px-6 py-3"><button type="button" onClick={() => navigate(`/certificate/${cert.certificateId}`)} className="inline-flex items-center gap-1 text-indigo-700 hover:text-indigo-900" aria-label={`View credential ${cert.certificateId}`}><FiEye aria-hidden="true" /> View</button></td>
                    </tr>
                  )) : (
                    <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-400">{certificateSearch ? 'No matching credential records found' : 'No credential records found'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 pb-4">
              <PaginationControls page={certificatePage} pagination={certificatePagination} onPageChange={setCertificatePage} />
            </div>
          </div>
        )}

        {/* Institutions */}
        {activeTab === 'Institutions' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900">Institutions</h3>
              <button
                onClick={() => setAddInstModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <FiPlus className="w-4 h-4" /> Add Institution
              </button>
            </div>

            {instLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner text="Loading institutions..." />
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="table-scroll-region">
                  <table className="admin-data-table w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Code</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {institutions.length > 0 ? (
                        institutions.map((inst) => (
                          <tr key={inst._id || inst.code} className="hover:bg-slate-50">
                            <td className="px-6 py-3 font-medium">{inst.name}</td>
                            <td className="px-6 py-3 font-mono text-xs">{inst.code}</td>
                            <td className="px-6 py-3">{inst.email}</td>
                            <td className="px-6 py-3">{statusBadge(inst.isApproved ? 'approved' : 'pending')}</td>
                            <td className="px-6 py-3">
                              {!inst.isApproved && (
                                <button
                                  onClick={() => handleApprove(inst._id)}
                                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                  Approve
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                            No institutions found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Add Institution Modal */}
            <Modal isOpen={addInstModal} onClose={() => setAddInstModal(false)} title="Add Institution">
              <form onSubmit={handleAddInstitution} className="space-y-4">
                <div>
                  <label className="label">Name</label>
                  <input
                    type="text" required
                    value={instForm.name}
                    onChange={(e) => setInstForm((p) => ({ ...p, name: e.target.value }))}
                    className="input-field" placeholder="Institution name"
                  />
                </div>
                <div>
                  <label className="label">Code</label>
                  <input
                    type="text" required
                    value={instForm.code}
                    onChange={(e) => setInstForm((p) => ({ ...p, code: e.target.value }))}
                    className="input-field" placeholder="e.g. UNIV-001"
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email" required
                    value={instForm.email}
                    onChange={(e) => setInstForm((p) => ({ ...p, email: e.target.value }))}
                    className="input-field" placeholder="admin@institution.edu"
                  />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input
                    type="text"
                    value={instForm.phone}
                    onChange={(e) => setInstForm((p) => ({ ...p, phone: e.target.value }))}
                    className="input-field" placeholder="+1 234 567 890"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setAddInstModal(false)}
                    className="btn-secondary text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={instSubmitting}
                    className="btn-primary text-sm"
                  >
                    {instSubmitting ? 'Adding...' : 'Add Institution'}
                  </button>
                </div>
              </form>
            </Modal>
          </div>
        )}

        {/* Users */}
        {activeTab === 'Users' && (
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Users</h3>
            <form onSubmit={submitUserSearch} className="credential-search-form mb-5">
              <div className="credential-search-input">
                <FiSearch aria-hidden="true" />
                <input type="search" value={userSearchText} onChange={(event) => setUserSearchText(event.target.value)} maxLength={100} placeholder="Search by name, email, or role" aria-label="Search user accounts" />
                {userSearchText && <button type="button" onClick={() => { setUserSearchText(''); setUserSearch(''); setUserPage(1); }} aria-label="Clear user search"><FiX aria-hidden="true" /></button>}
              </div>
              <button type="submit" className="btn-secondary min-h-10 px-4 py-2 text-xs">Search users</button>
            </form>
            {usersLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner text="Loading users..." />
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="table-scroll-region">
                  <table className="admin-data-table w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.length > 0 ? (
                        users.map((u) => (
                          <tr key={u._id || u.email} className="hover:bg-slate-50">
                            <td className="px-6 py-3 font-medium">{u.name}</td>
                            <td className="px-6 py-3">{u.email}</td>
                            <td className="px-6 py-3">{roleBadge(u.role)}</td>
                            <td className="px-6 py-3">{statusBadge(u.isActive === false ? 'inactive' : 'active')}</td>
                            <td className="px-6 py-3">
                              <select
                                value={u.role}
                                onChange={(e) => handleRoleChange(u._id || u.id, e.target.value)}
                                disabled={Boolean((currentUser?._id || currentUser?.id) && String(u._id || u.id) === String(currentUser._id || currentUser.id))}
                                aria-label={`Change role for ${u.name}`}
                                title={String(u._id || u.id) === String(currentUser?._id || currentUser?.id) ? 'You cannot change your own role.' : 'Choose a new account role.'}
                                className="text-sm border border-slate-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none"
                              >
                                <option value="student">Student</option>
                                <option value="university">University</option>
                                <option value="verifier">Verifier</option>
                                <option value="admin">Admin</option>
                              </select>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                            No users found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="mt-4">
              <PaginationControls page={userPage} pagination={userPagination} onPageChange={setUserPage} />
            </div>
          </div>
        )}

        <Modal
          isOpen={Boolean(roleChange.user)}
          onClose={() => { if (!roleSaving) setRoleChange({ user: null, nextRole: '' }); }}
          title="Confirm account role change"
        >
          {roleChange.user && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Change <strong>{roleChange.user.name}</strong> from <strong className="capitalize">{roleChange.user.role}</strong> to <strong className="capitalize">{roleChange.nextRole}</strong>?
              </p>
              {(roleChange.user.role === 'admin' || roleChange.nextRole === 'admin') && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Admin accounts can manage institutions, users, and credential records. Only assign this role to trusted administrators.
                </div>
              )}
              <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
                <button type="button" disabled={roleSaving} onClick={() => setRoleChange({ user: null, nextRole: '' })} className="btn-secondary">Cancel</button>
                <button type="button" disabled={roleSaving} onClick={confirmRoleChange} className="btn-primary">
                  {roleSaving ? 'Saving role…' : 'Confirm role change'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      </motion.div>
    </DashboardLayout>
  );
}
