import { ArrowRight, CheckCircle2, FileCheck2, Microscope, Stethoscope } from 'lucide-react';
import { Link } from 'react-router';
import { PageMeta } from '../../components/public/page-meta';
import { PublicPageHero } from '../../components/public/public-page-hero';
import { Reveal } from '../../components/public/reveal';
import { Container, GlassPanel } from '../../components/ui';

const paths = [
  {
    title: 'Apply as Doctor',
    copy: 'Submit your professional profile, medical registration details, qualifications, and required supporting evidence.',
    to: '/apply/doctor',
    icon: Stethoscope,
  },
  {
    title: 'Apply as Researcher',
    copy: 'Submit your institutional context, research profile, intended use, and supporting evidence when relevant.',
    to: '/apply/researcher',
    icon: Microscope,
  },
] as const;

export function ProfessionalAccessPage() {
  return (
    <main id="main-content">
      <PageMeta
        title="Clinora AI — Professional Access"
        description="Apply for Doctor or Researcher access, or securely return to an existing Clinora professional application."
      />

      <PublicPageHero
        eyebrow="Professional access"
        title="Professional access starts with review, not account creation."
        copy="Doctors and Researchers apply through a private professional-review workflow. Starting an application does not create a Clinora platform account or grant a professional role."
        variant="research"
        primaryAction={{ label: 'Apply as Doctor', to: '/apply/doctor' }}
        secondaryAction={{ label: 'Apply as Researcher', to: '/apply/researcher' }}
        aside={
          <GlassPanel className="border-cyan-300/12 bg-slate-950/58 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Separate access boundary</p>
            <div className="mt-5 grid gap-3 text-sm leading-6 text-slate-400">
              <span className="flex gap-3">
                <CheckCircle2 size={17} className="mt-1 shrink-0 text-teal-300" aria-hidden="true" />
                Applicants are not Clinora RBAC users.
              </span>
              <span className="flex gap-3">
                <FileCheck2 size={17} className="mt-1 shrink-0 text-cyan-300" aria-hidden="true" />
                Professional evidence remains inside the private application workflow.
              </span>
              <span className="flex gap-3">
                <CheckCircle2 size={17} className="mt-1 shrink-0 text-teal-300" aria-hidden="true" />
                Doctor or Researcher platform access begins only after review and activation.
              </span>
            </div>
          </GlassPanel>
        }
      />

      <section className="border-b border-white/5 py-16 lg:py-20">
        <Container>
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <div className="grid gap-5 md:grid-cols-2">
                {paths.map(({ title, copy, to, icon: Icon }) => (
                  <GlassPanel key={to} className="h-full border-white/10 bg-white/[0.035] p-6">
                    <Icon size={22} className="text-cyan-300" aria-hidden="true" />
                    <h2 className="mt-5 text-xl font-semibold text-white">{title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
                    <Link
                      to={to}
                      className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-cyan-300 transition hover:bg-white/[0.04] hover:text-cyan-200"
                    >
                      Start application <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                  </GlassPanel>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.06}>
              <GlassPanel className="mt-6 border-teal-300/12 bg-teal-300/[0.025] p-6 sm:p-7">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-300">Already applied?</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">Continue or check your application</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                      If this browser still has an active applicant session, your application opens directly. Otherwise,
                      Clinora will email a short-lived, single-use secure sign-in link to the verified application
                      address.
                    </p>
                  </div>
                  <Link
                    to="/application/status"
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 px-5 text-sm font-semibold text-slate-950 shadow-[0_10px_28px_rgba(14,165,233,.14)]"
                  >
                    Continue application <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </GlassPanel>
            </Reveal>
          </div>
        </Container>
      </section>
    </main>
  );
}
