import { Database, FileLock2, Fingerprint, Microscope, ShieldCheck } from 'lucide-react';
import { Badge, Container, GlassPanel } from '../../components/ui';
import { PageMeta } from '../../components/public/page-meta';
import { PublicPageHero } from '../../components/public/public-page-hero';
import { Reveal } from '../../components/public/reveal';
import { SectionHeader } from '../../components/landing/section-header';

const topics = [
  [
    'Account and identity information',
    'The platform design anticipates account information for authentication, profile management, and role-aware access.',
    Fingerprint,
  ],
  [
    'Medical reports and clinical information',
    'Medical reports and clinical records are treated as sensitive assets intended for authenticated, controlled workflows.',
    FileLock2,
  ],
  [
    'Access control and auditability',
    'Role-based access, resource boundaries, and audit trails are core design principles for sensitive actions.',
    ShieldCheck,
  ],
  [
    'Research anonymization',
    'Research experiences are designed around anonymized clinical datasets rather than personally identifiable patient information.',
    Microscope,
  ],
] as const;

export function PrivacyPage() {
  return (
    <main id="main-content">
      <PageMeta
        title="Clinora AI — Privacy"
        description="Read the privacy and data protection principles that guide the design of Clinora AI's clinical, research, and public website experiences."
      />
      <PublicPageHero
        eyebrow="Privacy principles"
        title="Sensitive healthcare information deserves deliberate boundaries."
        copy="Clinora’s product design treats identity, medical reports, clinical records, research data, and auditability as distinct responsibilities that require controlled access and careful handling."
        variant="security"
        primaryAction={{ label: 'Explore Research', to: '/research' }}
        secondaryAction={{ label: 'Read Terms', to: '/terms' }}
        aside={
          <GlassPanel className="border-cyan-300/12 bg-slate-950/58 p-7">
            <ShieldCheck aria-hidden="true" className="text-cyan-300" size={30} />
            <Badge variant="info" className="mt-6">
              Design principles
            </Badge>
            <h2 className="mt-5 text-2xl font-semibold text-white">
              Privacy by design, without invented certification claims.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              This page describes the intended product approach. It is not a substitute for a jurisdiction-specific
              privacy policy reviewed by qualified legal counsel.
            </p>
          </GlassPanel>
        }
      />

      <section className="border-b border-white/5 py-20 lg:py-28">
        <Container>
          <Reveal>
            <SectionHeader
              eyebrow="Information boundaries"
              title="Different data types require different safeguards."
              copy="The Clinora architecture is designed to keep sensitive healthcare information inside authenticated, role-aware workflows and to separate research use from patient identity."
              align="center"
            />
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {topics.map(([title, copy, Icon], index) => (
              <Reveal key={title} delay={index * 0.06}>
                <GlassPanel className="h-full border-white/9 bg-white/[0.035] p-7">
                  <Icon aria-hidden="true" className={index % 2 === 0 ? 'text-cyan-300' : 'text-teal-300'} size={24} />
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
          <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-start">
            <Reveal>
              <SectionHeader
                eyebrow="Data principles"
                title="Security, minimization, and accountability guide the design."
                copy="Production implementation is expected to apply validated authentication, authorization, encrypted communication, secure storage, anonymization, and audit controls appropriate to the data and workflow."
              />
            </Reveal>
            <Reveal delay={0.06}>
              <GlassPanel className="border-white/9 bg-slate-950/52 p-7">
                <Database aria-hidden="true" className="text-teal-300" size={24} />
                <ul className="mt-6 space-y-4 text-sm leading-7 text-slate-300">
                  <li>
                    Collect and process only information required for an authorized healthcare or platform purpose.
                  </li>
                  <li>Restrict access according to role, consent, ownership, and organizational responsibility.</li>
                  <li>Keep research data anonymized before it enters researcher-facing experiences.</li>
                  <li>Maintain auditability for sensitive operations and security-relevant actions.</li>
                  <li>
                    Avoid exposing secrets, credentials, tokens, or protected clinical content through public clients or
                    logs.
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
                This is product-design information, not a finalized commercial privacy policy.
              </h2>
              <p className="mt-4 max-w-4xl text-base leading-8 text-slate-300">
                Before public deployment involving real users or healthcare data, the final privacy policy, retention
                rules, user rights, regulatory obligations, and jurisdiction-specific requirements must be reviewed and
                approved by qualified legal and compliance professionals.
              </p>
            </GlassPanel>
          </Reveal>
        </Container>
      </section>
    </main>
  );
}
