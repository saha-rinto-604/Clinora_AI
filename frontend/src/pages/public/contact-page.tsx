import { CircleHelp, Mail, MessageSquareText, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import { Badge, Container, GlassPanel } from '../../components/ui';
import { buttonVariants } from '../../components/ui/button-variants';
import { PageMeta } from '../../components/public/page-meta';
import { PublicPageHero } from '../../components/public/public-page-hero';
import { Reveal } from '../../components/public/reveal';
import { SectionHeader } from '../../components/landing/section-header';

export function ContactPage() {
  return (
    <main id="main-content">
      <PageMeta
        title="Clinora AI — Contact"
        description="Contact information and public support guidance for the Clinora AI platform."
      />
      <PublicPageHero
        eyebrow="Contact"
        title="Questions about the Clinora platform?"
        copy="This public website explains the product vision and planned healthcare workflows. A production contact channel will be published before external support or message submission is enabled."
        variant="minimal"
        primaryAction={{ label: 'Read the FAQ', to: '/faq' }}
        secondaryAction={{ label: 'About Clinora', to: '/about' }}
        aside={
          <GlassPanel className="border-white/10 bg-slate-950/58 p-7">
            <MessageSquareText aria-hidden="true" className="text-cyan-300" size={30} />
            <Badge className="mt-6">No fake submission</Badge>
            <h2 className="mt-5 text-2xl font-semibold text-white">Contact delivery is not connected yet.</h2>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              Clinora will not display a form that silently discards messages or pretends a message was delivered.
            </p>
          </GlassPanel>
        }
      />

      <section className="border-b border-white/5 py-20 lg:py-28">
        <Container>
          <Reveal>
            <SectionHeader
              eyebrow="Contact guidance"
              title="Use the public resources while the official contact channel is being prepared."
              copy="The website already provides detailed information about the platform, AI safety model, OCR workflow, research approach, privacy principles, and emergency coordination."
              align="center"
            />
          </Reveal>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <Reveal>
              <GlassPanel className="h-full border-white/9 bg-white/[0.035] p-6">
                <CircleHelp aria-hidden="true" className="text-cyan-300" size={24} />
                <h2 className="mt-5 text-lg font-semibold text-white">Common questions</h2>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Read clear answers about AI, OCR, research, privacy, and healthcare workflows.
                </p>
                <Link
                  to="/faq"
                  className="mt-6 inline-flex min-h-11 items-center rounded-xl text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  Open FAQ
                </Link>
              </GlassPanel>
            </Reveal>
            <Reveal delay={0.06}>
              <GlassPanel className="h-full border-white/9 bg-white/[0.035] p-6">
                <ShieldCheck aria-hidden="true" className="text-teal-300" size={24} />
                <h2 className="mt-5 text-lg font-semibold text-white">Privacy information</h2>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Review the design principles Clinora uses for protected clinical information and research boundaries.
                </p>
                <Link
                  to="/privacy"
                  className="mt-6 inline-flex min-h-11 items-center rounded-xl text-sm font-semibold text-teal-300 hover:text-teal-200"
                >
                  Read privacy principles
                </Link>
              </GlassPanel>
            </Reveal>
            <Reveal delay={0.12}>
              <GlassPanel className="h-full border-white/9 bg-white/[0.035] p-6">
                <Mail aria-hidden="true" className="text-slate-300" size={24} />
                <h2 className="mt-5 text-lg font-semibold text-white">Official contact channel</h2>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  An approved support email or delivery provider has not yet been published for this public website.
                </p>
                <span className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-slate-500">
                  Channel pending
                </span>
              </GlassPanel>
            </Reveal>
          </div>
        </Container>
      </section>

      <section className="py-20 lg:py-28">
        <Container>
          <Reveal>
            <GlassPanel className="grid gap-7 border-cyan-300/10 bg-cyan-300/[0.025] p-7 lg:grid-cols-[1fr_auto] lg:items-center lg:p-10">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Product information</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
                  Explore the product before reaching out.
                </h2>
                <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
                  The Features and About pages provide the clearest overview of what Clinora is designed to become.
                </p>
              </div>
              <Link to="/features" className={buttonVariants({ size: 'lg' })}>
                Explore Features
              </Link>
            </GlassPanel>
          </Reveal>
        </Container>
      </section>
    </main>
  );
}
