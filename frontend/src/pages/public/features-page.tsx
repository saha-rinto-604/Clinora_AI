import {
  Activity,
  BrainCircuit,
  CalendarDays,
  FileScan,
  HeartPulse,
  Microscope,
  Stethoscope,
  UsersRound,
} from 'lucide-react';
import { Badge, Card, Container, GlassPanel } from '../../components/ui';
import { PageMeta } from '../../components/public/page-meta';
import { ProcessFlow } from '../../components/public/process-flow';
import { PublicCta } from '../../components/public/public-cta';
import { PublicPageHero } from '../../components/public/public-page-hero';
import { Reveal } from '../../components/public/reveal';
import { SectionHeader } from '../../components/landing/section-header';

const capabilities = [
  {
    title: 'Medical report intelligence',
    copy: 'Keep laboratory and diagnostic reports organized within a protected clinical workflow.',
    Icon: FileScan,
    span: 'xl:col-span-6',
  },
  {
    title: 'AI clinical intelligence',
    copy: 'Present advisory hypotheses, explainable reasoning, and clinical context for professional review.',
    Icon: BrainCircuit,
    span: 'xl:col-span-6',
  },
  {
    title: 'Appointments',
    copy: 'Connect patient scheduling, consultation workflows, reminders, and follow-up planning.',
    Icon: CalendarDays,
    span: 'xl:col-span-3',
  },
  {
    title: 'Doctor collaboration',
    copy: 'Keep clinical review, consultation notes, prescriptions, and follow-up inside one care journey.',
    Icon: Stethoscope,
    span: 'xl:col-span-3',
  },
  {
    title: 'Emergency blood assistance',
    copy: 'Support time-sensitive coordination between patients, hospitals, and blood banks.',
    Icon: HeartPulse,
    span: 'xl:col-span-3',
  },
  {
    title: 'Research intelligence',
    copy: 'Enable privacy-conscious datasets, disease analytics, and AI evaluation experiences.',
    Icon: Microscope,
    span: 'xl:col-span-3',
  },
];

const roles = [
  ['Patient', 'Personal records, understandable report insights, appointments, and care continuity.'],
  ['Doctor', 'Clinical context, AI-assisted reasoning, consultations, prescriptions, and follow-up.'],
  ['Hospital Administrator', 'Departments, staff, resources, appointments, and organizational visibility.'],
  ['Researcher', 'Anonymized datasets, disease analytics, model evaluation, and collaboration.'],
  ['Blood Bank Staff', 'Inventory visibility, emergency requests, reservations, and coordination.'],
  ['System Administrator', 'Access governance, auditability, platform configuration, and system oversight.'],
] as const;

export function FeaturesPage() {
  return (
    <main id="main-content">
      <PageMeta
        title="Clinora AI — Platform Features"
        description="Explore the connected clinical intelligence, OCR, appointments, emergency blood assistance, healthcare operations, and research capabilities planned for Clinora AI."
      />
      <PublicPageHero
        eyebrow="Platform features"
        title="One connected platform for the clinical care journey."
        copy="Clinora brings healthcare information, AI-assisted reasoning, clinical collaboration, emergency coordination, and privacy-conscious research into a single coherent ecosystem."
        variant="network"
        primaryAction={{ label: 'Explore AI Intelligence', to: '/ai-clinical-intelligence' }}
        secondaryAction={{ label: 'See Laboratory OCR', to: '/laboratory-ocr' }}
        aside={
          <GlassPanel className="overflow-hidden border-cyan-300/12 bg-slate-950/55 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Connected ecosystem</p>
                <p className="mt-2 text-lg font-semibold text-white">Care, intelligence, research</p>
              </div>
              <UsersRound aria-hidden="true" className="text-cyan-200" size={28} />
            </div>
            <div className="mt-7 grid grid-cols-2 gap-3">
              {['Patients', 'Doctors', 'Hospitals', 'Researchers', 'Blood Banks', 'Administration'].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3 text-sm font-medium text-slate-300"
                >
                  {item}
                </div>
              ))}
            </div>
          </GlassPanel>
        }
      />

      <section className="border-b border-white/5 py-20 lg:py-28">
        <Container>
          <Reveal>
            <SectionHeader
              eyebrow="Platform capabilities"
              title="Designed as a clinical ecosystem, not a collection of disconnected tools."
              copy="Each capability supports a distinct healthcare responsibility while sharing a consistent, secure product experience."
            />
          </Reveal>
          <div className="mt-12 grid gap-5 xl:grid-cols-12">
            {capabilities.map(({ title, copy, Icon, span }, index) => (
              <Reveal key={title} delay={index * 0.06} className={span}>
                <GlassPanel className="group h-full border-white/9 bg-white/[0.04] p-6 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/18 hover:bg-white/[0.055]">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/12 bg-cyan-300/7 text-cyan-200">
                    <Icon aria-hidden="true" size={20} />
                  </span>
                  <h2 className="mt-6 text-xl font-semibold text-white">{title}</h2>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-slate-400">{copy}</p>
                </GlassPanel>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="relative border-b border-white/5 bg-slate-950/45 py-20 lg:py-28">
        <Container>
          <Reveal>
            <SectionHeader
              eyebrow="Care journey"
              title="Information moves through deliberate checkpoints."
              copy="The public workflow illustrates how Clinora is designed to transform reports into structured context, AI assistance, professional review, and continued care."
              align="center"
            />
          </Reveal>
          <div className="mt-12">
            <ProcessFlow
              label="Clinora platform care journey"
              steps={[
                'Medical information',
                'Structured clinical data',
                'AI-assisted context',
                'Professional review',
                'Continued care',
              ]}
            />
          </div>
        </Container>
      </section>

      <section className="py-20 lg:py-28">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
            <Reveal>
              <SectionHeader
                eyebrow="Six-role ecosystem"
                title="Different responsibilities. One connected platform."
                copy="Clinora is designed around six distinct roles so access, workflows, and clinical responsibility remain clear across the ecosystem."
              />
              <div className="mt-8 flex gap-3">
                <Badge variant="info">Role-aware</Badge>
                <Badge>Human-centered</Badge>
              </div>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2">
              {roles.map(([title, copy], index) => (
                <Reveal key={title} delay={index * 0.055}>
                  <Card className="h-full border-white/8 bg-slate-900/45 p-5 shadow-none transition duration-300 hover:-translate-y-1 hover:border-teal-300/15">
                    <span className="text-xs font-bold text-teal-300">0{index + 1}</span>
                    <h2 className="mt-5 text-lg font-semibold text-white">{title}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-400">{copy}</p>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="border-y border-white/5 bg-white/[0.018] py-20 lg:py-28">
        <Container>
          <Reveal>
            <GlassPanel className="grid gap-8 overflow-hidden border-white/9 bg-slate-950/45 p-7 lg:grid-cols-[1fr_auto] lg:items-center lg:p-10">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
                  Human-centered architecture
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] text-white">
                  Clinical intelligence remains anchored to human judgment.
                </h2>
                <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
                  AI assistance is designed to surface context and reasoning for qualified review. It does not replace
                  licensed healthcare professionals or independently confirm a diagnosis.
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-300">
                <Activity aria-hidden="true" className="text-cyan-300" /> Review required
              </div>
            </GlassPanel>
          </Reveal>
        </Container>
      </section>

      <PublicCta
        title="Explore the intelligence layer behind the platform."
        copy="See how Clinora presents AI-assisted reasoning and laboratory OCR as protected, reviewable parts of the healthcare workflow."
        primary={{ label: 'AI Clinical Intelligence', to: '/ai-clinical-intelligence' }}
        secondary={{ label: 'Laboratory OCR', to: '/laboratory-ocr' }}
      />
    </main>
  );
}
