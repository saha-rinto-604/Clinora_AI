import { Link } from 'react-router';

export function ReportProcessingNotice({
  stage,
  queued,
  light = false,
}: {
  stage: 'extraction' | 'analysis';
  queued: boolean;
  light?: boolean;
}) {
  return (
    <div
      className={`mt-5 rounded-2xl border p-4 text-sm ${light ? 'border-blue-200 bg-blue-50 text-slate-700' : 'border-cyan-300/15 bg-cyan-300/[0.05] text-slate-300'}`}
    >
      <p className="font-semibold">
        {queued ? 'Waiting to start' : stage === 'extraction' ? 'Reading your report' : 'Preparing your insight'}
      </p>
      <p className="mt-2 leading-6">
        Processing continues in the background. Return to this report from AI Report Analysis to see the result.
      </p>
      <Link
        to="/patient/analyze"
        className={`mt-3 inline-flex rounded-lg border px-3 py-2 font-semibold ${light ? 'border-blue-300 text-blue-800 hover:bg-blue-100' : 'border-cyan-300/25 text-cyan-200 hover:bg-cyan-300/10'}`}
      >
        Continue using Clinora
      </Link>
    </div>
  );
}
