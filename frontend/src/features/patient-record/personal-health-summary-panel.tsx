import {
  Activity, ArrowRight, CalendarRange, ChevronDown, Download, ExternalLink, FileCheck2,
  HeartPulse, HelpCircle, RefreshCcw, ShieldCheck, Sparkles, Stethoscope,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, StatusPill } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/feedback';
import {
  longitudinalHealthApi,
  longitudinalHealthError,
  type HealthRangeStatus,
  type HealthSummaryPeriodPreset,
  type HealthSummaryProviderStatus,
  type PersonalHealthSummary,
  type SummaryBriefingItem,
  type SummaryEvidence,
} from './longitudinal-health-api';

const PERIOD_OPTIONS: Array<{ value: HealthSummaryPeriodPreset; label: string }> = [
  { value: 'LAST_3_MONTHS', label: 'Last 3 months' },
  { value: 'LAST_6_MONTHS', label: 'Last 6 months' },
  { value: 'LAST_12_MONTHS', label: 'Last 12 months' },
  { value: 'ALL_HISTORY', label: 'All reliably dated history' },
  { value: 'CUSTOM', label: 'Custom range' },
];

export function PersonalHealthSummaryPanel() {
  const [period, setPeriod] = useState<HealthSummaryPeriodPreset>('LAST_12_MONTHS');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [summary, setSummary] = useState<PersonalHealthSummary | null>(null);
  const [provider, setProvider] = useState<HealthSummaryProviderStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState('');
  const customInvalid = period === 'CUSTOM' && (!customFrom || !customTo || customFrom > customTo);
  const selectionChanged = useMemo(() => Boolean(summary && (
    summary.period.preset !== period || (period === 'CUSTOM' && (summary.period.from !== customFrom || summary.period.to !== customTo))
  )), [customFrom, customTo, period, summary]);

  useEffect(() => { void longitudinalHealthApi.providerStatus().then(setProvider).catch(() => setProvider(null)); }, []);

  function request(forceRefresh = false) {
    return {
      period,
      ...(period === 'CUSTOM' ? { from: customFrom, to: customTo } : {}),
      ...(forceRefresh ? { forceRefresh: true } : {}),
    };
  }

  async function generate() {
    if (customInvalid) return;
    setLoading(true);
    setError('');
    try { setSummary(await longitudinalHealthApi.generateSummary(request(summary !== null))); }
    catch (caught) { setError(longitudinalHealthError(caught, 'We could not generate your Personal Health Summary.')); }
    finally { setLoading(false); }
  }

  async function downloadPdf() {
    if (!summary || selectionChanged || customInvalid) return;
    setPdfLoading(true);
    setError('');
    try {
      const blob = await longitudinalHealthApi.downloadSummaryPdf(request());
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'clinora-personal-health-summary.pdf';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (caught) { setError(longitudinalHealthError(caught, 'We could not export the Personal Health Summary PDF.')); }
    finally { setPdfLoading(false); }
  }

  return (
    <div className="space-y-6">
      <AppSurface as="section" variant="hero">
        <AppSectionHeader
          eyebrow="Your verified record, explained"
          title="Personal Health Summary"
          copy="A concise health briefing that brings verified findings together, separates current facts from real change, and keeps every interpretation traceable to Clinora evidence."
          action={summary ? (
            <Button variant="appSecondary" disabled={pdfLoading || selectionChanged} onClick={() => void downloadPdf()}>
              {pdfLoading ? <RefreshCcw size={15} className="animate-spin" aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}
              Export PDF
            </Button>
          ) : null}
        />

        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(220px,.8fr)_minmax(0,1.2fr)_auto] md:items-end">
          <label className="block">
            <span className="text-xs font-semibold text-[var(--clinora-text-muted)]">Change window</span>
            <select value={period} onChange={(event) => setPeriod(event.target.value as HealthSummaryPeriodPreset)}
              className="mt-2 min-h-11 w-full rounded-[var(--radius-app-compact)] border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-3 text-sm text-white outline-none transition focus:border-[var(--clinora-border-interactive)]">
              {PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          {period === 'CUSTOM' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <DateInput label="From" value={customFrom} onChange={setCustomFrom} />
              <DateInput label="To" value={customTo} onChange={setCustomTo} />
            </div>
          ) : (
            <div className="flex min-h-11 items-center gap-2 rounded-[var(--radius-app-compact)] border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-4 text-sm text-[var(--clinora-text-muted)]">
              <CalendarRange size={16} className="text-[var(--clinora-info-foreground)]" aria-hidden="true" />
              Current verified facts remain visible; this window applies only to dated change evidence.
            </div>
          )}
          <Button variant="appPrimary" disabled={loading || customInvalid} onClick={() => void generate()}>
            {loading ? <RefreshCcw size={15} className="animate-spin" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />}
            {summary ? 'Refresh summary' : 'Generate summary'}
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[var(--clinora-text-faint)]">
          <span>{provider?.configured ? `Clinora AI · ${providerModelLabel(provider.model)}` : 'Clinora AI explanation is not configured'}</span>
          <span aria-hidden="true">•</span><span>Gemini explains verified facts; it does not calculate medical findings.</span>
        </div>
        {customInvalid ? <p className="mt-3 text-xs text-[var(--clinora-warning-foreground)]">Choose a valid start and end date.</p> : null}
        {selectionChanged ? <p className="mt-3 text-xs text-[var(--clinora-warning-foreground)]">The change window has changed. Refresh before exporting.</p> : null}
        {error ? <p role="alert" className="mt-4 text-sm text-[var(--clinora-danger-foreground)]">{error}</p> : null}
      </AppSurface>

      {loading && !summary ? <SummarySkeleton /> : null}
      {!loading && !summary ? (
        <AppSurface as="section" variant="standard"><EmptyState icon={<HeartPulse size={18} aria-hidden="true" />}
          title="Create your health briefing" copy="Clinora will use eligible verified findings already in your Health Record. Reports without a clinical date can inform the current picture, but never a trend." /></AppSurface>
      ) : null}
      {summary ? <SummaryDocument summary={summary} refreshing={loading} /> : null}
    </div>
  );
}

function SummaryDocument({ summary, refreshing }: { summary: PersonalHealthSummary; refreshing: boolean }) {
  const evidence = useMemo(() => new Map(summary.evidence.map((item) => [item.evidenceId, item])), [summary.evidence]);
  return (
    <AppSurface as="article" variant="standard" aria-label="Generated Personal Health Summary" className={refreshing ? 'opacity-70' : ''}>
      <header className="border-b border-[var(--clinora-border-subtle)] pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--clinora-info-foreground)]">Clinora health briefing</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">Your verified health picture</h2>
            <p className="mt-2 text-sm text-[var(--clinora-text-muted)]">{periodLabel(summary)} · Refreshed {formatDateTime(summary.generatedAt)}</p></div>
          <AiStatus summary={summary} />
        </div>
      </header>

      <SummarySnapshot summary={summary} />
      <BriefingSection id="health-picture" eyebrow="Overview" title="Your Health Picture" icon={<Sparkles size={18} aria-hidden="true" />} featured>
        <p className="max-w-4xl text-[15px] leading-7 text-[var(--clinora-text-muted)]">{summary.healthPicture}</p>
        {summary.aiSummary.status !== 'AVAILABLE' ? <p className="mt-3 text-xs leading-5 text-[var(--clinora-text-faint)]">{aiUnavailableMessage(summary.aiSummary.reason, summary.aiSummary.status)} The evidence-backed briefing below remains available.</p> : null}
      </BriefingSection>

      <BriefingSection id="stands-out" eyebrow="Priority view" title="What Stands Out" icon={<Activity size={18} aria-hidden="true" />}>
        {summary.keyThemes.length ? <div className="grid gap-4 lg:grid-cols-2">{summary.keyThemes.map((theme) => (
          <div key={theme.id} className="rounded-[var(--radius-app-card)] border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-5">
            <h4 className="text-base font-semibold text-white">{theme.title}</h4>
            <p className="mt-2 text-sm leading-6 text-[var(--clinora-text-muted)]">{theme.description}</p>
            <EvidenceDisclosure ids={theme.evidenceIds} evidence={evidence} />
          </div>
        ))}</div> : <SectionEmpty>There are not enough eligible verified findings to form health themes yet.</SectionEmpty>}
      </BriefingSection>

      <BriefingSection id="changed" eyebrow="Reliable chronology only" title="What Changed" icon={<ArrowRight size={18} aria-hidden="true" />}>
        {summary.changes.length ? <div className="grid gap-3 sm:grid-cols-2">{summary.changes.map((change) => (
          <div key={change.id} className="rounded-[var(--radius-app-compact)] border border-[var(--clinora-border-subtle)] p-4">
            <p className="text-sm font-semibold text-white">{change.title}</p>
            <div className="mt-3 flex items-center gap-3 text-sm font-semibold tabular-nums text-white"><span>{change.fromValue}</span><ArrowRight size={15} aria-hidden="true" /><span>{change.toValue}</span></div>
            <p className="mt-1 text-xs text-[var(--clinora-text-faint)]">{formatDate(change.fromDate)} to {formatDate(change.toDate)}</p>
            <p className="mt-3 text-xs leading-5 text-[var(--clinora-text-muted)]">{change.description}</p>
            <EvidenceDisclosure ids={change.evidenceIds} evidence={evidence} />
          </div>
        ))}</div> : <SectionEmpty>There is not enough safely comparable, reliably dated history to show a qualifying change. Undated findings are never used here.</SectionEmpty>}
      </BriefingSection>

      <BriefingSection id="stable" eyebrow="Balanced context" title="What Looks Stable" icon={<ShieldCheck size={18} aria-hidden="true" />}>
        <InsightList items={summary.stableContext} evidence={evidence} empty="No stable or in-range context qualifies yet." />
      </BriefingSection>
      <BriefingSection id="follow-up" eyebrow="Grounded discussion points" title="What May Deserve Follow-up" icon={<Stethoscope size={18} aria-hidden="true" />}>
        <InsightList items={summary.followUpItems} evidence={evidence} empty="No current verified finding is outside a supplied range." />
      </BriefingSection>
      <BriefingSection id="questions" eyebrow="Prepare for care" title="Questions for Your Next Visit" icon={<HelpCircle size={18} aria-hidden="true" />}>
        <InsightList items={summary.visitQuestions} evidence={evidence} numbered empty="More verified information is needed to create personalized questions." />
      </BriefingSection>

      <BriefingSection id="limitations" eyebrow="Knowledge boundary" title="What Clinora Cannot Determine Yet" icon={<FileCheck2 size={18} aria-hidden="true" />}>
        {summary.limitations.length ? <div className="space-y-3">{summary.limitations.map((item) => (
          <div key={item.title} className="border-l-2 border-[var(--clinora-warning-foreground)]/60 pl-4">
            <p className="text-sm font-semibold text-white">{item.title}</p><p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">{item.description}</p>
          </div>
        ))}</div> : <SectionEmpty>No additional data limitations were identified for this briefing.</SectionEmpty>}
      </BriefingSection>

      <div className="mt-8 flex flex-col gap-4 border-t border-[var(--clinora-border-subtle)] pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl text-xs leading-5 text-[var(--clinora-text-muted)]">{summary.disclaimer}</p>
        <Link to="/patient/health-record" className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-[var(--clinora-info-foreground)]">View Full Health Record <ExternalLink size={14} aria-hidden="true" /></Link>
      </div>
    </AppSurface>
  );
}

function SummarySnapshot({ summary }: { summary: PersonalHealthSummary }) {
  const metrics = [
    ['Verified reports available', summary.snapshot.verifiedReportsAvailable],
    ['Reliably dated reports', summary.snapshot.reliablyDatedReports],
    ['Date-uncertain verified reports', summary.snapshot.dateUncertainVerifiedReports],
    ['Tracked verified measurements', summary.snapshot.trackedVerifiedMeasurements],
    ['Health areas represented', summary.snapshot.healthAreasRepresented],
    ['Measurements with comparable history', summary.snapshot.measurementsWithComparableHistory],
  ] as const;
  return <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6" aria-label="Summary evidence snapshot">
    {metrics.map(([label, value]) => <div key={label} className="rounded-[var(--radius-app-compact)] bg-[var(--clinora-surface-nested)] px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--clinora-text-faint)]">{label}</p><p className="mt-2 text-xl font-semibold text-white">{value}</p></div>)}
  </section>;
}

function BriefingSection({ id, eyebrow, title, icon, featured = false, children }: { id: string; eyebrow: string; title: string; icon: ReactNode; featured?: boolean; children: ReactNode }) {
  return <section className={`mt-8 ${featured ? 'rounded-[var(--radius-app-card)] border border-[var(--clinora-border-interactive)] bg-[var(--clinora-surface-hero)] p-5 sm:p-6' : ''}`} aria-labelledby={id}>
    <div className="mb-4 flex items-start gap-3"><span className="mt-0.5 text-[var(--clinora-info-foreground)]">{icon}</span><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--clinora-text-faint)]">{eyebrow}</p><h3 id={id} className="mt-1 text-xl font-semibold text-white">{title}</h3></div></div>{children}
  </section>;
}

function InsightList({ items, evidence, empty, numbered = false }: { items: SummaryBriefingItem[]; evidence: Map<string, SummaryEvidence>; empty: string; numbered?: boolean }) {
  if (!items.length) return <SectionEmpty>{empty}</SectionEmpty>;
  return <div className="divide-y divide-[var(--clinora-border-subtle)] border-y border-[var(--clinora-border-subtle)]">{items.map((item, index) => (
    <div key={item.id} className="py-4"><div className="flex gap-3">{numbered ? <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--clinora-surface-nested)] text-xs font-semibold text-[var(--clinora-info-foreground)]">{index + 1}</span> : null}<p className="text-sm leading-6 text-[var(--clinora-text-muted)]">{item.text}</p></div><EvidenceDisclosure ids={item.evidenceIds} evidence={evidence} /></div>
  ))}</div>;
}

function EvidenceDisclosure({ ids, evidence }: { ids: string[]; evidence: Map<string, SummaryEvidence> }) {
  const items = ids.map((id) => evidence.get(id)).filter((item): item is SummaryEvidence => Boolean(item));
  if (!items.length) return null;
  return <details className="group mt-3"><summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-[var(--clinora-info-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"><ChevronDown size={14} className="transition group-open:rotate-180" aria-hidden="true" />View evidence</summary>
    <div className="mt-3 space-y-2">{items.map((item) => <div key={item.evidenceId} className="rounded-[var(--radius-app-compact)] border border-[var(--clinora-border-subtle)] bg-black/10 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-white">{item.measurementName}</p><div className="flex items-center gap-2"><span className="text-xs font-semibold tabular-nums text-white">{item.displayValue}</span><RangePill status={item.status} /></div></div>
      <p className="mt-1 text-[11px] leading-5 text-[var(--clinora-text-faint)]">{item.suppliedRange ? `Supplied range ${item.suppliedRange} · ` : ''}{item.dateReliable && item.clinicalDate ? formatDate(item.clinicalDate) : `Clinical date unavailable${item.displayDate ? ` · uploaded ${formatDate(item.displayDate)}` : ''} (not used for chronology)`} · {verificationLabel(item.verificationStatus)} · {item.sourceReportName}</p>
      {item.sourceReportId ? <Link to={`/patient/reports/${item.sourceReportId}`} className="mt-1 inline-flex text-[11px] font-semibold text-[var(--clinora-info-foreground)]">Open source report</Link> : null}
    </div>)}</div>
  </details>;
}

function AiStatus({ summary }: { summary: PersonalHealthSummary }) {
  const available = summary.aiSummary.status === 'AVAILABLE';
  const insufficient = summary.aiSummary.status === 'INSUFFICIENT_DATA';
  return <div className="sm:text-right"><StatusPill tone={available ? 'success' : insufficient ? 'neutral' : 'warning'}>{available ? 'AI explanation generated' : insufficient ? 'More verified data needed' : 'AI explanation unavailable'}</StatusPill>{summary.aiSummary.cached ? <p className="mt-2 text-[11px] text-[var(--clinora-text-faint)]">Reused for unchanged verified facts</p> : null}</div>;
}

function RangePill({ status }: { status: HealthRangeStatus }) {
  const tone = status === 'IN_RANGE' ? 'success' : status === 'LOW' || status === 'HIGH' ? 'warning' : 'neutral';
  return <StatusPill tone={tone} className="min-h-6 px-2 py-0.5 text-[10px]">{status === 'IN_RANGE' ? 'In range' : status === 'LOW' ? 'Low' : status === 'HIGH' ? 'High' : 'Reported'}</StatusPill>;
}

function SectionEmpty({ children }: { children: ReactNode }) { return <p className="text-sm leading-6 text-[var(--clinora-text-muted)]">{children}</p>; }
function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-xs font-semibold text-[var(--clinora-text-muted)]">{label}</span><input type="date" value={value} max={todayIso()} onChange={(event) => onChange(event.target.value)} className="mt-2 min-h-11 w-full rounded-[var(--radius-app-compact)] border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] px-3 text-sm text-white outline-none focus:border-[var(--clinora-border-interactive)]" /></label>;
}
function SummarySkeleton() { return <AppSurface as="section" variant="standard" aria-label="Generating summary"><Skeleton className="h-8 w-72" /><Skeleton className="mt-5 h-28 w-full" /><div className="mt-5 grid gap-4 md:grid-cols-2"><Skeleton className="h-44" /><Skeleton className="h-44" /></div></AppSurface>; }
function periodLabel(summary: PersonalHealthSummary) { return summary.period.from && summary.period.to ? `${summary.period.label}: ${formatDate(summary.period.from)} – ${formatDate(summary.period.to)}` : summary.period.label; }
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)); }
function todayIso() { return new Date().toISOString().slice(0, 10); }
function providerModelLabel(model: string) { return model === 'gemini-2.5-flash' ? 'Gemini 2.5 Flash' : model; }
function verificationLabel(value: string) { return value === 'DOCTOR_VERIFIED' ? 'Doctor verified' : value === 'PATIENT_CORRECTED' ? 'Patient corrected' : value === 'PATIENT_CONFIRMED' ? 'Patient confirmed' : 'Verified'; }
function aiUnavailableMessage(reason: string | null, status: string) {
  if (status === 'INSUFFICIENT_DATA') return 'There is not enough eligible verified health information yet for an AI explanation.';
  if (reason === 'AUTH_FAILED') return 'The AI provider did not accept the configured credentials.';
  if (reason === 'PERMISSION_DENIED') return 'The configured project does not currently permit this AI explanation.';
  if (reason === 'RATE_LIMITED') return 'The AI provider is currently rate limited.';
  if (reason === 'SAFETY_BLOCKED') return 'The AI provider did not return an explanation under its safety controls.';
  if (reason === 'INVALID_RESPONSE' || reason === 'EMPTY_RESPONSE') return 'The AI provider returned a response Clinora could not validate safely.';
  if (reason === 'NOT_CONFIGURED') return 'Clinora AI is not configured in this environment.';
  return 'The AI explanation could not be generated right now.';
}
