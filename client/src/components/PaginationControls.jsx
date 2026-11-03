import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export default function PaginationControls({ page, pagination, onPageChange }) {
  const pages = Number(pagination?.pages || 0);
  const total = Number(pagination?.total || 0);
  const limit = Number(pagination?.limit || 10);
  if (pages <= 1 || total <= 0) return null;

  const firstItem = (page - 1) * limit + 1;
  const lastItem = Math.min(page * limit, total);

  return (
    <nav className="pagination-controls" aria-label="Credential list pages">
      <p>Showing {firstItem}-{lastItem} of {total}</p>
      <div>
        <button type="button" className="btn-secondary min-h-9 px-3 py-2 text-xs" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <FiChevronLeft aria-hidden="true" /> Previous
        </button>
        <span aria-live="polite">Page {page} of {pages}</span>
        <button type="button" className="btn-secondary min-h-9 px-3 py-2 text-xs" onClick={() => onPageChange(page + 1)} disabled={page >= pages} aria-label="Next page">
          Next <FiChevronRight aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
