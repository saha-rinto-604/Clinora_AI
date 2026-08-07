import { BarChart3, BrainCircuit, Database, Fingerprint, Microscope, Network, ShieldCheck } from 'lucide-react';
import { Container, GlassPanel } from '../../components/ui';
import { PageMeta } from '../../components/public/page-meta';
import { PublicCta } from '../../components/public/public-cta';
import { PublicPageHero } from '../../components/public/public-page-hero';
import { Reveal } from '../../components/public/reveal';
import { SectionHeader } from '../../components/landing/section-header';

const capabilities = [
  [
    'Anonymized datasets',
    'Research experiences are designed around de-identified clinical information rather than personally identifiable patient records.',
    Database,
  ],
  [
    'Disease trend analysis',
    'Explore population-level patterns and healthcare trends using governed research data.',
    BarChart3,
  ],
  [
    'AI model evaluation',
    'Support controlled evaluation of AI behavior, outputs, and professional feedback.',
    BrainCircuit,
  ],
  [
    'Research collaboration',
    'Provide governed spaces for researchers to work together without weakening privacy boundaries.',
    Network,
  ],
] as const;

export function ResearchPage() {
  return (
    <main id="main-content">
      <PageMeta
        title="Clinora AI — Research"
        description="Explore Clinora's privacy-conscious research vision for anonymized clinical datasets, disease analytics, AI model evaluation, and governed collaboration."
      />
      <PublicPageHero
        eyebrow="Research intelligence"
        title="Clinical data can inform research without exposing patient identity."
        copy="Clinora is designed to support medical research through anonymized datasets, disease analytics, AI evaluation, and controlled collaboration while keeping personally identifiable information outside the researcher experience."
        variant="research"
        primaryAction={{ label: 'Explore Platform Features', to: '/features' }}
        secondaryAction={{ label: 'Privacy Principles', to: '/privacy' }}
        aside={
          <GlassPanel className="overflow-hidden border-teal-300/12 bg-slate-950/58 p-6">
            <div className="flex items-center gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-teal-300/12 bg-teal-300/7 text-teal-200">
                <Microscope aria-hidden="true" size={23} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-300">Research boundary</p>
                <p className="mt-1 text-lg font-semibold text-white">De-identified by design</p>
              </div>
            </div>
            <div className="mt-7 grid gap-3">
              <div className="rounded-2xl border border-rose-300/10 bg-rose-300/[0.025] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-300">
                  Identifiable clinical data
                </p>
                <p className="mt-2 text-sm text-slate-400">Protected outside the researcher experience.</p>
              </div>
              <div className="flex justify-center text-slate-600">↓ governed transformation ↓</div>
              <div className="rounded-2xl border border-teal-300/12 bg-teal-300/[0.035] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-300">Research dataset</p>
                <p className="mt-2 text-sm text-slate-300">Anonymized information for approved research workflows.</p>
              </div>
            </div>
          </GlassPanel>
        }
      />

      <section className="border-b border-white/5 py-20 lg:py-28">
        <Container>
          <Reveal>
            <SectionHeader
              eyebrow="Research capabilities"
              title="A governed environment for healthcare analysis and AI evaluation."
              copy="Research tools are designed to support scientific investigation while preserving the privacy boundary between identifiable care records and research data."
              align="center"
            />
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {capabilities.map(([title, copy, Icon], index) => (
              <Reveal key={title} delay={index * 0.06}>
                <GlassPanel className="group h-full border-white/9 bg-white/[0.035] p-7 transition duration-300 hover:-translate-y-1 hover:border-teal-300/16">
                  <Icon aria-hidden="true" className="text-teal-300" size={24} />
                  <h2 className="mt-6 text-xl font-semibold text-white">{title}</h2>
                  <p className="mt-3 text-sm leading-7 text-slate-400">{copy}</p>
                </GlassPanel>
              </Reveal>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-b border-white/5 bg-slate-950/45 py-20 lg:py-28">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
            <Reveal>
              <SectionHeader
                eyebrow="Privacy boundary"
                title="Research value should not require exposing patient identity."
                copy="Clinora separates clinical identity from the researcher experience so analysis can focus on governed, anonymized information."
              />
            </Reveal>
            <Reveal delay={0.06}>
              <GlassPanel className="border-white/9 bg-slate-950/52 p-7">
                <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  <div className="rounded-[1.4rem] border border-white/8 bg-white/[0.035] p-5">
                    <Fingerprint aria-hidden="true" className="text-slate-500" size={22} />
                    <p className="mt-4 font-semibold text-white">Clinical identity</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Personally identifiable information remains protected.
                    </p>
                  </div>
                  <ShieldCheck aria-hidden="true" className="mx-auto text-teal-300" size={25} />
                  <div className="rounded-[1.4rem] border border-teal-300/12 bg-teal-300/[0.035] p-5">
                    <Database aria-hidden="true" className="text-teal-300" size={22} />
                    <p className="mt-4 font-semibold text-white">Research environment</p>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Anonymized, governed information for approved analysis.
                    </p>
                  </div>
                </div>
              </GlassPanel>
            </Reveal>
          </div>
        </Container>
      </section>

      <PublicCta
        title="Research is one part of a connected healthcare ecosystem."
        copy="See how Clinora connects role-specific healthcare experiences while maintaining clear privacy and responsibility boundaries."
        primary={{ label: 'Explore Features', to: '/features' }}
        secondary={{ label: 'Read Privacy Principles', to: '/privacy' }}
      />
    </main>
  );
}
