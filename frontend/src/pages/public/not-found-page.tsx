import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'react-router';
import { Container, GlassPanel } from '../../components/ui';
import { buttonVariants } from '../../components/ui/button-variants';
import { BiomedicalPageBackground } from '../../components/public/biomedical-page-background';
import { PageMeta } from '../../components/public/page-meta';

export function NotFoundPage() {
  return (
    <main id="main-content" className="relative isolate grid min-h-[70vh] place-items-center overflow-hidden py-20">
      <PageMeta
        title="Clinora AI — Page Not Found"
        description="The requested Clinora AI public page could not be found."
      />
      <BiomedicalPageBackground variant="minimal" />
      <Container>
        <GlassPanel className="mx-auto max-w-3xl border-cyan-300/10 bg-slate-950/58 p-8 text-center sm:p-12">
          <Compass aria-hidden="true" className="mx-auto text-cyan-300" size={34} />
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">404 · Page not found</p>
          <h1 className="mt-5 text-balance text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
            This page is outside the Clinora public map.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-slate-400">
            The address may have changed, or the page may not exist. Return to the public website or explore the
            platform overview.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/" className={buttonVariants({ size: 'lg' })}>
              <ArrowLeft aria-hidden="true" size={18} /> Back to Home
            </Link>
            <Link to="/features" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
              Explore Features
            </Link>
          </div>
        </GlassPanel>
      </Container>
    </main>
  );
}
