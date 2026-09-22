import { CalendarClock, CheckCircle2, FlaskConical, Pill, Stethoscope } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AppSectionHeader, AppSurface, EmptyState, IconWell } from '../app/app-ui';
import { buttonVariants } from '../ui/button-variants';
import {
  consultationApi,
  consultationError,
  type PatientConsultationSummary as Summary,
} from '../../features/consultations/consultation-api';

export function PatientConsultationSummary({ appointmentId }: { appointmentId: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    consultationApi
      .patientSummary(appointmentId)
      .then((value) => {
        if (active) setSummary(value);
      })
      .catch((requestError) => {
        if (active) setError(consultationError(requestError, 'Your consultation summary could not be loaded.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appointmentId]);

  if (loading || (!summary && !error)) return null;

  if (error) {
    return (
      <AppSurface variant="attention" className="mt-6">
        <p role="alert" className="text-sm text-amber-100">
          {error}
        </p>
      </AppSurface>
    );
  }

  if (!summary) return null;

  return (
    <AppSurface as="section" variant="elevated" className="mt-6" aria-labelledby="consultation-summary-title">
      <div className="flex items-start gap-3">
        <IconWell tone="success">
          <CheckCircle2 size={17} />
        </IconWell>
        <div className="min-w-0 flex-1">
          <AppSectionHeader
            eyebrow="Doctor completed"
            title="Consultation & care plan"
            titleId="consultation-summary-title"
            copy={`Completed ${formatDate(summary.completedAt)}. These are Doctor-authored instructions from this consultation.`}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SummaryBlock title="Doctor assessment" value={summary.assessment || 'No assessment text was added.'} />
        <SummaryBlock title="Plan" value={summary.plan || 'No additional plan text was added.'} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Pill size={15} /> Prescription
          </h3>
          {summary.prescriptions.length ? (
            <ul className="mt-3 space-y-3">
              {summary.prescriptions.map((item) => (
                <li
                  key={item.id}
                  className="border-t border-[var(--clinora-border-subtle)] pt-3 first:border-0 first:pt-0"
                >
                  <strong className="block text-sm text-white">{item.medicationName}</strong>
                  <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">
                    {[item.strength, item.dose, item.route, item.frequency, item.duration]
                      .filter(Boolean)
                      .join(' · ') || 'Follow the Doctor instructions below.'}
                  </p>
                  {item.instructions ? <p className="mt-1 text-xs text-slate-300">{item.instructions}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-[var(--clinora-text-faint)]">
              No medication was prescribed in this consultation.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <FlaskConical size={15} /> Requested investigations
          </h3>
          {summary.investigations.length ? (
            <ul className="mt-3 space-y-3">
              {summary.investigations.map((item) => (
                <li
                  key={item.id}
                  className="border-t border-[var(--clinora-border-subtle)] pt-3 first:border-0 first:pt-0"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm text-white">{item.testName}</strong>
                    <span
                      className={
                        item.priority === 'URGENT'
                          ? 'text-xs font-semibold text-amber-200'
                          : 'text-xs text-[var(--clinora-text-faint)]'
                      }
                    >
                      {item.priority === 'URGENT' ? 'Urgent' : 'Routine'}
                    </span>
                  </div>
                  {item.reason ? (
                    <p className="mt-1 text-xs leading-5 text-[var(--clinora-text-muted)]">{item.reason}</p>
                  ) : null}
                  {item.instructions ? <p className="mt-1 text-xs text-slate-300">{item.instructions}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-[var(--clinora-text-faint)]">No investigation was requested.</p>
          )}
        </section>
      </div>

      {summary.followUp ? (
        <section className="mt-5 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.045] p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <IconWell tone="info">
                <CalendarClock size={15} />
              </IconWell>
              <div>
                <h3 className="text-sm font-semibold text-white">Follow-up recommended</h3>
                <p className="mt-1 text-sm text-cyan-100">{formatDate(summary.followUp.recommendedDate)}</p>
                {summary.followUp.reason ? (
                  <p className="mt-1 text-xs text-[var(--clinora-text-muted)]">{summary.followUp.reason}</p>
                ) : null}
                {summary.followUp.instructions ? (
                  <p className="mt-1 text-xs text-slate-300">{summary.followUp.instructions}</p>
                ) : null}
              </div>
            </div>
            <Link to={`/patient/doctors/${summary.doctorId}`} className={buttonVariants({ variant: 'appPrimary' })}>
              <Stethoscope size={15} /> Book follow-up
            </Link>
          </div>
        </section>
      ) : null}

      {!summary.prescriptions.length && !summary.investigations.length && !summary.followUp ? (
        <EmptyState
          className="mt-5"
          icon={<Stethoscope size={17} />}
          title="No structured care actions"
          copy="The Doctor completed this consultation without adding medication, investigations or a follow-up recommendation."
        />
      ) : null}
    </AppSurface>
  );
}

function SummaryBlock({ title, value }: { title: string; value: string }) {
  return (
    <section className="rounded-xl border border-[var(--clinora-border-subtle)] bg-[var(--clinora-surface-nested)] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--clinora-text-faint)]">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-200">{value}</p>
    </section>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}
