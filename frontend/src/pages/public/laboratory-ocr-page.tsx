import { CheckCircle2, FileScan, ScanLine, ShieldCheck, TableProperties } from 'lucide-react';
import { Badge, Container, GlassPanel } from '../../components/ui';
import { PageMeta } from '../../components/public/page-meta';
import { ProcessFlow } from '../../components/public/process-flow';
import { PublicCta } from '../../components/public/public-cta';
import { PublicPageHero } from '../../components/public/public-page-hero';
import { Reveal } from '../../components/public/reveal';
import { SectionHeader } from '../../components/landing/section-header';

const exampleRows = [
  ['Hemoglobin', '13.6', 'g/dL'],
  ['WBC', '7.4', '×10⁹/L'],
  ['Platelets', '245', '×10⁹/L'],
] as const;

export function LaboratoryOcrPage() {
  return (
    <main id="main-content">
      <PageMeta
        title="Clinora AI — Laboratory OCR"
        description="Explore Clinora's conceptual laboratory OCR workflow for turning supported medical reports into structured clinical information."
      />
      <PublicPageHero
        eyebrow="Laboratory OCR"
        title="From report pages to structured clinical information."
        copy="Clinora’s OCR workflow is designed to convert supported laboratory documents into structured, reviewable data before any AI-assisted clinical reasoning begins."
        variant="ocr"
        primaryAction={{ label: 'Explore AI Intelligence', to: '/ai-clinical-intelligence' }}
        secondaryAction={{ label: 'Platform Features', to: '/features' }}
        aside={
          <GlassPanel className="overflow-hidden border-cyan-300/12 bg-slate-950/58 p-5">
            <div className="flex items-center justify-between gap-4 border-b border-white/8 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Illustrative report</p>
                <p className="mt-1 text-sm text-slate-400">Conceptual OCR preview</p>
              </div>
              <FileScan aria-hidden="true" className="text-cyan-200" size={26} />
            </div>
            <div className="relative mt-5 overflow-hidden rounded-[1.4rem] border border-white/8 bg-white/[0.035] p-5">
              <div className="ocr-scan-line absolute inset-x-4 top-6 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
              <div className="space-y-3">
                <div className="h-2 w-2/3 rounded-full bg-white/10" />
                <div className="h-2 w-full rounded-full bg-white/7" />
                <div className="h-2 w-5/6 rounded-full bg-white/7" />
                <div className="mt-6 grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((item) => (
                    <div key={item} className="h-9 rounded-xl border border-white/7 bg-slate-950/55" />
                  ))}
                </div>
              </div>
            </div>
          </GlassPanel>
        }
      />

      <section className="border-b border-white/5 py-20 lg:py-28">
        <Container>
          <Reveal>
            <SectionHeader
              eyebrow="Document workflow"
              title="Extraction is a dedicated step before clinical reasoning."
              copy="The conceptual flow keeps document handling, OCR extraction, data structuring, validation, and AI assistance as distinct responsibilities."
              align="center"
            />
          </Reveal>
          <div className="mt-12">
            <ProcessFlow
              label="Laboratory OCR workflow"
              steps={['Medical report', 'Secure intake', 'OCR extraction', 'Structured clinical data', 'Validation']}
            />
          </div>
        </Container>
      </section>

      <section className="border-b border-white/5 bg-slate-950/45 py-20 lg:py-28">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[.88fr_1.12fr] lg:items-center">
            <Reveal>
              <SectionHeader
                eyebrow="Structured result"
                title="Clinical values become easier to review when they are structured."
                copy="The interface can present extracted parameters as organized data while retaining the original document as the clinical source. Values below are illustrative only."
              />
              <div className="mt-7 flex flex-wrap gap-2">
                <Badge variant="info">Illustrative data</Badge>
                <Badge>Not a patient record</Badge>
              </div>
            </Reveal>
            <Reveal delay={0.06}>
              <GlassPanel className="overflow-hidden border-white/9 bg-slate-950/52 p-0">
                <div className="flex items-center justify-between gap-4 border-b border-white/8 px-6 py-5">
                  <div className="flex items-center gap-3">
                    <TableProperties aria-hidden="true" className="text-cyan-300" size={20} />
                    <p className="font-semibold text-white">Extracted laboratory parameters</p>
                  </div>
                  <Badge variant="success">Conceptual</Badge>
                </div>
                <div className="divide-y divide-white/7">
                  {exampleRows.map(([parameter, value, unit]) => (
                    <div
                      key={parameter}
                      className="grid grid-cols-[1fr_auto] gap-4 px-6 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                    >
                      <span className="font-medium text-slate-200">{parameter}</span>
                      <span className="font-semibold tabular-nums text-white">{value}</span>
                      <span className="col-span-2 text-xs text-slate-500 sm:col-span-1 sm:w-20">{unit}</span>
                    </div>
                  ))}
                </div>
              </GlassPanel>
            </Reveal>
          </div>
        </Container>
      </section>

      <section className="py-20 lg:py-28">
        <Container>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              [
                'Supported intake',
                'The production workflow will validate supported file types and reject unsuitable uploads.',
                FileScan,
              ],
              [
                'Reviewable extraction',
                'OCR output is structured so downstream validation can occur before AI-assisted analysis.',
                ScanLine,
              ],
              [
                'Protected boundary',
                'The public website does not upload reports or call the OCR service directly.',
                ShieldCheck,
              ],
            ].map(([title, copy, Icon], index) => {
              const FeatureIcon = Icon as typeof CheckCircle2;
              return (
                <Reveal key={title as string} delay={index * 0.06}>
                  <GlassPanel className="h-full border-white/9 bg-white/[0.035] p-6">
                    <FeatureIcon aria-hidden="true" className="text-cyan-300" size={24} />
                    <h2 className="mt-5 text-lg font-semibold text-white">{title as string}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-400">{copy as string}</p>
                  </GlassPanel>
                </Reveal>
              );
            })}
          </div>
        </Container>
      </section>

      <PublicCta
        title="Continue from structured data to AI-assisted reasoning."
        copy="Once clinical information has been structured and validated, the AI layer can provide advisory reasoning for qualified professional review."
        primary={{ label: 'AI Clinical Intelligence', to: '/ai-clinical-intelligence' }}
        secondary={{ label: 'Explore Features', to: '/features' }}
      />
    </main>
  );
}
