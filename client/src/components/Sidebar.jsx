import { Link, useLocation } from 'react-router-dom';
import {
  FiHome, FiAward, FiUsers, FiFileText, FiPlusCircle,
  FiXCircle, FiChevronLeft, FiChevronRight,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

const sidebarLinks = {
  admin: [
    { to: '/admin', label: 'Overview', icon: FiHome, exact: true },
    { to: '/admin/institutions', label: 'Institutions', icon: FiAward },
    { to: '/admin/users', label: 'Users', icon: FiUsers },
    { to: '/admin/certificates', label: 'Certificates', icon: FiFileText },
  ],
  university: [
    { to: '/university', label: 'Overview', icon: FiHome, exact: true },
    { to: '/university/issue', label: 'Issue credential', icon: FiPlusCircle },
    { to: '/university/certificates', label: 'Issued records', icon: FiFileText },
    { to: '/university/revocations', label: 'Revocations', icon: FiXCircle },
  ],
  student: [
    { to: '/student', label: 'Overview', icon: FiHome, exact: true },
    { to: '/student/certificates', label: 'My credentials', icon: FiFileText },
  ],
};

export default function Sidebar({ collapsed, setCollapsed }) {
  const { user } = useAuth();
  const location = useLocation();
  const links = sidebarLinks[user?.role] || [];
  const currentPath = location.pathname.replace(/\/+$/, '') || '/';
  const isActive = (link) => link.exact
    ? currentPath === link.to
    : currentPath === link.to || currentPath.startsWith(`${link.to}/`);

  return (
    <>
      <aside className={`dashboard-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
        <div className="sidebar-heading">
          {!collapsed && <><span className="mono-label">NAVIGATION</span><span className="signal-dot" /></>}
        </div>
        <nav className="sidebar-links" aria-label="Workspace navigation">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                title={collapsed ? link.label : undefined}
                aria-current={isActive(link) ? 'page' : undefined}
                className={`sidebar-link ${isActive(link) ? 'active' : ''}`}
              >
                <Icon aria-hidden="true" />
                {!collapsed && <span>{link.label}</span>}
                {!collapsed && isActive(link) && <i aria-hidden="true" />}
              </Link>
            );
          })}
        </nav>
        <button
          className="sidebar-collapse"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <FiChevronRight /> : <FiChevronLeft />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </aside>

      <nav className="mobile-dashboard-nav" aria-label="Workspace navigation">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.to} to={link.to} aria-current={isActive(link) ? 'page' : undefined} className={isActive(link) ? 'active' : ''}>
              <Icon aria-hidden="true" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
