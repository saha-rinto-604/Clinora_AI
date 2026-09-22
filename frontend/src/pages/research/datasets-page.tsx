import { useEffect, useState, type ReactElement } from 'react';
import { Link } from 'react-router';
import {
  BarChart2,
  Database,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  FlaskConical,
  LockKeyhole,
  FileText,
} from 'lucide-react';
import { researchApi } from '../../features/research/research-api';
import type { ResearchDataset, DatasetVersion } from '../../features/research/research-types';
import { cn } from '../../lib/cn';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function expiryLabel(expiresAt?: string): { text: string; urgent: boolean } {
  if (!expiresAt) return { text: 'No expiry', urgent: false };
  const diff = new Date(expiresAt).getTime() - Date.now();
  const days = Math.floor(diff / 86400000);
  if (days < 0) return { text: 'Expired', urgent: true };
  if (days === 0) return { text: 'Expires today', urgent: true };
  if (days <= 7) return { text: `Expires in ${days}d`, urgent: true };
  return { text: `Expires ${formatDate(expiresAt)}`, urgent: false };
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    REVOKED: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    EXPIRED: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  };
  const icons: Record<string, ReactElement> = {
    ACTIVE: <CheckCircle2 className="w-3 h-3" />,
    REVOKED: <XCircle className="w-3 h-3" />,
    EXPIRED: <AlertTriangle className="w-3 h-3" />,
  };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border', styles[status] ?? styles.EXPIRED)}>
      {icons[status]}
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dataset Card
// ─────────────────────────────────────────────────────────────────────────────

interface DatasetCardProps {
  dataset: ResearchDataset;
  latestVersion?: DatasetVersion;
}

function DatasetCard({ dataset, latestVersion }: DatasetCardProps) {
  const expiry = expiryLabel(dataset.expiresAt);

  return (
    <Link
      to={`/research/datasets/${dataset.id}`}
      id={`dataset-card-${dataset.id}`}
      className="group relative flex flex-col gap-4 p-5 rounded-xl border border-slate-800/80 bg-slate-900/60 hover:bg-slate-900/90 hover:border-cyan-500/30 hover:shadow-[0_0_24px_rgba(6,182,212,0.08)] transition-all duration-200"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Database className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-100 text-sm truncate leading-tight group-hover:text-cyan-300 transition-colors">
              {dataset.name}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">
              ID: {dataset.id.slice(0, 8)}…
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={dataset.status} />
          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-cyan-400 transition-colors" />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg bg-slate-800/50 border border-slate-700/40 p-2.5 text-center">
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Version</div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">
            {latestVersion ? `v${latestVersion.versionNumber}` : '—'}
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/50 border border-slate-700/40 p-2.5 text-center">
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Records</div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">
            {latestVersion ? latestVersion.recordCount.toLocaleString() : '—'}
          </div>
        </div>
        <div className="rounded-lg bg-slate-800/50 border border-slate-700/40 p-2.5 text-center">
          <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Format</div>
          <div className="text-sm font-bold text-cyan-300 mt-0.5">
            {latestVersion?.format ?? '—'}
          </div>
        </div>
        <div className={cn(
          'rounded-lg border p-2.5 text-center',
          expiry.urgent
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-slate-800/50 border-slate-700/40'
        )}>
          <div className={cn('text-[10px] font-medium uppercase tracking-wider', expiry.urgent ? 'text-amber-400' : 'text-slate-400')}>
            Access
          </div>
          <div className={cn('text-[11px] font-semibold mt-0.5', expiry.urgent ? 'text-amber-300' : 'text-slate-300')}>
            {expiry.text}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          Generated {formatDate(dataset.createdAt)}
        </div>
        <div className="flex items-center gap-1 text-cyan-400/70 group-hover:text-cyan-400 transition-colors font-medium">
          <BarChart2 className="w-3 h-3" />
          Analyze →
        </div>
      </div>

      {/* Privacy badge */}
      <div className="absolute top-3 right-12 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
          <ShieldCheck className="w-3 h-3" />
          De-identified
        </span>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
      <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
        <FlaskConical className="w-8 h-8 text-cyan-400" />
      </div>
      <div>
        <div className="text-lg font-semibold text-slate-200">No datasets yet</div>
        <div className="text-sm text-slate-400 mt-1 max-w-xs">
          Datasets are generated after an administrator approves your dataset request. Submit a dataset request from a project.
        </div>
      </div>
      <Link
        to="/research/projects"
        id="datasets-empty-go-projects"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-sm font-medium hover:bg-cyan-500/25 transition-colors"
      >
        <FileText className="w-4 h-4" />
        View my projects
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export function DatasetsPage() {
  const [datasets, setDatasets] = useState<ResearchDataset[]>([]);
  const [versions, setVersions] = useState<Record<string, DatasetVersion | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    researchApi
      .listMyDatasets()
      .then(async (ds) => {
        if (cancelled) return;
        setDatasets(ds);
        // Load latest version for each dataset
        const versionMap: Record<string, DatasetVersion | undefined> = {};
        await Promise.all(
          ds.map(async (d) => {
            try {
              const vs = await researchApi.listDatasetVersions(d.id);
              versionMap[d.id] = vs.length > 0 ? vs[0] : undefined;
            } catch {
              versionMap[d.id] = undefined;
            }
          })
        );
        if (!cancelled) setVersions(versionMap);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message ?? 'Failed to load datasets');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Database className="w-4 h-4 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">My Datasets</h1>
        </div>
        <p className="text-sm text-slate-400 ml-11">
          De-identified, privacy-preserving research datasets. No patient identifiers are ever included.
        </p>
      </div>

      {/* Governance Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-cyan-800/40 bg-cyan-950/30">
        <LockKeyhole className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
        <div className="text-sm text-cyan-200/80 leading-relaxed">
          All datasets below are governed exports. Direct identifiers have been removed, quasi-identifiers generalised,
          and project-scoped pseudonyms applied. Each dataset is immutable and cryptographically checksummed.
        </div>
      </div>

      {/* Summary Bar */}
      {!loading && !error && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Datasets', value: datasets.length },
            { label: 'Active', value: datasets.filter((d) => d.status === 'ACTIVE').length },
            { label: 'Total Records', value: Object.values(versions).reduce((sum, v) => sum + (v?.recordCount ?? 0), 0).toLocaleString() },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 text-center">
              <div className="text-2xl font-bold text-slate-100">{stat.value}</div>
              <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-xl bg-slate-800/40 border border-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="p-6 rounded-xl border border-rose-800/40 bg-rose-950/20 text-rose-300 text-sm">
          {error}
        </div>
      ) : datasets.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {datasets.map((dataset) => (
            <DatasetCard
              key={dataset.id}
              dataset={dataset}
              latestVersion={versions[dataset.id]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
