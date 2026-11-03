import { useState } from 'react';
import Sidebar from './Sidebar';

export default function DashboardLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="dashboard-frame">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className={`dashboard-main ${collapsed ? 'dashboard-main-collapsed' : ''}`}>
        <div className="dashboard-content">
          {children}
        </div>
      </div>
    </div>
  );
}
