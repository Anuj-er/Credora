import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiLock } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { getRoleHome } from '../utils/roleHome';

export default function Unauthorized() {
  const { user } = useAuth();

  const dashboardPath = getRoleHome(user?.role);

  return (
    <div className="not-found-shell">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="not-found-card"
      >
        <p className="not-found-code">ACCESS / RESTRICTED</p>
        <div className="w-14 h-14 bg-rose-100 border border-rose-200 flex items-center justify-center mt-5 mb-6">
          <FiLock className="w-6 h-6 text-rose-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-3">Access Denied</h2>
        <p className="text-slate-500 mb-8 max-w-md mx-auto">
          You don&apos;t have permission to access this page. Please contact your administrator if you believe this is an error.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to={dashboardPath} className="btn-primary">
            Go to Dashboard
          </Link>
          <Link to="/" className="btn-secondary">
            Go Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
