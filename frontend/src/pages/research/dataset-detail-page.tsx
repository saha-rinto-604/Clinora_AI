import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useParams, Link } from 'react-router';
import {
  BarChart2,
  Database,
  Download,
  ShieldCheck,
  Clock,
  Hash,
  CheckCircle2,
  TrendingUp,
  Users,
  ChevronLeft,
  AlertTriangle,
  FlaskConical,
  BarChart,
  LineChart as LineChartIcon,
  ArrowUp,
  ArrowDown,
  Minus,
  LoaderCircle,
  Copy,
  Check,
  FileSpreadsheet,
  X,
} from 'lucide-react';
import { apiErrorMessage } from '../../features/auth/auth-api';
import {
  BarChart as RechartsBarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { researchApi } from '../../features/research/research-api';
import type {
  ResearchDataset,
  DatasetVersion,
  DatasetStatsSummary,
  VariableSummary,
  TrendPoint,
  GroupComparisonRow,
} from '../../features/research/research-types';
import { cn } from '../../lib/cn';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n?: number, digits = 2) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function missingPct(v: VariableSummary) {
  const total = v.count + v.missingCount;
  if (total === 0) return '—';
  return ((v.missingCount / total) * 100).toFixed(1) + '%';
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab component
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'dictionary' | 'descriptive' | 'analytics';

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: ReactElement }[] = [
    { id: 'overview', label: 'Overview', icon: <Database className="w-4 h-4" /> },
    { id: 'dictionary', label: 'Data Dictionary', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: 'descriptive', label: 'Descriptive Stats', icon: <BarChart className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <LineChartIcon className="w-4 h-4" /> },
  ];
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-slate-900/80 border border-slate-800/80 w-fit">
      {tabs.map((t) => (
        <button
          key={t.id}
          id={`dataset-tab-${t.id}`}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
            active === t.id
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.1)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60',
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  unit,
  accent = false,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 text-center',
        accent ? 'bg-cyan-500/10 border-cyan-500/20' : 'bg-slate-800/50 border-slate-700/40',
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={cn('text-xl font-bold mt-1', accent ? 'text-cyan-300' : 'text-slate-100')}>{value}</div>
      {unit && <div className="text-[10px] text-slate-500 mt-0.5">{unit}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chart rule enforcement
// ─────────────────────────────────────────────────────────────────────────────

/** 1 point → text, 2 points → change text, 3+ → chart */
function DistributionChart({ variable }: { variable: VariableSummary }) {
  const bins = variable.distribution;

  if (bins.length === 0) {
    return <div className="text-slate-500 text-sm py-6 text-center">No distribution data available</div>;
  }

  if (bins.length === 1) {
    return (
      <div className="flex items-center justify-center py-8 gap-3 text-slate-300 text-sm">
        <FlaskConical className="w-4 h-4 text-cyan-400" />
        Single observed value:{' '}
        <span className="font-bold text-cyan-300">
          {fmt(bins[0].lowerBound)} {variable.unit}
        </span>
        <span className="text-slate-500">({bins[0].count} records)</span>
      </div>
    );
  }

  if (bins.length === 2) {
    return (
      <div className="flex items-center justify-center py-8 gap-4 text-sm">
        {bins.map((b) => (
          <div key={b.label} className="text-center p-4 rounded-lg bg-slate-800/60 border border-slate-700/40">
            <div className="text-[10px] text-slate-400 uppercase">{b.label}</div>
            <div className="text-lg font-bold text-slate-100 mt-1">{b.count} records</div>
          </div>
        ))}
      </div>
    );
  }

  // 3+ bins → render bar chart
  return (
    <ResponsiveContainer width="100%" height={200}>
      <RechartsBarChart data={bins} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#94a3b8' }}
          itemStyle={{ color: '#67e8f9' }}
          formatter={(v: unknown) => [typeof v === 'number' ? v.toLocaleString() : String(v ?? ''), 'Records']}
        />
        <Bar dataKey="count" fill="#0891b2" radius={[4, 4, 0, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}

function TrendChart({ points, variableCode, unit }: { points: TrendPoint[]; variableCode: string; unit?: string }) {
  if (points.length === 0) {
    return <div className="text-slate-500 text-sm py-6 text-center">No trend data available for this variable</div>;
  }

  if (points.length === 1) {
    return (
      <div className="flex items-center justify-center py-8 gap-3 text-sm">
        <div className="text-center p-5 rounded-xl bg-slate-800/60 border border-slate-700/40">
          <div className="text-xs text-slate-400">{points[0].period}</div>
          <div className="text-2xl font-bold text-cyan-300 mt-1">{fmt(points[0].mean)}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {unit ?? ''} · {points[0].count} records
          </div>
        </div>
      </div>
    );
  }

  if (points.length === 2) {
    const [a, b] = points;
    const diff = b.mean - a.mean;
    const Icon = diff > 0 ? ArrowUp : diff < 0 ? ArrowDown : Minus;
    const color = diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-slate-400';
    return (
      <div className="flex items-center justify-center py-8 gap-6 text-sm">
        {[a, b].map((p, i) => (
          <div key={p.period} className="text-center p-4 rounded-lg bg-slate-800/60 border border-slate-700/40">
            <div className="text-[10px] text-slate-400">{p.period}</div>
            <div className="text-xl font-bold text-slate-100 mt-1">{fmt(p.mean)}</div>
            <div className="text-[10px] text-slate-500">{p.count} records</div>
            {i === 1 && (
              <div className={cn('flex items-center justify-center gap-1 mt-2 text-xs font-semibold', color)}>
                <Icon className="w-3 h-3" />
                {diff > 0 ? '+' : ''}
                {fmt(diff)}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  // 3+ points → line chart
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 10 }} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#94a3b8' }}
          itemStyle={{ color: '#67e8f9' }}
          formatter={(v: unknown) => [
            fmt(typeof v === 'number' ? v : undefined),
            `Mean ${variableCode} ${unit ? `(${unit})` : ''}`,
          ]}
        />
        <Line
          type="linear"
          dataKey="mean"
          stroke="#0891b2"
          strokeWidth={2}
          dot={{ fill: '#0891b2', r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: '#67e8f9' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function GroupComparisonChart({
  rows,
  variableCode,
  unit,
}: {
  rows: GroupComparisonRow[];
  variableCode: string;
  unit?: string;
  groupBy?: 'SEX' | 'AGE_BAND';
}) {
  if (rows.length === 0) {
    return <div className="text-slate-500 text-sm py-6 text-center">No group data available</div>;
  }

  if (rows.length === 1) {
    const r = rows[0];
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center p-5 rounded-xl bg-slate-800/60 border border-slate-700/40">
          <div className="text-xs text-slate-400">{r.group}</div>
          <div className="text-2xl font-bold text-cyan-300 mt-1">{fmt(r.mean)}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            n={r.count} · σ={fmt(r.stdDev)}
          </div>
        </div>
      </div>
    );
  }

  if (rows.length === 2) {
    const [a, b] = rows;
    return (
      <div className="flex items-center justify-center py-8 gap-6 text-sm">
        {[a, b].map((r) => (
          <div key={r.group} className="text-center p-4 rounded-lg bg-slate-800/60 border border-slate-700/40">
            <div className="text-[10px] text-slate-400 uppercase">{r.group}</div>
            <div className="text-xl font-bold text-slate-100 mt-1">{fmt(r.mean)}</div>
            <div className="text-[10px] text-slate-500">
              n={r.count} · σ={fmt(r.stdDev)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 3+ groups → bar chart with mean value; reference lines for std dev omitted for clarity
  const grandMean = rows.reduce((s, r) => s + r.mean * r.count, 0) / rows.reduce((s, r) => s + r.count, 0);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <RechartsBarChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="group" tick={{ fill: '#94a3b8', fontSize: 10 }} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
        <Tooltip
          contentStyle={{ background: '#0f172a', border: '1px solid #1e3a5f', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#94a3b8' }}
          itemStyle={{ color: '#67e8f9' }}
          formatter={(v: unknown, name: unknown) => {
            const val = typeof v === 'number' ? v : undefined;
            const n = String(name ?? '');
            return [
              n === 'mean' ? `${fmt(val)} ${unit ?? ''}` : fmt(val),
              n === 'mean' ? `Mean ${variableCode}` : 'Std Dev',
            ];
          }}
        />
        <ReferenceLine
          y={grandMean}
          stroke="#334155"
          strokeDasharray="4 2"
          label={{ value: 'Overall', fill: '#475569', fontSize: 10 }}
        />
        <Bar dataKey="mean" fill="#0891b2" radius={[4, 4, 0, 0]} />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────

function OverviewTab({
  dataset,
  versions,
  stats,
  onRequestDownload,
  downloading,
  downloadError,
  onCopyChecksum,
  copiedChecksum,
}: {
  dataset: ResearchDataset;
  versions: DatasetVersion[];
  stats: DatasetStatsSummary | null;
  onRequestDownload: (v: DatasetVersion) => void;
  downloading?: boolean;
  downloadError?: string | null;
  onCopyChecksum: (checksum: string) => void;
  copiedChecksum: boolean;
}) {
  const latest = versions[0];

  return (
    <div className="space-y-6">
      {/* Metadata card */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 space-y-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dataset Metadata</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <MetaRow label="Status" value={dataset.status} highlight={dataset.status === 'ACTIVE'} />
          <MetaRow label="Version" value={latest ? `v${latest.versionNumber}` : '—'} />
          <MetaRow label="Format" value={latest?.format ?? '—'} />
          <MetaRow label="Records" value={latest ? latest.recordCount.toLocaleString() : '—'} />
          <MetaRow label="Generated" value={formatDate(latest?.generatedAt)} />
          <MetaRow
            label="Expires"
            value={formatDate(dataset.expiresAt) === '—' ? 'No expiry' : formatDate(dataset.expiresAt)}
          />
        </div>

        {latest && (
          <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between gap-3">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="text-[11px] text-slate-500 font-medium">Cryptographic SHA-256 Checksum</div>
              <div className="font-mono text-[11px] text-slate-300 bg-slate-800/60 rounded-lg p-2 break-all select-all">
                {latest.checksum}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onCopyChecksum(latest.checksum)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 flex items-center gap-1.5 text-xs transition-colors self-end"
              title="Copy SHA-256 Checksum"
            >
              {copiedChecksum ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedChecksum ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Variables */}
      {stats && stats.variables.length > 0 && (
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Variables ({stats.variables.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.variables.map((v) => (
              <span
                key={v.variableCode}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 border border-indigo-500/20 text-indigo-300"
              >
                <FlaskConical className="w-3 h-3" />
                {v.variableCode}
                {v.unit && <span className="text-indigo-400/60">({v.unit})</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missingness table */}
      {stats && stats.variables.length > 0 && (
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 overflow-hidden">
          <div className="p-4 border-b border-slate-800/60">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Missingness Summary</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800/40">
                  <th className="text-left p-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Variable
                  </th>
                  <th className="text-right p-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Count
                  </th>
                  <th className="text-right p-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Missing
                  </th>
                  <th className="text-right p-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Missing %
                  </th>
                </tr>
              </thead>
              <tbody>
                {stats.variables.map((v) => (
                  <tr key={v.variableCode} className="border-b border-slate-800/20 hover:bg-slate-800/20">
                    <td className="p-3 font-mono text-xs text-slate-300">{v.variableCode}</td>
                    <td className="p-3 text-right text-slate-200">{v.count.toLocaleString()}</td>
                    <td className="p-3 text-right text-slate-400">{v.missingCount.toLocaleString()}</td>
                    <td
                      className={cn(
                        'p-3 text-right text-xs font-medium',
                        parseFloat(missingPct(v)) > 20 ? 'text-amber-400' : 'text-slate-400',
                      )}
                    >
                      {missingPct(v)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* De-identification governance */}
      <div className="rounded-xl border border-emerald-800/30 bg-emerald-950/20 p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <div className="text-sm font-semibold text-emerald-300">De-identification Guarantees</div>
        </div>
        <ul className="space-y-1.5 text-xs text-emerald-200/70">
          {[
            'Direct identifiers removed (name, email, phone, address, national ID)',
            'Exact birth dates generalised to 5-year age bands (Clinora research age generalization / 85+ top-coding)',
            'Observation dates generalised to Year-Quarter (e.g. 2026-Q1)',
            'Project-scoped HMAC-SHA256 pseudonyms — unlinkable across projects',
            'Minimum cohort size protection enforced (≥ 10 distinct subjects required; small-cell suppression active)',
            'Fail-closed patient consent enforcement (only active consented records included)',
            'Immutable version with SHA-256 checksum stored in private bucket',
          ].map((g) => (
            <li key={g} className="flex items-start gap-2">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
              {g}
            </li>
          ))}
        </ul>
      </div>

      {/* Download */}
      {latest && (
        <div className="flex flex-col items-end gap-2">
          {downloadError && <div className="text-xs text-rose-400 font-medium">{downloadError}</div>}
          <button
            id="dataset-download-btn"
            type="button"
            disabled={downloading}
            onClick={() => onRequestDownload(latest)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-sm font-semibold hover:bg-cyan-500/25 transition-colors disabled:opacity-50"
          >
            {downloading ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {downloading ? 'Downloading...' : `Download v${latest.versionNumber} (${latest.format})`}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Data Dictionary Tab
// ─────────────────────────────────────────────────────────────────────────────

const VARIABLE_DICTIONARY: Record<string, { description: string; type: string; safeHarborProfile: string }> = {
  AGE_BAND: {
    description: 'Patient age generalized to 5-year intervals with top-coding at 85+',
    type: 'Categorical (Banded)',
    safeHarborProfile: 'HIPAA 5-Year Age Interval & 85+ Cap',
  },
  SEX: {
    description: 'Biological sex of patient recorded at specimen collection',
    type: 'Categorical',
    safeHarborProfile: 'Retained as general demographic attribute',
  },
  OBSERVATION_PERIOD: {
    description: 'Quarter and year when specimen was collected',
    type: 'Temporal (Quarter)',
    safeHarborProfile: 'Year-Quarter generalization (no exact dates)',
  },
  HBA1C: {
    description: 'Glycated hemoglobin percentage reflecting 2-3 month glycemic control',
    type: 'Continuous (Numeric %)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
  FASTING_GLUCOSE: {
    description: 'Blood plasma glucose level obtained after minimum 8-hour fast',
    type: 'Continuous (Numeric mg/dL)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
  RANDOM_GLUCOSE: {
    description: 'Random blood glucose level drawn without fasting requirement',
    type: 'Continuous (Numeric mg/dL)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
  HEMOGLOBIN: {
    description: 'Total hemoglobin concentration in whole blood',
    type: 'Continuous (Numeric g/dL)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
  WBC: {
    description: 'Total white blood cell count (leukocytes)',
    type: 'Continuous (Numeric 10^9/L)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
  PLATELETS: {
    description: 'Thrombocyte count indicating clotting capacity',
    type: 'Continuous (Numeric 10^9/L)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
  RBC: {
    description: 'Total red blood cell count (erythrocytes)',
    type: 'Continuous (Numeric 10^12/L)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
  CREATININE: {
    description: 'Serum creatinine level representing kidney filtration',
    type: 'Continuous (Numeric mg/dL)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
  EGFR: {
    description: 'Estimated glomerular filtration rate based on CKD-EPI formula',
    type: 'Continuous (Numeric mL/min/1.73m²)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
  BUN: {
    description: 'Blood urea nitrogen reflecting protein metabolic byproduct',
    type: 'Continuous (Numeric mg/dL)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
  URIC_ACID: {
    description: 'Serum uric acid level indicating purine metabolism',
    type: 'Continuous (Numeric mg/dL)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
  ALT: {
    description: 'Alanine aminotransferase (SGPT) enzyme marker for hepatic injury',
    type: 'Continuous (Numeric U/L)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
  AST: {
    description: 'Aspartate aminotransferase (SGOT) enzyme marker for tissue/liver injury',
    type: 'Continuous (Numeric U/L)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
  BILIRUBIN_TOTAL: {
    description: 'Total bilirubin concentration reflecting hepatic clearance and hemolysis',
    type: 'Continuous (Numeric mg/dL)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
  CHOLESTEROL_TOTAL: {
    description: 'Serum total cholesterol concentration',
    type: 'Continuous (Numeric mg/dL)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
  HDL: {
    description: 'High-density lipoprotein cholesterol (anti-atherogenic fraction)',
    type: 'Continuous (Numeric mg/dL)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
  LDL: {
    description: 'Low-density lipoprotein cholesterol (atherogenic fraction)',
    type: 'Continuous (Numeric mg/dL)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
  TRIGLYCERIDES: {
    description: 'Serum triacylglycerol lipid concentration',
    type: 'Continuous (Numeric mg/dL)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
  TSH: {
    description: 'Thyroid stimulating hormone regulating endocrine function',
    type: 'Continuous (Numeric mIU/L)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
  FREE_T4: {
    description: 'Unbound thyroxine fraction indicating thyroid hormone activity',
    type: 'Continuous (Numeric ng/dL)',
    safeHarborProfile: 'Clinical observation retained with verified units',
  },
};

function DataDictionaryTab({ stats, loading }: { stats: DatasetStatsSummary | null; loading: boolean }) {
  if (loading) {
    return <div className="h-48 bg-slate-800/40 rounded-xl animate-pulse" />;
  }

  if (!stats || stats.variables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-500 text-sm">
        <FileSpreadsheet className="w-8 h-8" />
        Data dictionary will be populated once dataset variables are generated.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 space-y-2">
        <div className="flex items-center gap-2 text-cyan-300 font-semibold text-sm">
          <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
          <span>Research Data Dictionary &amp; Clinical Schema Standards</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Standardized variable definitions, measurement units, data types, and Safe Harbor de-identification rules for
          reproducible scientific analysis and external validation.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/60">
                <th className="text-left p-3.5 font-semibold text-slate-300 uppercase tracking-wider">Variable Code</th>
                <th className="text-left p-3.5 font-semibold text-slate-300 uppercase tracking-wider">
                  Clinical Description
                </th>
                <th className="text-left p-3.5 font-semibold text-slate-300 uppercase tracking-wider">Type</th>
                <th className="text-left p-3.5 font-semibold text-slate-300 uppercase tracking-wider">Unit</th>
                <th className="text-right p-3.5 font-semibold text-slate-300 uppercase tracking-wider">
                  Observed Range
                </th>
                <th className="text-right p-3.5 font-semibold text-slate-300 uppercase tracking-wider">Missingness</th>
                <th className="text-left p-3.5 font-semibold text-slate-300 uppercase tracking-wider">
                  De-identification Profile
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {stats.variables.map((v) => {
                const meta = VARIABLE_DICTIONARY[v.variableCode] ?? {
                  description: 'Observation extracted from physician verified clinical laboratory report',
                  type: 'Continuous (Numeric)',
                  safeHarborProfile: 'Standard HIPAA Safe Harbor general profile',
                };
                return (
                  <tr key={v.variableCode} className="hover:bg-slate-800/20 transition-colors">
                    <td className="p-3.5 font-mono text-cyan-300 font-semibold">{v.variableCode}</td>
                    <td className="p-3.5 text-slate-300 max-w-xs">{meta.description}</td>
                    <td className="p-3.5 text-slate-400">{meta.type}</td>
                    <td className="p-3.5 text-slate-300 font-mono">{v.unit || '—'}</td>
                    <td className="p-3.5 text-right text-slate-300 font-mono">
                      {fmt(v.min)} – {fmt(v.max)}
                    </td>
                    <td
                      className={cn(
                        'p-3.5 text-right font-mono font-medium',
                        parseFloat(missingPct(v)) > 20 ? 'text-amber-400' : 'text-slate-400',
                      )}
                    >
                      {missingPct(v)}
                    </td>
                    <td className="p-3.5 text-emerald-400/90 text-[11px] font-medium flex items-center gap-1.5 mt-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                      {meta.safeHarborProfile}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={cn('text-sm font-semibold mt-0.5', highlight ? 'text-emerald-300' : 'text-slate-200')}>
        {value}
      </div>
    </div>
  );
}

function DescriptiveStatsTab({ stats }: { stats: DatasetStatsSummary | null; loading: boolean }) {
  const [selectedVar, setSelectedVar] = useState<string>('');

  const variable = stats?.variables.find((v) => v.variableCode === selectedVar) ?? stats?.variables[0];

  useEffect(() => {
    if (stats && stats.variables.length > 0 && !selectedVar) {
      setSelectedVar(stats.variables[0].variableCode);
    }
  }, [stats, selectedVar]);

  if (!stats || stats.variables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-500 text-sm">
        <BarChart2 className="w-8 h-8" />
        No statistics available yet. Statistics are computed after dataset generation.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Variable selector */}
      <div className="flex items-center gap-3">
        <label htmlFor="var-select" className="text-sm text-slate-400 whitespace-nowrap">
          Variable:
        </label>
        <select
          id="var-select"
          value={selectedVar}
          onChange={(e) => setSelectedVar(e.target.value)}
          className="flex-1 max-w-xs rounded-lg border border-slate-700 bg-slate-800/80 text-slate-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
        >
          {stats.variables.map((v) => (
            <option key={v.variableCode} value={v.variableCode}>
              {v.variableCode} {v.unit ? `(${v.unit})` : ''}
            </option>
          ))}
        </select>
      </div>

      {variable && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Count" value={variable.count.toLocaleString()} />
            <StatCard
              label="Missing"
              value={variable.missingCount.toLocaleString()}
              unit={missingPct(variable)}
              accent={variable.missingCount > 0}
            />
            <StatCard label="Mean" value={fmt(variable.mean)} unit={variable.unit} accent />
            <StatCard label="Median" value={fmt(variable.median)} unit={variable.unit} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Min" value={fmt(variable.min)} unit={variable.unit} />
            <StatCard label="Max" value={fmt(variable.max)} unit={variable.unit} />
            <StatCard label="Std Dev" value={fmt(variable.stdDev)} unit={variable.unit} />
            <StatCard label="Range" value={fmt(variable.max - variable.min)} unit={variable.unit} />
          </div>

          {/* Distribution */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4 text-cyan-400" />
              <div className="text-sm font-semibold text-slate-200">
                Distribution — {variable.variableCode}
                {variable.distribution.length < 3 && (
                  <span className="ml-2 text-xs text-slate-500 font-normal">
                    ({variable.distribution.length} data point{variable.distribution.length !== 1 ? 's' : ''})
                  </span>
                )}
              </div>
            </div>
            <DistributionChart variable={variable} />
          </div>
        </>
      )}
    </div>
  );
}

function AnalyticsTab({
  dataset,
  stats,
  latestVersion,
}: {
  dataset: ResearchDataset;
  stats: DatasetStatsSummary | null;
  latestVersion?: DatasetVersion;
}) {
  const [trendVar, setTrendVar] = useState('');
  const [compareVar, setCompareVar] = useState('');
  const [groupBy, setGroupBy] = useState<'SEX' | 'AGE_BAND'>('SEX');
  const [trendPoints, setTrendPoints] = useState<TrendPoint[]>([]);
  const [compareRows, setCompareRows] = useState<GroupComparisonRow[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);

  const variables: VariableSummary[] = useMemo(() => stats?.variables ?? [], [stats?.variables]);
  const vn = latestVersion?.versionNumber ?? 1;

  useEffect(() => {
    if (variables.length > 0 && !trendVar) setTrendVar(variables[0].variableCode);
    if (variables.length > 0 && !compareVar) setCompareVar(variables[0].variableCode);
  }, [variables, trendVar, compareVar]);

  const loadTrend = useCallback(async () => {
    if (!trendVar || !latestVersion) return;
    setTrendLoading(true);
    setTrendError(null);
    try {
      const pts = await researchApi.getVariableTrend(dataset.id, vn, trendVar);
      setTrendPoints(pts);
    } catch {
      setTrendError('Failed to load trend data');
    } finally {
      setTrendLoading(false);
    }
  }, [dataset.id, vn, trendVar, latestVersion]);

  const loadComparison = useCallback(async () => {
    if (!compareVar || !latestVersion) return;
    setCompareLoading(true);
    setCompareError(null);
    try {
      const rows = await researchApi.getGroupComparison(dataset.id, vn, compareVar, groupBy);
      setCompareRows(rows);
    } catch {
      setCompareError('Failed to load comparison data');
    } finally {
      setCompareLoading(false);
    }
  }, [dataset.id, vn, compareVar, groupBy, latestVersion]);

  useEffect(() => {
    loadTrend();
  }, [loadTrend]);
  useEffect(() => {
    loadComparison();
  }, [loadComparison]);

  const trendVariable = variables.find((v) => v.variableCode === trendVar);
  const compareVariable = variables.find((v) => v.variableCode === compareVar);

  if (!stats || variables.length === 0 || !latestVersion) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-500 text-sm">
        <TrendingUp className="w-8 h-8" />
        Analytics require a generated dataset with at least one variable.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Time Trend */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <div className="text-sm font-semibold text-slate-200">Time Trend</div>
          <span className="text-[10px] text-slate-500 ml-auto">Only exact observation periods — no interpolation</span>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 whitespace-nowrap">Variable:</label>
          <select
            id="trend-var-select"
            value={trendVar}
            onChange={(e) => setTrendVar(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800/80 text-slate-100 text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          >
            {variables.map((v) => (
              <option key={v.variableCode} value={v.variableCode}>
                {v.variableCode} {v.unit ? `(${v.unit})` : ''}
              </option>
            ))}
          </select>
        </div>
        {trendLoading ? (
          <div className="h-36 bg-slate-800/40 rounded-lg animate-pulse" />
        ) : trendError ? (
          <div className="text-rose-400 text-sm">{trendError}</div>
        ) : (
          <TrendChart points={trendPoints} variableCode={trendVar} unit={trendVariable?.unit} />
        )}
        {trendPoints.length >= 3 && (
          <div className="text-[11px] text-slate-500 text-right">
            {trendPoints.length} real observation period{trendPoints.length !== 1 ? 's' : ''}· X axis values are actual
            data periods
          </div>
        )}
      </div>

      {/* Group Comparison */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" />
          <div className="text-sm font-semibold text-slate-200">Group Comparison</div>
          <span className="text-[10px] text-slate-500 ml-auto">Aggregate means only — no individual rows</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-slate-400 whitespace-nowrap">Variable:</label>
          <select
            id="compare-var-select"
            value={compareVar}
            onChange={(e) => setCompareVar(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-800/80 text-slate-100 text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
          >
            {variables.map((v) => (
              <option key={v.variableCode} value={v.variableCode}>
                {v.variableCode} {v.unit ? `(${v.unit})` : ''}
              </option>
            ))}
          </select>
          <label className="text-xs text-slate-400 whitespace-nowrap">Group by:</label>
          <div className="flex gap-1">
            {(['SEX', 'AGE_BAND'] as const).map((g) => (
              <button
                key={g}
                id={`groupby-${g}`}
                type="button"
                onClick={() => setGroupBy(g)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
                  groupBy === g
                    ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200',
                )}
              >
                {g === 'SEX' ? 'Sex' : 'Age Band'}
              </button>
            ))}
          </div>
        </div>
        {compareLoading ? (
          <div className="h-36 bg-slate-800/40 rounded-lg animate-pulse" />
        ) : compareError ? (
          <div className="text-rose-400 text-sm">{compareError}</div>
        ) : (
          <GroupComparisonChart
            rows={compareRows}
            variableCode={compareVar}
            unit={compareVariable?.unit}
            groupBy={groupBy}
          />
        )}
        {compareRows.length >= 3 && (
          <div className="text-[11px] text-slate-500 text-right">
            {compareRows.length} groups · dashed line = overall mean
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export function DatasetDetailPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [dataset, setDataset] = useState<ResearchDataset | null>(null);
  const [versions, setVersions] = useState<DatasetVersion[]>([]);
  const [stats, setStats] = useState<DatasetStatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!datasetId) return;
    setLoading(true);
    Promise.all([researchApi.getDataset(datasetId), researchApi.listDatasetVersions(datasetId)])
      .then(([ds, vs]) => {
        setDataset(ds);
        setVersions(vs);
      })
      .catch((err) => {
        setError(err?.response?.data?.message ?? 'Failed to load dataset');
      })
      .finally(() => setLoading(false));
  }, [datasetId]);

  // DUA and Checksum State
  const [duaModalOpen, setDuaModalOpen] = useState(false);
  const [pendingDownloadVersion, setPendingDownloadVersion] = useState<DatasetVersion | null>(null);
  const [duaAgreed, setDuaAgreed] = useState(false);
  const [copiedChecksum, setCopiedChecksum] = useState(false);

  // Load stats when tab changes to descriptive, analytics, or dictionary
  useEffect(() => {
    if (!datasetId || !versions[0]) return;
    if (activeTab !== 'descriptive' && activeTab !== 'analytics' && activeTab !== 'dictionary') return;
    if (stats) return; // already loaded
    setStatsLoading(true);
    researchApi
      .getDatasetStats(datasetId, versions[0].versionNumber)
      .then(setStats)
      .catch(() => {
        /* stats optional — fail silently */
      })
      .finally(() => setStatsLoading(false));
  }, [activeTab, datasetId, versions, stats]);

  const handleCopyChecksum = (checksum: string) => {
    navigator.clipboard.writeText(checksum);
    setCopiedChecksum(true);
    setTimeout(() => setCopiedChecksum(false), 2000);
  };

  const handleRequestDownload = (version: DatasetVersion) => {
    setPendingDownloadVersion(version);
    setDuaAgreed(false);
    setDuaModalOpen(true);
  };

  const handleDownload = async (version: DatasetVersion) => {
    if (!datasetId) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const response = await researchApi.downloadDatasetVersion(datasetId, version.versionNumber);
      const blob = new Blob([response.data], {
        type: version.format === 'JSON' ? 'application/json' : 'text/csv;charset=utf-8;',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.setAttribute(
        'download',
        `dataset-${(dataset?.name ?? 'data').replace(/[^a-zA-Z0-9_-]/g, '_')}-v${version.versionNumber}.${version.format?.toLowerCase() ?? 'csv'}`,
      );
      document.body.appendChild(a);
      a.click();
      window.setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 200);
    } catch (err: unknown) {
      setDownloadError(apiErrorMessage(err, 'Failed to download dataset.'));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-slate-800/60 rounded-lg animate-pulse" />
        <div className="h-48 bg-slate-800/40 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="p-6 rounded-xl border border-rose-800/40 bg-rose-950/20">
        <div className="flex items-center gap-2 text-rose-300 mb-2">
          <AlertTriangle className="w-4 h-4" />
          <span className="font-semibold text-sm">Failed to load dataset</span>
        </div>
        <p className="text-rose-300/70 text-sm">{error ?? 'Dataset not found or access denied.'}</p>
        <Link
          to="/research/datasets"
          className="inline-flex items-center gap-1.5 mt-4 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to datasets
        </Link>
      </div>
    );
  }

  const latestVersion = versions[0];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link to="/research/datasets" className="hover:text-slate-200 transition-colors flex items-center gap-1">
          <Database className="w-3.5 h-3.5" />
          My Datasets
        </Link>
        <ChevronLeft className="w-3 h-3 rotate-180" />
        <span className="text-slate-200 font-medium truncate max-w-xs">{dataset.name}</span>
      </div>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">{dataset.name}</h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                {latestVersion && (
                  <>
                    <span className="flex items-center gap-1">
                      <Hash className="w-3 h-3" />v{latestVersion.versionNumber}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(latestVersion.generatedAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <BarChart2 className="w-3 h-3" />
                      {latestVersion.recordCount.toLocaleString()} records
                    </span>
                  </>
                )}
                <span className="flex items-center gap-1 text-emerald-400">
                  <ShieldCheck className="w-3 h-3" />
                  De-identified
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === 'overview' && (
        <OverviewTab
          dataset={dataset}
          versions={versions}
          stats={statsLoading ? null : stats}
          onRequestDownload={handleRequestDownload}
          downloading={downloading}
          downloadError={downloadError}
          onCopyChecksum={handleCopyChecksum}
          copiedChecksum={copiedChecksum}
        />
      )}
      {activeTab === 'dictionary' && <DataDictionaryTab stats={stats} loading={statsLoading} />}
      {activeTab === 'descriptive' &&
        (statsLoading ? (
          <div className="h-48 bg-slate-800/40 rounded-xl animate-pulse" />
        ) : (
          <DescriptiveStatsTab stats={stats} loading={statsLoading} />
        ))}
      {activeTab === 'analytics' &&
        (statsLoading ? (
          <div className="h-48 bg-slate-800/40 rounded-xl animate-pulse" />
        ) : (
          <AnalyticsTab dataset={dataset} stats={stats} latestVersion={latestVersion} />
        ))}

      {/* Controlled Data Use Agreement (DUA) Modal */}
      {duaModalOpen && pendingDownloadVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Clinora Data Governance Agreement (DUA)
                </div>
                <h3 className="text-base font-bold text-white">Mandatory Research Data Use Terms</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDuaModalOpen(false);
                  setPendingDownloadVersion(null);
                  setDuaAgreed(false);
                }}
                className="text-slate-400 hover:text-slate-200 text-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl border border-amber-800/60 bg-amber-950/20 text-xs text-amber-200/90 space-y-1">
              <div className="font-semibold text-amber-300">Regulatory Compliance (HIPAA / GDPR Safe Harbor):</div>
              <p className="text-[11px] leading-relaxed">
                You are accessing version{' '}
                <strong className="text-white">v{pendingDownloadVersion.versionNumber}</strong> of de-identified
                research dataset <strong className="text-white">{dataset.name}</strong>.
              </p>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300">
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-100">1. Strict Prohibition on Re-identification:</strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    I agree never to use any algorithm, pseudonym correlation, or external reference to attempt to
                    identify any patient, subject, or clinician.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-100">2. Prohibition on External Dataset Linkage:</strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    I agree not to merge or link this dataset with any external identifiable registry, voter file, or
                    commercial demographic database.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-100">3. Secure Encrypted Custody:</strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    The data will be stored exclusively in password-protected or encrypted environments, and never
                    redistributed to unauthorized parties.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80">
                <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-100">4. Citation &amp; Dissemination Attribution:</strong>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    I agree to cite the Clinora Research Dataset ID and version checksum in any peer-reviewed paper or
                    scientific presentation.
                  </p>
                </div>
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-cyan-800/60 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={duaAgreed}
                onChange={(e) => setDuaAgreed(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-xs text-slate-200">
                I have read, understood, and solemnly agree to comply with the{' '}
                <strong className="text-cyan-300">Clinora Data Use Agreement (DUA)</strong> for this download.
              </span>
            </label>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  setDuaModalOpen(false);
                  setPendingDownloadVersion(null);
                  setDuaAgreed(false);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!duaAgreed || downloading}
                onClick={async () => {
                  const targetVersion = pendingDownloadVersion;
                  setDuaModalOpen(false);
                  if (targetVersion) {
                    await handleDownload(targetVersion);
                  }
                  setPendingDownloadVersion(null);
                  setDuaAgreed(false);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors disabled:opacity-50"
              >
                {downloading ? (
                  <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>Accept &amp; Download</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
