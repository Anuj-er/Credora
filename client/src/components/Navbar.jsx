import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiChevronDown, FiLogOut, FiMenu, FiUser, FiX } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const roleHome = { admin: '/admin', university: '/university', student: '/student' };
  const workspacePath = roleHome[user?.role];
  const guestLinks = [
    { to: '/', label: 'Overview' },
    { to: '/verify', label: 'Verify' },
    { to: '/login', label: 'Sign in' },
  ];
  const links = isAuthenticated
    ? [
        ...(workspacePath ? [{ to: workspacePath, label: 'Workspace' }] : []),
        { to: '/verify', label: 'Verify' },
      ]
    : authLoading
      ? [{ to: '/verify', label: 'Verify' }]
      : guestLinks;

  const active = (to) => location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  const closeMobile = () => setMobileOpen(false);

  const handleLogout = () => {
    logout();
    setDropdownOpen(false);
    closeMobile();
    navigate('/');
  };

  return (
    <header className="nav-shell">
      <div className="nav-inner">
        <Link to="/" className="nav-brand" onClick={closeMobile} aria-label="Credora home">
          <span className="brand-mark" aria-hidden="true" />
          <span>CREDORA</span>
        </Link>

        <nav className="nav-links" aria-label="Main navigation">
          {links.map((link) => (
            <Link key={link.to} to={link.to} className={`nav-link ${active(link.to) ? 'active' : ''}`}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="nav-actions">
          {!authLoading && !isAuthenticated ? (
            <Link to="/register" className="btn-secondary nav-create">Create account</Link>
          ) : isAuthenticated ? (
            <div className="nav-account">
              <button
                className="nav-account-trigger"
                onClick={() => setDropdownOpen((open) => !open)}
                aria-expanded={dropdownOpen}
                aria-label="Open account menu"
              >
                <span className="nav-avatar"><FiUser aria-hidden="true" /></span>
                <span className="text-sm font-medium">{user?.name}</span>
                <FiChevronDown className="text-slate-400" aria-hidden="true" />
              </button>
              {dropdownOpen && (
                <>
                  <button className="nav-dismiss" onClick={() => setDropdownOpen(false)} aria-label="Close account menu" />
                  <div className="nav-dropdown">
                    <div className="nav-dropdown-head">
                      <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
                      <p className="mt-1 break-all text-xs text-slate-500">{user?.email}</p>
                      <span className="mt-2 inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs capitalize text-indigo-700">{user?.role}</span>
                    </div>
                    <button className="nav-logout" onClick={handleLogout}><FiLogOut aria-hidden="true" /> Sign out</button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>

        <button
          className="nav-menu-button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <FiX /> : <FiMenu />}
        </button>
      </div>

      {mobileOpen && (
        <div className="nav-mobile-menu">
          {links.map((link) => (
            <Link key={link.to} to={link.to} className={`nav-link ${active(link.to) ? 'active' : ''}`} onClick={closeMobile}>
              {link.label}
            </Link>
          ))}
          <div className="nav-mobile-actions">
            {isAuthenticated ? (
              <button onClick={handleLogout} className="btn-secondary"><FiLogOut /> Sign out</button>
            ) : !authLoading ? (
              <Link to="/register" className="btn-secondary" onClick={closeMobile}>Create account</Link>
            ) : null}
          </div>
        </div>
      )}
    </header>
  );
}
