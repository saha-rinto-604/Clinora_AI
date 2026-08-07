import { AlertTriangle, BrainCircuit, HeartPulse, Scale, ShieldCheck } from 'lucide-react';
import { Badge, Container, GlassPanel } from '../../components/ui';
import { PageMeta } from '../../components/public/page-meta';
import { PublicPageHero } from '../../components/public/public-page-hero';
import { Reveal } from '../../components/public/reveal';
import { SectionHeader } from '../../components/landing/section-header';

const sections = [
  [
    'Platform purpose',
    'Clinora is designed as a clinical intelligence and healthcare coordination platform. Public pages describe product capabilities and planned workflows rather than providing clinical services directly.',
    Scale,
  ],
  [
    'AI advisory limitation',
    'AI-assisted outputs are intended to support qualified healthcare professionals. They are not autonomous diagnoses, prescriptions, or substitutes for professional medical judgment.',
    BrainCircuit,
  ],
  [
    'Emergency assistance limitation',
    'Emergency Blood Assistance is intended to support coordination and does not guarantee blood availability, compatibility, response time, or emergency medical outcomes.',
    HeartPulse,
  ],
  [
    'Responsible use',
    'Users of future authenticated services will be expected to provide accurate information, protect account access, respect role permissions, and use clinical information responsibly.',
    ShieldCheck,
  ],
] as const;

export function TermsPage() {
  return (
    <main id="main-content">
      <PageMeta
        title="Clinora AI — Terms"
        description="Read the high-level product use, AI advisory, emergency assistance, and legal-review principles for the Clinora AI public website."
      />
      <PublicPageHero
        eyebrow="Terms & conditions"
        title="Clear boundaries for a healthcare intelligence platform."
        copy="These public terms describe the intended product boundaries around AI assistance, professional medical judgment, emergency coordination, responsible use, and future authenticated services."
        variant="minimal"
        primaryAction={{ label: 'Privacy Principles', to: '/privacy' }}
        secondaryAction={{ label: 'Read FAQ', to: '/faq' }}
        aside={
          <GlassPanel className="border-white/10 bg-slate-950/58 p-7">
            <AlertTriangle aria-hidden="true" className="text-amber-300" size={30} />
            <Badge variant="warning" className="mt-6">
              Draft product terms
            </Badge>
            <h2 className="mt-5 text-2xl font-semibold text-white">
              Legal review is required before commercial launch.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              This page is intentionally high-level and does not invent governing law, liability language, regulatory
              status, or jurisdiction-specific obligations.
            </p>
          </GlassPanel>
        }
      />

      <section className="border-b border-white/5 py-20 lg:py-28">
        <Container>
          <Reveal>
            <SectionHeader
              eyebrow="Product boundaries"
              title="The public website explains the product without pretending future services are already live."
              copy="These principles are designed to keep the relationship between informational content, future healthcare workflows, AI assistance, and professional responsibility clear."
              align="center"
            />
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {sections.map(([title, copy, Icon], index) => (
              <Reveal key={title} delay={index * 0.06}>
                <GlassPanel className="h-full border-white/9 bg-white/[0.035] p-7">
                  <Icon aria-hidden="true" className={index === 2 ? 'text-rose-300' : 'text-cyan-300'} size={24} />
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
          <div className="grid gap-12 lg:grid-cols-[.82fr_1.18fr]">
            <Reveal>
              <SectionHeader
                eyebrow="Future authenticated services"
                title="Account responsibilities begin only when those services are implemented."
                copy="Registration, login, protected routes, healthcare records, report upload, appointments, and role-based application workflows belong to later implementation phases and are not enabled by this public website."
              />
            </Reveal>
            <Reveal delay={0.06}>
              <GlassPanel className="border-white/9 bg-slate-950/52 p-7">
                <ul className="space-y-4 text-sm leading-7 text-slate-300">
                  <li>Account access will require secure authentication and role-based authorization.</li>
                  <li>
                    Clinical information will be subject to ownership, consent, organizational, and professional access
                    rules.
                  </li>
                  <li>AI-assisted information will remain advisory and subject to qualified professional review.</li>
                  <li>Research use will remain separated from personally identifiable patient information.</li>
                  <li>
                    Service availability, retention, dispute, and jurisdiction-specific legal clauses require final
                    legal review.
                  </li>
                </ul>
              </GlassPanel>
            </Reveal>
          </div>
        </Container>
      </section>

      <section className="py-20 lg:py-28">
        <Container>
          <Reveal>
            <GlassPanel className="border-amber-300/12 bg-amber-300/[0.025] p-7 lg:p-10">
              <Badge variant="warning">Legal review required</Badge>
              <h2 className="mt-5 text-2xl font-semibold text-white">
                Final production terms must be reviewed by qualified counsel.
              </h2>
              <p className="mt-4 max-w-4xl text-base leading-8 text-slate-300">
                The final terms should define applicable jurisdiction, user rights and obligations, service
                availability, intellectual-property terms, liability, dispute handling, healthcare-specific disclaimers,
                and any regulatory obligations relevant to the production deployment.
              </p>
            </GlassPanel>
          </Reveal>
        </Container>
      </section>
    </main>
  );
}
