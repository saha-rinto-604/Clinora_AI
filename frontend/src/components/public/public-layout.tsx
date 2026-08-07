import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { SkipLink } from '../ui';
import { PublicFooter } from './public-footer';
import { PublicNavbar } from './public-navbar';

export function PublicLayout() {
  const location = useLocation();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname, reducedMotion]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#020617] text-slate-50">
      <SkipLink>Skip to main content</SkipLink>
      <PublicNavbar />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
          transition={{ duration: reducedMotion ? 0 : 0.34, ease: [0.22, 1, 0.36, 1] }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
      <PublicFooter />
    </div>
  );
}
