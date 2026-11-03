import { FiInbox } from 'react-icons/fi';

export default function EmptyState({ icon: Icon = FiInbox, title, description, actionLabel, onAction }) {
  return (
    <div className="empty-state flex flex-col items-center justify-center py-16 px-4">
      <div className="w-14 h-14 bg-slate-100 flex items-center justify-center mb-4 border border-slate-200 rounded-lg">
        <Icon className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 text-center max-w-sm mb-4">{description}</p>
      )}
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn-primary">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
