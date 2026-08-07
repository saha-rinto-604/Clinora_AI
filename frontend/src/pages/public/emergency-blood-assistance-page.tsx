import { BellRing, HeartPulse, Hospital, MapPin, ShieldAlert } from 'lucide-react';
import { Badge, Container, GlassPanel } from '../../components/ui';
import { PageMeta } from '../../components/public/page-meta';
import { ProcessFlow } from '../../components/public/process-flow';
import { PublicCta } from '../../components/public/public-cta';
import { PublicPageHero } from '../../components/public/public-page-hero';
import { Reveal } from '../../components/public/reveal';
import { SectionHeader } from '../../components/landing/section-header';

const coordinationCards = [
  [
    'Nearby blood banks',
    'Help users identify nearby registered blood-bank resources during an emergency workflow.',
    MapPin,
  ],
  [
    'Availability context',
    'Present blood availability information supplied through participating blood-bank workflows.',
    HeartPulse,
  ],
  ['Request status', 'Keep emergency request status visible as participating blood banks respond.', BellRing],
  ['Healthcare coordination', 'Support communication between patients, hospitals, and blood-bank staff.', Hospital],
] as const;

export function EmergencyBloodAssistancePage() {
  return (
    <main id="main-content">
      <PageMeta
        title="Clinora AI — Emergency Blood Assistance"
        description="Learn how Clinora is designed to support emergency blood request coordination, nearby blood-bank discovery, availability information, and status communication."
      />
      <PublicPageHero
        eyebrow="Emergency Blood Assistance"
        title="Faster coordination when every minute matters."
        copy="Clinora is designed to help connect patients, healthcare organizations, and blood banks through a focused emergency coordination workflow built around nearby discovery, availability context, and request status."
        variant="emergency"
        primaryAction={{ label: 'Explore Platform Features', to: '/features' }}
        secondaryAction={{ label: 'Read the FAQ', to: '/faq' }}
        aside={
          <GlassPanel className="overflow-hidden border-rose-300/14 bg-slate-950/58 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-300">Emergency coordination</p>
                <p className="mt-2 text-lg font-semibold text-white">Illustrative request path</p>
              </div>
              <HeartPulse aria-hidden="true" className="text-rose-300" size={30} />
            </div>
            <div className="mt-6 space-y-3">
              {['Need identified', 'Nearby sources considered', 'Availability response', 'Status communicated'].map(
                (item, index) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 rounded-2xl border border-rose-300/8 bg-rose-300/[0.035] px-4 py-3"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full border border-rose-300/14 text-xs font-bold text-rose-200">
                      {index + 1}
                    </span>
                    <span className="text-sm text-slate-300">{item}</span>
                  </div>
                ),
              )}
            </div>
          </GlassPanel>
        }
      />

      <section className="border-b border-white/5 py-20 lg:py-28">
        <Container>
          <Reveal>
            <SectionHeader
              eyebrow="Coordination workflow"
              title="A clear path from urgent need to status communication."
              copy="The workflow focuses on coordination rather than promising supply. Availability depends on participating blood banks and real-world inventory."
              align="center"
            />
          </Reveal>
          <div className="mt-12">
            <ProcessFlow
              label="Emergency Blood Assistance workflow"
              tone="rose"
              steps={[
                'Emergency need',
                'Request coordination',
                'Nearby blood banks',
                'Availability response',
                'Status communication',
              ]}
            />
          </div>
        </Container>
      </section>

      <section className="border-b border-white/5 bg-slate-950/45 py-20 lg:py-28">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr]">
            <Reveal>
              <SectionHeader
                eyebrow="What the service supports"
                title="Designed around time-sensitive healthcare coordination."
                copy="Emergency Blood Assistance brings location, inventory awareness, request handling, and communication concepts into one connected experience."
              />
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2">
              {coordinationCards.map(([title, copy, Icon], index) => (
                <Reveal key={title} delay={index * 0.06}>
                  <GlassPanel className="group h-full border-white/9 bg-white/[0.035] p-6 transition duration-300 hover:-translate-y-1 hover:border-rose-300/16">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl border border-rose-300/12 bg-rose-300/7 text-rose-200">
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
          <Reveal>
            <GlassPanel className="border-rose-300/14 bg-rose-300/[0.035] p-7 lg:p-10">
              <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-start">
                <span className="grid h-12 w-12 place-items-center rounded-2xl border border-rose-300/15 bg-rose-300/7 text-rose-200">
                  <ShieldAlert aria-hidden="true" size={22} />
                </span>
                <div>
                  <Badge variant="danger">Important limitation</Badge>
                  <h2 className="mt-5 text-2xl font-semibold text-white">
                    Coordination support does not guarantee blood availability.
                  </h2>
                  <p className="mt-4 max-w-4xl text-base leading-8 text-slate-300">
                    Real-world blood supply depends on inventory, compatibility, participating organizations, and
                    clinical circumstances. Clinora is designed to improve coordination, not replace emergency medical
                    services or blood-bank procedures.
                  </p>
                </div>
              </div>
            </GlassPanel>
          </Reveal>
        </Container>
      </section>

      <PublicCta
        title="See how Emergency Blood Assistance fits into the wider Clinora ecosystem."
        copy="Explore the platform capabilities that connect healthcare coordination, clinical intelligence, and role-specific workflows."
        primary={{ label: 'Explore Features', to: '/features' }}
        secondary={{ label: 'About Clinora', to: '/about' }}
      />
    </main>
  );
}
