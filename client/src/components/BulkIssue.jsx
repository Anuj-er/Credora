import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCheckCircle, FiDownload, FiFileText, FiUpload, FiXCircle } from 'react-icons/fi';
import certificateService from '../services/certificateService';
import LoadingSpinner from './LoadingSpinner';

const MAX_ROWS = 100;
const HEADERS = [
  'studentName', 'studentEmail', 'studentId', 'courseName', 'grade',
  'certificateTitle', 'issueDate', 'validUntil', 'teacherName', 'teacherTitle', 'criteria',
];
const REQUIRED = ['studentName', 'studentEmail', 'courseName'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TEMPLATE = [
  HEADERS.join(','),
  [
    'Aarav Demo', 'demo-student@example.com', 'DEMO-2026-001',
    'Bachelor of Computer Science (Fictional Demo)', '8.7 CGPA',
    'Certificate of Achievement', '2026-11-03', '',
    'Dr. A. Sharma', 'Faculty advisor',
    'Completed the programme with distinction',
  ].map((value) => (/,|"/.test(value) ? `"${value.replace(/"/g, '""')}"` : value)).join(','),
].join('\n');

// Minimal CSV parser: handles quoted fields, commas inside quotes and
// doubled quotes. Returns an array of rows, each an array of fields.
const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); field = '';
      if (row.some((cell) => cell.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== '')) rows.push(row);
  }
  return rows;
};

const localToday = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};

const validateRow = (row) => {
  const errors = [];
  if (!row.studentName) errors.push('Student name is required.');
  if (!row.studentEmail) errors.push('Student email is required.');
  else if (!EMAIL_RE.test(row.studentEmail)) errors.push('Student email is not valid.');
  if (!row.courseName) errors.push('Credential / qualification is required.');
  if (row.issueDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.issueDate)) errors.push('Issue date must be YYYY-MM-DD.');
  else if (row.issueDate && row.issueDate > localToday()) errors.push('Issue date cannot be in the future.');
  if (row.validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(row.validUntil)) errors.push('Valid until must be YYYY-MM-DD.');
  else if (row.validUntil && row.issueDate && row.validUntil < row.issueDate) errors.push('Valid until cannot be before the issue date.');
  if (row.criteria && row.criteria.length > 300) errors.push('Achievement criteria must be 300 characters or fewer.');
  return errors;
};

export default function BulkIssue() {
  const fileInput = useRef(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [fileError, setFileError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null);

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'credora-bulk-template.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  };

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    setResults(null);
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setFileError('Choose a .csv file.');
      setRows([]);
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCsv(String(reader.result || ''));
        if (parsed.length === 0) {
          setFileError('The file is empty.');
          setRows([]);
          return;
        }
        const header = parsed[0].map((cell) => cell.trim());
        const missing = REQUIRED.filter((column) => !header.includes(column));
        if (missing.length > 0) {
          setFileError(`Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Download the template for the correct headers.`);
          setRows([]);
          return;
        }
        const dataRows = parsed.slice(1).map((cells) => {
          const row = {};
          HEADERS.forEach((column) => {
            const index = header.indexOf(column);
            row[column] = index >= 0 ? (cells[index] || '').trim() : '';
          });
          if (!row.certificateTitle) row.certificateTitle = 'Certificate of Achievement';
          if (!row.issueDate) row.issueDate = localToday();
          return row;
        });
        if (dataRows.length > MAX_ROWS) {
          setFileError(`This file has ${dataRows.length} rows. Bulk issue accepts at most ${MAX_ROWS} rows per file — split it into smaller files.`);
          setRows([]);
          return;
        }
        setFileError('');
        setFileName(file.name);
        setRows(dataRows.map((row) => ({ ...row, errors: validateRow(row) })));
      } catch (_error) {
        setFileError('This file could not be read as a CSV. Check the format and try again.');
        setRows([]);
      }
    };
    reader.onerror = () => {
      setFileError('This file could not be read. Please choose another file.');
      setRows([]);
    };
    reader.readAsText(file);
  };

  const validRows = rows.filter((row) => row.errors.length === 0);
  const invalidCount = rows.length - validRows.length;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (validRows.length === 0) return toast.error('There are no valid rows to issue.');
    setSubmitting(true);
    setResults(null);
    try {
      const payload = validRows.map(({ errors: _errors, ...row }) => row);
      const response = await certificateService.bulkIssue(payload);
      const summary = response.summary || {
        total: payload.length,
        issued: (response.results || []).filter((r) => r.status === 'issued').length,
        failed: (response.results || []).filter((r) => r.status !== 'issued').length,
      };
      setResults({ summary, results: response.results || [] });
      if (summary.issued > 0) toast.success(`Issued ${summary.issued} credential${summary.issued === 1 ? '' : 's'}.`);
      if (summary.failed > 0) toast.error(`${summary.failed} row${summary.failed === 1 ? '' : 's'} could not be issued — see the errors below.`);
      setRows([]);
      setFileName('');
      if (fileInput.current) fileInput.current.value = '';
    } catch (error) {
      toast.error(error.response?.data?.message || 'Bulk issue failed. Check the file and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="issue-guidance">
        Upload a CSV to issue many credentials at once. Every row is checked before anything is issued — rows with errors are skipped and listed, so one bad row never blocks the rest.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={downloadTemplate} className="btn-secondary min-h-9 px-3 py-2 text-xs">
          <FiDownload aria-hidden="true" /> Download CSV template
        </button>
        <input
          ref={fileInput}
          id="bulk-csv-file"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="sr-only"
        />
        <label htmlFor="bulk-csv-file" className="btn-primary min-h-9 cursor-pointer px-3 py-2 text-xs">
          <FiUpload aria-hidden="true" /> {fileName ? 'Choose a different file' : 'Choose CSV file'}
        </label>
        {fileName && <span className="text-sm text-slate-400">{fileName} · {rows.length} row{rows.length === 1 ? '' : 's'} · max {MAX_ROWS}</span>}
      </div>
      {fileError && <p role="alert" className="text-sm text-rose-400">{fileError}</p>}

      {rows.length > 0 && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <p className="text-sm text-slate-400">
            {validRows.length} valid · {invalidCount} with errors. Only the valid rows will be issued.
          </p>
          <div className="table-scroll-region">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">#</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Student</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Credential</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Issue date</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.studentEmail}-${index}`} className="border-b border-slate-50">
                    <td className="py-3 px-4 text-slate-500">{index + 1}</td>
                    <td className="py-3 px-4">{row.studentName || '—'}</td>
                    <td className="py-3 px-4 break-all">{row.studentEmail || '—'}</td>
                    <td className="py-3 px-4">{row.courseName || '—'}</td>
                    <td className="py-3 px-4 text-slate-500">{row.issueDate || '—'}</td>
                    <td className="py-3 px-4">
                      {row.errors.length === 0
                        ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><FiCheckCircle aria-hidden="true" /> Ready</span>
                        : (
                          <span className="inline-flex items-start gap-1 text-xs text-rose-400">
                            <FiXCircle className="mt-0.5 shrink-0" aria-hidden="true" />
                            <span>{row.errors.join(' ')}</span>
                          </span>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="submit" disabled={submitting || validRows.length === 0} className="btn-primary w-full flex items-center justify-center gap-2">
            {submitting ? <LoadingSpinner text="Issuing credentials…" /> : <><FiFileText aria-hidden="true" /> Issue {validRows.length} valid credential{validRows.length === 1 ? '' : 's'}</>}
          </button>
        </form>
      )}

      {results && (
        <section className="card" aria-live="polite">
          <h3 className="text-lg font-semibold text-slate-900">Bulk issue results</h3>
          <p className="mt-1 text-sm text-slate-500">
            Issued {results.summary.issued} of {results.summary.total} · Failed {results.summary.failed}
          </p>
          {results.results.filter((r) => r.status !== 'issued').length > 0 && (
            <div className="table-scroll-region mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Row</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Student</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((result, index) => result.status === 'issued' ? null : (
                    <tr key={`${result.row?.studentEmail || index}-${index}`} className="border-b border-slate-50">
                      <td className="py-3 px-4 text-slate-500">{index + 1}</td>
                      <td className="py-3 px-4">{result.row?.studentName || result.row?.studentEmail || '—'}</td>
                      <td className="py-3 px-4 text-rose-400">{result.error || 'Could not be issued.'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {results.summary.failed === 0 && (
            <p className="mt-3 text-sm text-emerald-400">All rows issued. Proof confirmation runs in the background — check Issued records for the latest status.</p>
          )}
        </section>
      )}
    </div>
  );
}
