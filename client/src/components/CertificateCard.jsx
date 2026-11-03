import { FiShield, FiCheckCircle, FiXCircle, FiEye, FiDownload } from 'react-icons/fi';

const statusMap = {
  active: { cls: 'badge-active', icon: FiCheckCircle },
  revoked: { cls: 'badge-revoked', icon: FiXCircle },
  pending: { cls: 'badge-pending', icon: null },
};

export default function CertificateCard({ certificate, onView, onDownload, onShare }) {
  const cert = certificate;
  const status = statusMap[(cert.status || '').toLowerCase()] || { cls: 'badge-pending', icon: null };
  const StatusIcon = status.icon;

  return (
    <div className="card hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-slate-900">{cert.courseName || 'Certificate'}</h4>
          <p className="text-sm text-slate-500">{cert.institutionName || '-'}</p>
        </div>
        <span className={status.cls}>
          {StatusIcon && <StatusIcon className="w-3 h-3" />}
          {cert.status}
        </span>
      </div>

      <div className="space-y-1.5 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-slate-500">Certificate ID</span>
          <span className="font-mono text-xs text-slate-700">{cert.certificateId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Issue Date</span>
          <span className="text-slate-700">
            {cert.issueDate ? new Date(cert.issueDate).toLocaleDateString() : '-'}
          </span>
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t border-slate-100">
        {onView && (
          <button
            onClick={() => onView(cert)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <FiEye className="w-4 h-4" /> View
          </button>
        )}
        {onDownload && (
          <button
            onClick={() => onDownload(cert)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <FiDownload className="w-4 h-4" /> Download
          </button>
        )}
      </div>
    </div>
  );
}
