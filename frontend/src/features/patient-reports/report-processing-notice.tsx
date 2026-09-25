import { useEffect, useState } from 'react';
import { Link } from 'react-router';

export function ReportProcessingNotice({
  requestedAt,
  stage,
  queued,
  light = false,
}: {
  requestedAt: string | null;
  stage: 'extraction' | 'analysis';
  queued: boolean;
  light?: boolean;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const requested = requestedAt ? Date.parse(requestedAt) : NaN;
  const elapsed = Number.isFinite(requested) ? Math.max(0, Math.floor((now - requested) / 1000)) : null;
  const duration = elapsed === null ? null : `${Math.floor(elapsed / 60)}m ${String(elapsed % 60).padStart(2, '0')}s`;

  return (
    <div className={`mt-5 rounded-2xl border p-4 text-sm ${light ? 'border-blue-200 bg-blue-50 text-slate-700' : 'border-cyan-300/15 bg-cyan-300/[0.05] text-slate-300'}`}>
      <p className="font-semibold">
        {queued ? 'Waiting to start' : stage === 'extraction' ? 'Reading your report' : 'Preparing your insight'}
        {duration ? <span className="ml-2 font-normal tabular-nums" aria-live="off">Elapsed {duration}</span> : null}
      </p>
      <p className="mt-2 leading-6">
        {elapsed !== null && elapsed >= 60
          ? 'This is still running. You can continue using Clinora while it finishes.'
          : 'You can leave this page. Processing continues in the background.'}
        {' '}Return to this report from AI Report Analysis to see the result.
      </p>
      <Link to="/patient/analyze" className={`mt-3 inline-flex rounded-lg border px-3 py-2 font-semibold ${light ? 'border-blue-300 text-blue-800 hover:bg-blue-100' : 'border-cyan-300/25 text-cyan-200 hover:bg-cyan-300/10'}`}>
        Continue using Clinora
      </Link>
    </div>
  );
}
