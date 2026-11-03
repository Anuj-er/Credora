import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiArrowLeft } from 'react-icons/fi';

export default function NotFound() {
  return (
    <div className="not-found-shell">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="not-found-card"
      >
        <p className="not-found-code">ROUTE / 404</p>
        <h1 className="mt-4 text-7xl font-semibold text-slate-900 leading-none select-none">404</h1>
        <h2 className="mt-3 text-2xl font-bold text-slate-900 mb-3">Page not found</h2>
        <p className="text-slate-500 mb-8 max-w-md">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link to="/" className="btn-primary inline-flex items-center gap-2">
          <FiArrowLeft className="w-4 h-4" /> Go Home
        </Link>
      </motion.div>
    </div>
  );
}
