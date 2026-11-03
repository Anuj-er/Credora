export default function LoadingSpinner({ text }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      {text && <p className="text-sm text-slate-500">{text}</p>}
    </div>
  );
}
