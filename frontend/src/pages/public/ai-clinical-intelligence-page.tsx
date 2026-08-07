import { Activity, BrainCircuit, CheckCircle2, FileSearch, ShieldCheck, Stethoscope, UserCheck } from 'lucide-react';
import { Container, GlassPanel } from '../../components/ui';
import { PageMeta } from '../../components/public/page-meta';
import { ProcessFlow } from '../../components/public/process-flow';
import { PublicCta } from '../../components/public/public-cta';
import { PublicPageHero } from '../../components/public/public-page-hero';
import { Reveal } from '../../components/public/reveal';
import { SectionHeader } from '../../components/landing/section-header';

const outputs = [
  [
    'Possible clinical hypotheses',
    'Surfaces plausible conditions as advisory suggestions rather than confirmed diagnoses.',
    BrainCircuit,
  ],
  [
    'Confidence context',
    'Presents model confidence as supporting context, never as a guarantee or diagnostic certainty.',
    Activity,
  ],
  [
    'Explainable reasoning',
    'Shows relevant abnormalities, symptoms, and clinical relationships behind a suggestion.',
    FileSearch,
  ],
  [
    'Potential follow-up investigation',
    'May suggest additional tests or specialist review for a physician to consider.',
    Stethoscope,
  ],
] as const;

export function AiClinicalIntelligencePage() {
  return (
    <main id="main-content">
      <PageMeta
        title="Clinora AI — AI Clinical Intelligence"
        description="Learn how Clinora AI is designed to provide explainable, advisory clinical intelligence for qualified professional review."
      />
      <PublicPageHero
        eyebrow="AI clinical intelligence"
        title="Clinical reasoning designed for professional review."
        copy="Clinora AI is designed to interpret structured clinical context, surface possible hypotheses, and explain supporting reasoning while keeping qualified healthcare professionals in control of every clinical decision."
        variant="ai"
        primaryAction={{ label: 'See the review workflow', to: '/features' }}
        secondaryAction={{ label: 'Explore OCR', to: '/laboratory-ocr' }}
        aside={
          <GlassPanel className="relative overflow-hidden border-cyan-300/12 bg-slate-950/58 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Illustrative AI review</p>
                <p className="mt-2 text-lg font-semibold text-white">Advisory reasoning available</p>
              </div>
              <BrainCircuit aria-hidden="true" className="text-cyan-200" size={30} />
            </div>
            <div className="mt-6 space-y-3">
              {['Clinical context assembled', 'Possible hypotheses surfaced', 'Reasoning made reviewable'].map(
                (item, index) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3"
                  >
                    <CheckCircle2 aria-hidden="true" className="text-teal-300" size={17} />
                    <span className="text-sm text-slate-300">{item}</span>
                    <span className="ml-auto text-xs font-bold text-slate-600">0{index + 1}</span>
                  </div>
                ),
              )}
            </div>
            <div className="mt-5 rounded-2xl border border-teal-300/12 bg-teal-300/5 p-4 text-sm leading-6 text-slate-300">
              Professional review is required before any clinical decision.
            </div>
          </GlassPanel>
        }
      />

      <section className="border-b border-white/5 py-20 lg:py-28">
        <Container>
          <Reveal>
            <SectionHeader
              eyebrow="How assistance is produced"
              title="Context first. AI assistance second. Human judgment always."
              copy="Clinora is designed to avoid isolated prediction. The workflow assembles clinical context, produces reviewable AI assistance, and returns control to a qualified professional."
              align="center"
            />
          </Reveal>
          <div className="mt-12">
            <ProcessFlow
              label="AI clinical intelligence workflow"
              steps={[
                'Clinical context',
                'AI-assisted analysis',
                'Explainable output',
                'Professional review',
                'Physician feedback',
              ]}
            />
          </div>
        </Container>
      </section>

      <section className="relative border-b border-white/5 bg-slate-950/45 py-20 lg:py-28">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[.78fr_1.22fr]">
            <Reveal>
              <SectionHeader
                eyebrow="Reviewable outputs"
                title="AI assistance should explain itself."
                copy="Clinora’s public product model emphasizes transparency: suggestions are accompanied by context that a healthcare professional can evaluate rather than accept blindly."
              />
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2">
              {outputs.map(([title, copy, Icon], index) => (
                <Reveal key={title} delay={index * 0.06}>
                  <GlassPanel className="group h-full border-white/9 bg-white/[0.035] p-6 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/16">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/12 bg-cyan-300/7 text-cyan-200">
                      <Icon aria-hidden="true" size={20} />
                    </span>
                    <h2 className="mt-6 text-lg font-semibold text-white">{title}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-400">{copy}</p>
                  </GlassPanel>
                </Reveal>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="py-20 lg:py-28">
        <Container>
          <div className="grid gap-6 lg:grid-cols-2">
            <Reveal>
              <GlassPanel className="h-full border-teal-300/12 bg-teal-300/[0.035] p-7 lg:p-9">
                <UserCheck aria-hidden="true" className="text-teal-300" size={28} />
                <h2 className="mt-6 text-2xl font-semibold text-white">Human-in-the-loop by design</h2>
                <p className="mt-4 text-base leading-8 text-slate-300">
                  Physicians remain responsible for validating clinical information and can accept, modify, or reject
                  AI-assisted suggestions. That feedback can also support future evaluation of model behavior.
                </p>
              </GlassPanel>
            </Reveal>
            <Reveal delay={0.06}>
              <GlassPanel className="h-full border-cyan-300/12 bg-cyan-300/[0.03] p-7 lg:p-9">
                <ShieldCheck aria-hidden="true" className="text-cyan-300" size={28} />
                <h2 className="mt-6 text-2xl font-semibold text-white">Safety before automation</h2>
                <p className="mt-4 text-base leading-8 text-slate-300">
                  AI output is advisory. Clinora does not present automated output as a confirmed diagnosis, does not
                  replace licensed clinicians, and is designed to preserve professional accountability.
                </p>
              </GlassPanel>
            </Reveal>
          </div>
        </Container>
      </section>

      <PublicCta
        title="See how laboratory reports become structured clinical context."
        copy="The OCR experience explains the document-processing stage that comes before AI-assisted reasoning."
        primary={{ label: 'Explore Laboratory OCR', to: '/laboratory-ocr' }}
        secondary={{ label: 'Platform Features', to: '/features' }}
      />
    </main>
  );
}
