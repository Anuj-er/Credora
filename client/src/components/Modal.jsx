import { useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX } from 'react-icons/fi';

export default function Modal({ isOpen, onClose, title, children }) {
  const titleId = useId();
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 modal-backdrop"
            onClick={onClose}
          />

          {/* Modal content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.3 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative modal-panel w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden z-10"
          >
            {/* Header */}
            <div className="modal-head flex items-center justify-between px-6 py-4">
              <h3 id={titleId} className="text-lg font-semibold text-slate-900">{title}</h3>
              <button
                onClick={onClose}
                aria-label="Close dialog"
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
