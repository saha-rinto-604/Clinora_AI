import {
  AlertCircle,
  History,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { apiErrorMessage } from '../../features/auth/auth-api';
import { researchApi } from '../../features/research/research-api';
import type { ResearchAuditLogEntry } from '../../features/research/research-types';

interface ProjectAuditTrailSectionProps {
  projectId: string;
}

export function ProjectAuditTrailSection({ projectId }: ProjectAuditTrailSectionProps) {
  const [events, setEvents] = useState<ResearchAuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAuditTrail = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError('');
    try {
      const data = await researchApi.getProjectAuditTrail(projectId);
      setEvents(data);
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Failed to load project audit trail.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadAuditTrail();
  }, [loadAuditTrail]);

  const getActionBadge = (action: string) => {
    let color = 'bg-slate-800 text-slate-300 border-slate-700';
    if (action.includes('APPROVED')) {
      color = 'bg-emerald-950 text-emerald-300 border-emerald-800';
    } else if (action.includes('REJECTED') || action.includes('FAILED')) {
      color = 'bg-rose-950 text-rose-300 border-rose-800';
    } else if (action.includes('COLLABORATOR')) {
      color = 'bg-cyan-950 text-cyan-300 border-cyan-800';
    } else if (action.includes('EVALUATION')) {
      color = 'bg-indigo-950 text-indigo-300 border-indigo-800';
    } else if (action.includes('DATASET')) {
      color = 'bg-purple-950 text-purple-300 border-purple-800';
    }

    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border ${color}`}>
        {action}
      </span>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/60">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-purple-400" />
            <h2 className="text-base font-semibold text-slate-100">
              Research Security Audit Trail
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Auditable, scrubbed operational log tracking protocol reviews, collaborator changes, data exports, and AI benchmarks.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={loadAuditTrail}
          className="text-xs py-1 px-3 h-auto border border-slate-700 hover:border-slate-600 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Log
        </Button>
      </div>

      {/* Security Privacy Notice */}
      <div className="p-3.5 rounded-xl border border-purple-900/60 bg-purple-950/20 text-xs text-purple-200/90 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-semibold text-purple-300">Research Security Audit Policy:</span>{' '}
          All audit records are automatically sanitized. Raw patient clinical data, identifiers, credentials, and dataset payloads are strictly excluded from audit storage to maintain research data isolation.
        </div>
      </div>

      {/* Events Timeline */}
      {loading ? (
        <div className="py-8 flex items-center justify-center text-slate-400 text-xs gap-2">
          <LoaderCircle className="w-4 h-4 animate-spin text-purple-400" />
          <span>Loading audit history...</span>
        </div>
      ) : error ? (
        <div className="p-3 rounded-lg bg-red-950/30 border border-red-800 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : events.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-xs">
          No audit entries recorded for this project yet.
        </div>
      ) : (
        <div className="relative border-l border-slate-800 ml-3 space-y-6 py-2">
          {events.map((event) => (
            <div key={event.id} className="relative pl-6">
              {/* Dot */}
              <div className="absolute -left-1.5 top-1 w-3 h-3 rounded-full bg-slate-900 border-2 border-purple-500" />

              <div className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-950/60 space-y-1.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getActionBadge(event.action)}
                    <span
                      className={`text-[10px] font-semibold uppercase ${
                        event.outcome === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {event.outcome}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(event.occurredAt).toLocaleString()}
                  </span>
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-2 font-mono">
                  <span>Actor UUID: {event.actorUserId || 'SYSTEM'}</span>
                </div>

                {event.metadata && event.metadata !== '{}' && (
                  <div className="pt-1 text-[11px] text-slate-400 font-mono bg-slate-900/80 p-2 rounded border border-slate-800/60 overflow-x-auto">
                    {event.metadata}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
