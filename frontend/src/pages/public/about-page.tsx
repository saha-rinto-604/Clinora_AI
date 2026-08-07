import { BrainCircuit, HeartHandshake, Network, ShieldCheck, Stethoscope, UsersRound } from 'lucide-react';
import { Container, GlassPanel } from '../../components/ui';
import { PageMeta } from '../../components/public/page-meta';
import { PublicCta } from '../../components/public/public-cta';
import { PublicPageHero } from '../../components/public/public-page-hero';
import { Reveal } from '../../components/public/reveal';
import { SectionHeader } from '../../components/landing/section-header';

const principles = [
  [
    'Human-centered AI',
    'Technology should assist clinical judgment rather than replace healthcare professionals.',
    Stethoscope,
  ],
  [
    'Explainable intelligence',
    'AI-assisted outputs should be understandable, reviewable, and accountable.',
    BrainCircuit,
  ],
  [
    'Connected healthcare',
    'Patients, clinicians, hospitals, researchers, blood banks, and administrators should work in one coherent ecosystem.',
    Network,
  ],
  [
    'Privacy by design',
    'Sensitive healthcare information should remain protected through clear access and data boundaries.',
    ShieldCheck,
  ],
] as const;

export function AboutPage() {
  return (
    <main id="main-content">
      <PageMeta
        title="Clinora AI — About"
        description="Learn about Clinora AI's mission, human-centered clinical intelligence philosophy, connected healthcare ecosystem, and responsible product direction."
      />
      <PublicPageHero
        eyebrow="About Clinora"
        title="Building a more connected clinical intelligence ecosystem."
        copy="Clinora AI is envisioned as a healthcare platform where artificial intelligence supports professional judgment, patients better understand their care, healthcare organizations coordinate more effectively, and research can advance without weakening privacy."
        variant="dna"
        primaryAction={{ label: 'Explore the Platform', to: '/features' }}
        secondaryAction={{ label: 'Research Vision', to: '/research' }}
        aside={
          <GlassPanel className="border-cyan-300/12 bg-slate-950/55 p-7">
            <HeartHandshake aria-hidden="true" className="text-cyan-300" size={30} />
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Mission</p>
            <p className="mt-3 text-2xl font-semibold leading-tight text-white">
              Use responsible technology to make healthcare workflows clearer, more connected, and more supportive of
              human expertise.
            </p>
          </GlassPanel>
        }
      />

      <section className="border-b border-white/5 py-20 lg:py-28">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[.78fr_1.22fr]">
            <Reveal>
              <SectionHeader
                eyebrow="Product philosophy"
                title="Clinical intelligence should strengthen people, not sideline them."
                copy="Clinora is built around a simple principle: AI can help healthcare professionals process complex information, but responsibility and judgment must remain human."
              />
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2">
              {principles.map(([title, copy, Icon], index) => (
                <Reveal key={title} delay={index * 0.06}>
                  <GlassPanel className="h-full border-white/9 bg-white/[0.035] p-6">
                    <Icon
                      aria-hidden="true"
                      className={index % 2 === 0 ? 'text-cyan-300' : 'text-teal-300'}
                      size={23}
                    />
                    <h2 className="mt-5 text-lg font-semibold text-white">{title}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-400">{copy}</p>
                  </GlassPanel>
                </Reveal>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="border-b border-white/5 bg-slate-950/45 py-20 lg:py-28">
        <Container>
          <Reveal>
            <SectionHeader
              eyebrow="Healthcare ecosystem"
              title="Six roles, each with a distinct responsibility."
              copy="Clinora is designed to connect the people and organizations involved in care, operations, emergency support, research, and governance without collapsing their responsibilities into one generic interface."
              align="center"
            />
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              'Patient',
              'Doctor',
              'Hospital Administrator',
              'Researcher',
              'Blood Bank Staff',
              'System Administrator',
            ].map((role, index) => (
              <Reveal key={role} delay={index * 0.055}>
                <div className="rounded-[var(--radius-component)] border border-white/8 bg-white/[0.03] p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-300/14">
                  <span className="text-xs font-bold text-slate-600">0{index + 1}</span>
                  <p className="mt-5 font-semibold text-white">{role}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <div className="mt-10 flex items-center justify-center gap-3 text-sm text-slate-400">
              <UsersRound aria-hidden="true" className="text-teal-300" size={20} /> One connected platform,
              role-specific experiences.
            </div>
          </Reveal>
        </Container>
      </section>

      <section className="py-20 lg:py-28">
        <Container>
          <Reveal>
            <GlassPanel className="border-white/9 bg-white/[0.035] p-8 lg:p-10">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-300">
                Responsible future direction
              </p>
              <h2 className="mt-5 max-w-4xl text-3xl font-semibold tracking-[-0.04em] text-white">
                A modular foundation that can evolve alongside healthcare technology.
              </h2>
              <p className="mt-5 max-w-4xl text-base leading-8 text-slate-300">
                The Clinora vision anticipates future interoperability with electronic health records, wearable devices,
                telemedicine, medical imaging, and healthcare standards. Those capabilities are future-facing and are
                not presented here as implemented product functionality.
              </p>
            </GlassPanel>
          </Reveal>
        </Container>
      </section>

      <PublicCta
        title="Explore how Clinora turns that philosophy into a product experience."
        copy="The platform pages explain the clinical intelligence, OCR, emergency coordination, and research experiences that make up the public Clinora vision."
        primary={{ label: 'Explore Features', to: '/features' }}
        secondary={{ label: 'AI Clinical Intelligence', to: '/ai-clinical-intelligence' }}
      />
    </main>
  );
}
