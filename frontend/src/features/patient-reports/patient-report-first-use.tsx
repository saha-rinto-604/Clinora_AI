import { Building2, CalendarDays, FileCheck2, FileLock2, History, ShieldCheck, UploadCloud } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppSurface, IconWell } from '../../components/app/app-ui';
import { Button } from '../../components/ui/button';

export function PatientReportFirstUse({ onUpload }: { onUpload: () => void }) {
  return (
    <AppSurface
      as="section"
      variant="hero"
      padding="none"
      className="relative overflow-hidden"
      aria-labelledby="first-report-title"
      data-report-first-use="true"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(14,165,233,0.12),transparent_32%),radial-gradient(circle_at_82%_75%,rgba(20,184,166,0.09),transparent_35%)]"
        aria-hidden="true"
      />

      <div className="relative grid lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
        <div className="flex min-h-[25rem] flex-col justify-center px-6 py-9 sm:px-9 sm:py-11 lg:px-12">
          <IconWell tone="info" className="h-12 w-12">
            <UploadCloud size={21} aria-hidden="true" />
          </IconWell>
          <p className="mt-7 text-xs font-bold uppercase tracking-[0.17em] text-[var(--clinora-info-foreground)]">
            Start your private record
          </p>
          <h2
            id="first-report-title"
            className="mt-2 max-w-xl text-2xl font-semibold tracking-[-0.04em] text-white sm:text-3xl"
          >
            Add your first medical report
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--clinora-text-muted)] sm:text-[15px]">
            Upload a document from a laboratory, clinic, or hospital. Add its date and provider now, or update those
            details later.
          </p>
          <div className="mt-7">
            <Button variant="appPrimary" onClick={onUpload}>
              <UploadCloud size={17} aria-hidden="true" /> Choose a report
            </Button>
            <p className="mt-3 text-xs text-[var(--clinora-text-faint)]">
              PDF, JPG, JPEG or PNG <span aria-hidden="true">·</span> up to 20 MB
            </p>
          </div>
        </div>

        <div className="border-t border-[var(--clinora-border-subtle)] bg-black/[0.08] px-6 py-8 sm:px-9 lg:border-l lg:border-t-0 lg:px-8 lg:py-10">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--clinora-text-faint)]">
            Before you upload
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">A few details keep reports easy to find</h3>
          <ul className="mt-6 divide-y divide-[var(--clinora-border-subtle)]">
            <PreparationItem
              icon={<FileCheck2 size={18} aria-hidden="true" />}
              title="Use a clear report name"
              copy="The report type and name are required."
            />
            <PreparationItem
              icon={<CalendarDays size={18} aria-hidden="true" />}
              title="Add the date when available"
              copy="Use the date printed on the report."
            />
            <PreparationItem
              icon={<Building2 size={18} aria-hidden="true" />}
              title="Provider details are optional"
              copy="Add the clinic, hospital, or laboratory if known."
            />
          </ul>
        </div>
      </div>

      <div className="relative grid border-t border-[var(--clinora-border-subtle)] bg-black/[0.09] sm:grid-cols-3">
        <AssuranceItem
          icon={<ShieldCheck size={16} aria-hidden="true" />}
          title="Private storage"
          copy="Available through your signed-in Patient account."
        />
        <AssuranceItem
          icon={<FileLock2 size={16} aria-hidden="true" />}
          title="Original document"
          copy="Viewing and editing details do not change the file."
        />
        <AssuranceItem
          icon={<History size={16} aria-hidden="true" />}
          title="Archive and restore"
          copy="Move older reports aside without losing them."
        />
      </div>
    </AppSurface>
  );
}

function PreparationItem({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return (
    <li className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <span className="mt-0.5 text-[var(--clinora-info-foreground)]">{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-slate-100">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-[var(--clinora-text-muted)]">{copy}</span>
      </span>
    </li>
  );
}

function AssuranceItem({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return (
    <div className="flex gap-3 border-b border-[var(--clinora-border-subtle)] px-6 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <span className="mt-0.5 text-[var(--clinora-success-foreground)]">{icon}</span>
      <span>
        <span className="block text-xs font-semibold text-slate-100">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-[var(--clinora-text-faint)]">{copy}</span>
      </span>
    </div>
  );
}
