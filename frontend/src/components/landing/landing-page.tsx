import {
  Activity,
  ArrowRight,
  Beaker,
  BrainCircuit,
  CheckCircle2,
  CircleDot,
  Database,
  FileScan,
  Fingerprint,
  HeartPulse,
  Microscope,
  Network,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UsersRound,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Card,
  Container,
  GlassPanel,
  Grid,
  SkipLink,
} from '../ui';
import { buttonVariants } from '../ui/button-variants';
import {
  careSteps,
  ecosystemCards,
  faqs,
  intelligenceCards,
  proofBadges,
  roleCards,
  securityItems,
  workflowSteps,
} from './landing-data';
import { LandingHero } from './landing-hero';
import { PublicFooter } from './public-footer';
import { PublicNavbar } from './public-navbar';
import { SectionHeader } from './section-header';

function Reveal({
  children,
  className = '',
  delay = 0,
  distance = 34,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: distance, scale: 0.975 }}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.24, margin: '-20px 0px' }}
      transition={{ duration: 0.64, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function FeatureIcon({ children, tone = 'cyan' }: { children: React.ReactNode; tone?: 'cyan' | 'teal' | 'rose' }) {
  const tones = {
    cyan: 'border-cyan-300/15 bg-cyan-300/8 text-cyan-200',
    teal: 'border-teal-300/15 bg-teal-300/8 text-teal-200',
    rose: 'border-rose-300/15 bg-rose-300/8 text-rose-200',
  };

  return (
    <span
      className={`grid h-11 w-11 place-items-center rounded-2xl border transition duration-300 ease-out group-hover:scale-105 group-hover:-translate-y-0.5 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function LandingPage() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#020617] text-slate-50">
      <SkipLink>Skip to main content</SkipLink>
      <PublicNavbar />
      <main id="main-content" className="overflow-x-hidden">
        <LandingHero />

        <section id="platform" className="relative scroll-mt-24 border-b border-white/5 py-24 lg:py-32">
          <Container>
            <Reveal>
              <SectionHeader
                eyebrow="One connected ecosystem"
                title="Healthcare intelligence in one connected ecosystem."
                copy="Clinora connects the major participants in care, operations, research, and emergency coordination while preserving the role-specific responsibilities that keep healthcare workflows clear."
              />
            </Reveal>

            <Grid className="mt-12 gap-5">
              {ecosystemCards.map(({ title, copy, Icon }, index) => (
                <Reveal key={title} delay={index * 0.09} className={index < 2 ? 'xl:col-span-6' : 'xl:col-span-3'}>
                  <GlassPanel className="group h-full overflow-hidden border-white/10 bg-white/[0.045] transition duration-300 ease-out hover:-translate-y-1 hover:border-cyan-300/20 hover:bg-white/[0.065] hover:shadow-[0_24px_70px_rgba(2,132,199,.08)]">
                    <div className="flex h-full flex-col gap-5">
                      <FeatureIcon tone={index % 2 === 0 ? 'cyan' : 'teal'}>
                        <Icon aria-hidden="true" size={20} />
                      </FeatureIcon>
                      <div>
                        <h3 className="text-xl font-semibold text-white">{title}</h3>
                        <p className="mt-3 text-sm leading-7 text-slate-400">{copy}</p>
                      </div>
                    </div>
                  </GlassPanel>
                </Reveal>
              ))}
            </Grid>
          </Container>
        </section>

        <section id="intelligence" className="relative scroll-mt-24 py-24 lg:py-32">
          <div
            aria-hidden="true"
            className="absolute left-0 top-24 h-72 w-72 rounded-full bg-cyan-400/6 blur-[100px]"
          />
          <Container>
            <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
              <Reveal>
                <SectionHeader
                  eyebrow="Core intelligence"
                  title="AI assistance designed for review, not replacement."
                  copy="Clinora structures report information, surfaces clinical context, and presents explainable AI assistance so qualified professionals can evaluate what the system suggests."
                  aside={
                    <div className="flex flex-wrap gap-2 pt-2">
                      {proofBadges.map((badge) => (
                        <Badge key={badge}>{badge}</Badge>
                      ))}
                    </div>
                  }
                />
              </Reveal>

              <div className="grid gap-4 sm:grid-cols-2">
                {intelligenceCards.map(({ title, copy, Icon }, index) => (
                  <Reveal key={title} delay={index * 0.09}>
                    <Card className="group h-full border-white/8 bg-slate-900/45 p-5 shadow-none transition duration-300 ease-out hover:-translate-y-1 hover:border-cyan-300/15 hover:bg-slate-900/60">
                      <FeatureIcon tone={index === 1 ? 'teal' : 'cyan'}>
                        <Icon aria-hidden="true" size={20} />
                      </FeatureIcon>
                      <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
                      <p className="mt-3 text-sm leading-7 text-slate-400">{copy}</p>
                    </Card>
                  </Reveal>
                ))}
              </div>
            </div>
          </Container>
        </section>

        <section id="ai-ocr" className="relative scroll-mt-24 border-y border-white/5 bg-slate-950/42 py-24 lg:py-32">
          <Container>
            <Reveal>
              <SectionHeader
                eyebrow="AI + OCR"
                title="From medical reports to structured clinical insight."
                copy="Clinora combines document extraction and AI-assisted reasoning in a protected workflow that keeps sensitive processing behind the platform and professional review at the end."
              />
            </Reveal>

            <div className="mt-14 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
              <Reveal delay={0.04}>
                <GlassPanel className="overflow-hidden border-cyan-300/10 bg-slate-950/55 p-5 sm:p-7">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">Report-to-review workflow</p>
                      <p className="mt-1 text-xs text-slate-500">
                        A clear path from document intake to professional interpretation.
                      </p>
                    </div>
                    <Badge variant="info">Human-in-the-loop</Badge>
                  </div>

                  <ol className="mt-7 grid gap-3 md:grid-cols-5" aria-label="AI and OCR workflow">
                    {workflowSteps.map((step, index) => (
                      <motion.li
                        key={step}
                        className="relative"
                        initial={reducedMotion ? false : { opacity: 0, y: 28, scale: 0.975 }}
                        whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                        viewport={{ once: true, amount: 0.5 }}
                        transition={{ duration: 0.56, delay: index * 0.09, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <div className="flex h-full min-h-28 flex-col justify-between rounded-[1.35rem] border border-white/8 bg-white/[0.035] p-4">
                          <span className="text-xs font-bold tabular-nums text-cyan-300">0{index + 1}</span>
                          <span className="mt-5 text-sm font-semibold leading-5 text-slate-200">{step}</span>
                        </div>
                        {index < workflowSteps.length - 1 ? (
                          <ArrowRight
                            aria-hidden="true"
                            className="absolute -right-[0.85rem] top-1/2 z-10 hidden -translate-y-1/2 text-slate-700 md:block"
                            size={16}
                          />
                        ) : null}
                      </motion.li>
                    ))}
                  </ol>

                  <div className="mt-7 grid gap-3 border-t border-white/7 pt-6 sm:grid-cols-3">
                    {[
                      ['Protected processing', 'Sensitive document processing stays behind the public interface.'],
                      ['Structured outputs', 'OCR organizes report content into reviewable clinical information.'],
                      [
                        'Professional review',
                        'AI assistance remains advisory and returns to qualified healthcare professionals.',
                      ],
                    ].map(([title, copy]) => (
                      <div key={title} className="rounded-2xl bg-white/[0.025] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-300">{title}</p>
                        <p className="mt-2 text-xs leading-5 text-slate-500">{copy}</p>
                      </div>
                    ))}
                  </div>
                </GlassPanel>
              </Reveal>

              <Reveal delay={0.12}>
                <GlassPanel className="group h-full border-white/10 bg-white/[0.04] transition duration-300 ease-out hover:-translate-y-1 hover:border-cyan-300/15 hover:bg-white/[0.055]">
                  <div className="flex items-center gap-3">
                    <FeatureIcon>
                      <ScanLine aria-hidden="true" size={20} />
                    </FeatureIcon>
                    <div>
                      <h3 className="font-semibold text-white">Processing status preview</h3>
                      <p className="text-xs text-slate-500">Illustrative interface states only.</p>
                    </div>
                  </div>

                  <ul className="mt-6 space-y-3" aria-label="Conceptual report processing states">
                    {[
                      ['Report intake', 'Ready for extraction', 'cyan'],
                      ['OCR structure', 'Values organized', 'teal'],
                      ['AI assistance', 'Professional review required', 'cyan'],
                    ].map(([label, state, tone], index) => (
                      <motion.li
                        key={label}
                        initial={reducedMotion ? false : { opacity: 0, x: 24 }}
                        whileInView={reducedMotion ? undefined : { opacity: 1, x: 0 }}
                        viewport={{ once: true, amount: 0.65 }}
                        transition={{ duration: 0.52, delay: index * 0.09, ease: [0.22, 1, 0.36, 1] }}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-white/7 bg-slate-950/45 px-4 py-4 transition duration-300 ease-out hover:border-cyan-300/12 hover:bg-slate-950/65"
                      >
                        <span className="text-sm font-medium text-slate-300">{label}</span>
                        <span
                          className={
                            tone === 'teal'
                              ? 'rounded-full border border-teal-300/15 bg-teal-300/5 px-3 py-1.5 text-xs font-semibold text-teal-200'
                              : 'rounded-full border border-cyan-300/15 bg-cyan-300/5 px-3 py-1.5 text-xs font-semibold text-cyan-200'
                          }
                        >
                          {state}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </GlassPanel>
              </Reveal>
            </div>
          </Container>
        </section>

        <section id="emergency-assistance" className="relative scroll-mt-24 py-24 lg:py-32">
          <div
            aria-hidden="true"
            className="absolute right-0 top-20 h-80 w-80 rounded-full bg-rose-500/5 blur-[110px]"
          />
          <Container>
            <div className="grid gap-10 lg:grid-cols-[1fr_.9fr] lg:items-center">
              <Reveal>
                <SectionHeader
                  eyebrow="Emergency Blood Assistance"
                  title="Faster coordination when every minute matters."
                  copy="Emergency Blood Assistance connects request coordination, nearby blood-bank discovery, availability support, and status communication in one focused workflow. It supports coordination; it does not guarantee supply."
                />
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {[
                    'Emergency request coordination',
                    'Nearby blood-bank discovery',
                    'Availability support',
                    'Status communication',
                  ].map((item, index) => (
                    <motion.div
                      key={item}
                      initial={reducedMotion ? false : { opacity: 0, y: 26, scale: 0.98 }}
                      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                      viewport={{ once: true, amount: 0.6 }}
                      transition={{ duration: 0.54, delay: index * 0.09, ease: [0.22, 1, 0.36, 1] }}
                      className="flex items-center gap-3 rounded-2xl border border-rose-300/10 bg-rose-300/[0.035] p-4 text-sm text-slate-300 transition duration-300 ease-out hover:-translate-y-0.5 hover:border-rose-300/18 hover:bg-rose-300/[0.055]"
                    >
                      <CheckCircle2 aria-hidden="true" className="shrink-0 text-rose-300" size={17} />
                      {item}
                    </motion.div>
                  ))}
                </div>
              </Reveal>

              <Reveal delay={0.1}>
                <GlassPanel className="group relative overflow-hidden border-rose-300/12 bg-slate-950/60 p-7">
                  <div
                    aria-hidden="true"
                    className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-rose-400/7 blur-3xl"
                  />
                  <div className="relative">
                    <FeatureIcon tone="rose">
                      <HeartPulse aria-hidden="true" size={20} />
                    </FeatureIcon>
                    <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-rose-300">
                      Coordination path
                    </p>
                    <div className="mt-5 space-y-3">
                      {[
                        'Request submitted',
                        'Nearby sources considered',
                        'Availability response',
                        'Patient updated',
                      ].map((item, index) => (
                        <motion.div
                          key={item}
                          initial={reducedMotion ? false : { opacity: 0, x: 24 }}
                          whileInView={reducedMotion ? undefined : { opacity: 1, x: 0 }}
                          viewport={{ once: true, amount: 0.65 }}
                          transition={{ duration: 0.5, delay: 0.08 + index * 0.085, ease: [0.22, 1, 0.36, 1] }}
                          className="flex items-center gap-4 rounded-2xl border border-white/7 bg-white/[0.035] px-4 py-3 transition duration-300 ease-out hover:border-rose-300/12 hover:bg-white/[0.05]"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-rose-300/15 bg-rose-300/5 text-xs font-bold text-rose-200">
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium text-slate-300">{item}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </GlassPanel>
              </Reveal>
            </div>
          </Container>
        </section>

        <section id="roles" className="scroll-mt-24 border-y border-white/5 bg-white/[0.018] py-24 lg:py-32">
          <Container>
            <Reveal>
              <SectionHeader
                eyebrow="Built for every healthcare role"
                title="Built for distinct responsibilities across healthcare."
                copy="Patients, clinicians, healthcare organizations, researchers, blood banks, and administrators each receive an experience shaped around their responsibilities and access needs."
                align="center"
              />
            </Reveal>

            <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {roleCards.map(({ label, copy }, index) => (
                <Reveal key={label} delay={index * 0.085}>
                  <GlassPanel className="group h-full border-white/9 bg-slate-950/45 p-5 transition duration-300 ease-out hover:-translate-y-1 hover:border-cyan-300/14 hover:bg-slate-950/60">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs font-bold tabular-nums text-slate-500">0{index + 1}</span>
                      <CircleDot
                        aria-hidden="true"
                        className={index % 2 === 0 ? 'text-cyan-300' : 'text-teal-300'}
                        size={16}
                      />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-white">{label}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-400">{copy}</p>
                  </GlassPanel>
                </Reveal>
              ))}
            </div>
          </Container>
        </section>

        <section id="research" className="relative scroll-mt-24 overflow-hidden py-24 lg:py-32">
          <div
            aria-hidden="true"
            className="molecular-orbit absolute right-[4%] top-14 hidden h-96 w-96 opacity-40 lg:block"
          />
          <Container>
            <div className="grid gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
              <Reveal>
                <SectionHeader
                  eyebrow="Research intelligence"
                  title="Clinical data can inform research without exposing patient identity."
                  copy="Clinora supports research through anonymized datasets, disease analytics, AI model evaluation, and controlled collaboration while keeping personally identifiable clinical information outside the researcher experience."
                />
              </Reveal>

              <Reveal>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ['Anonymized datasets', Database, 'Research views center on de-identified clinical information.'],
                    [
                      'Disease analytics',
                      Activity,
                      'Explore population-level patterns without presenting fabricated outcomes.',
                    ],
                    [
                      'Model evaluation',
                      BrainCircuit,
                      'Support controlled assessment of AI behavior and physician feedback.',
                    ],
                    [
                      'Research collaboration',
                      Microscope,
                      'Create governed spaces for controlled scientific collaboration.',
                    ],
                  ].map(([title, Icon, copy], index) => {
                    const ResearchIcon = Icon as typeof Microscope;
                    return (
                      <motion.div
                        key={title as string}
                        initial={reducedMotion ? false : { opacity: 0, y: 28, scale: 0.975 }}
                        whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                        viewport={{ once: true, amount: 0.45 }}
                        transition={{ duration: 0.56, delay: index * 0.09, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <GlassPanel className="group h-full border-white/9 bg-white/[0.035] p-5 transition duration-300 ease-out hover:-translate-y-1 hover:border-teal-300/14 hover:bg-white/[0.05]">
                          <FeatureIcon tone={index % 2 === 0 ? 'cyan' : 'teal'}>
                            <ResearchIcon aria-hidden="true" size={20} />
                          </FeatureIcon>
                          <h3 className="mt-5 font-semibold text-white">{title as string}</h3>
                          <p className="mt-3 text-sm leading-7 text-slate-400">{copy as string}</p>
                        </GlassPanel>
                      </motion.div>
                    );
                  })}
                </div>
              </Reveal>
            </div>
          </Container>
        </section>

        <section id="security" className="scroll-mt-24 border-y border-white/5 bg-slate-950/48 py-24 lg:py-32">
          <Container>
            <Reveal>
              <SectionHeader
                eyebrow="Security by design"
                title="Designed to protect clinical context at every boundary."
                copy="Role-aware access, protected clinical assets, auditability, and anonymized research are core principles for handling sensitive healthcare information responsibly."
                align="center"
              />
            </Reveal>

            <Reveal>
              <GlassPanel className="mt-12 overflow-hidden border-white/9 bg-slate-950/48 p-0">
                <div className="grid md:grid-cols-2 xl:grid-cols-4">
                  {securityItems.map(({ title, copy, Icon }, index) => (
                    <motion.div
                      key={title}
                      initial={reducedMotion ? false : { opacity: 0, y: 26, scale: 0.98 }}
                      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                      viewport={{ once: true, amount: 0.55 }}
                      transition={{ duration: 0.54, delay: index * 0.09, ease: [0.22, 1, 0.36, 1] }}
                      className={`group border-b border-white/7 p-6 transition duration-300 ease-out hover:bg-white/[0.025] last:border-b-0 ${index < 2 ? 'md:border-b' : 'md:border-b-0'} ${index % 2 === 0 ? 'md:border-r' : ''} xl:border-b-0 ${index < securityItems.length - 1 ? 'xl:border-r' : 'xl:border-r-0'}`}
                    >
                      <FeatureIcon tone={index % 2 === 0 ? 'cyan' : 'teal'}>
                        <Icon aria-hidden="true" size={20} />
                      </FeatureIcon>
                      <h3 className="mt-5 font-semibold text-white">{title}</h3>
                      <p className="mt-3 text-sm leading-7 text-slate-400">{copy}</p>
                    </motion.div>
                  ))}
                </div>
              </GlassPanel>
            </Reveal>

            <Reveal>
              <div className="mt-7 flex flex-wrap justify-center gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/8 px-3 py-2">
                  <Fingerprint aria-hidden="true" size={14} /> Role and resource boundaries
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/8 px-3 py-2">
                  <ShieldCheck aria-hidden="true" size={14} /> Human accountability
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/8 px-3 py-2">
                  <Network aria-hidden="true" size={14} /> Protected service access
                </span>
              </div>
            </Reveal>
          </Container>
        </section>

        <section id="workflow" className="scroll-mt-24 py-24 lg:py-32">
          <Container>
            <Reveal>
              <SectionHeader
                eyebrow="How Clinora works"
                title="A healthcare workflow with deliberate checkpoints."
                copy="The care journey moves from protected report intake to structured extraction, AI assistance, professional review, and continued care—with clear checkpoints at every stage."
              />
            </Reveal>

            <ol className="mt-12 grid gap-4 md:grid-cols-5" aria-label="Clinora care workflow">
              {careSteps.map(({ label, copy }, index) => (
                <motion.li
                  key={label}
                  initial={reducedMotion ? false : { opacity: 0, y: 30, scale: 0.975 }}
                  whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, amount: 0.45 }}
                  transition={{ duration: 0.56, delay: index * 0.09, ease: [0.22, 1, 0.36, 1] }}
                  className="group relative h-full rounded-[var(--radius-component)] border border-white/9 bg-white/[0.035] p-5 transition duration-300 ease-out hover:-translate-y-1 hover:border-cyan-300/14 hover:bg-white/[0.05]"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-bold text-cyan-300">0{index + 1}</span>
                    {index === 0 ? <FileScan aria-hidden="true" size={17} className="text-slate-500" /> : null}
                    {index === 1 ? <ScanLine aria-hidden="true" size={17} className="text-slate-500" /> : null}
                    {index === 2 ? <BrainCircuit aria-hidden="true" size={17} className="text-slate-500" /> : null}
                    {index === 3 ? <Stethoscope aria-hidden="true" size={17} className="text-slate-500" /> : null}
                    {index === 4 ? <UsersRound aria-hidden="true" size={17} className="text-slate-500" /> : null}
                  </div>
                  <h3 className="mt-7 font-semibold text-white">{label}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p>
                </motion.li>
              ))}
            </ol>
          </Container>
        </section>

        <section id="faq" className="scroll-mt-24 border-y border-white/5 bg-white/[0.018] py-24 lg:py-32">
          <Container>
            <div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr]">
              <Reveal>
                <SectionHeader
                  eyebrow="FAQ"
                  title="Clear answers about clinical AI, privacy, and care workflows."
                  copy="Clinora keeps AI assistance transparent and makes the boundary between technology and professional healthcare judgment easy to understand."
                />
              </Reveal>

              <Reveal>
                <GlassPanel className="border-white/9 bg-slate-950/50 p-3 sm:p-5">
                  <Accordion type="single" collapsible>
                    {faqs.map(({ question, answer }, index) => (
                      <AccordionItem
                        key={question}
                        value={`faq-${index}`}
                        className="border-b border-white/7 last:border-0"
                      >
                        <AccordionTrigger className="py-4 text-base">{question}</AccordionTrigger>
                        <AccordionContent className="pb-5 text-sm leading-7">{answer}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </GlassPanel>
              </Reveal>
            </div>
          </Container>
        </section>

        <section className="relative overflow-hidden py-24 lg:py-32">
          <div
            aria-hidden="true"
            className="absolute inset-x-[15%] bottom-0 h-64 rounded-full bg-cyan-400/8 blur-[110px]"
          />
          <Container>
            <Reveal>
              <GlassPanel className="group relative overflow-hidden border-cyan-200/15 bg-gradient-to-br from-cyan-400/8 via-white/[0.035] to-teal-400/8 p-8 sm:p-10 lg:p-14">
                <div aria-hidden="true" className="absolute right-10 top-8 hidden text-cyan-100/10 md:block">
                  <Beaker size={120} strokeWidth={1} />
                </div>
                <div className="relative max-w-3xl">
                  <Badge variant="info" className="gap-2">
                    <Sparkles aria-hidden="true" size={14} /> Built for clinical intelligence
                  </Badge>
                  <h2 className="mt-6 text-balance text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">
                    See how clinical intelligence connects across the care journey.
                  </h2>
                  <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                    Explore Clinora’s connected healthcare ecosystem, follow the report-to-review workflow, and see how
                    AI assistance remains anchored to professional review.
                  </p>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <a href="#ai-ocr" className={buttonVariants({ size: 'lg' })}>
                      Review AI & OCR <ArrowRight aria-hidden="true" size={18} />
                    </a>
                    <a href="#workflow" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
                      How Clinora Works
                    </a>
                  </div>
                </div>
              </GlassPanel>
            </Reveal>
          </Container>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
