import { motion, useReducedMotion } from 'framer-motion';
import { BiomedicalBackground } from '../landing/biomedical-background';

export type BiomedicalBackgroundVariant =
  'network' | 'ai' | 'ocr' | 'emergency' | 'research' | 'dna' | 'minimal' | 'security';

const variantGlow: Record<BiomedicalBackgroundVariant, string> = {
  network: 'from-cyan-400/8 via-transparent to-teal-400/6',
  ai: 'from-cyan-400/10 via-blue-400/4 to-teal-400/6',
  ocr: 'from-sky-400/8 via-transparent to-cyan-300/5',
  emergency: 'from-rose-400/9 via-transparent to-cyan-400/4',
  research: 'from-teal-400/9 via-transparent to-cyan-400/6',
  dna: 'from-cyan-400/8 via-transparent to-teal-400/6',
  minimal: 'from-slate-400/3 via-transparent to-cyan-400/3',
  security: 'from-cyan-400/6 via-transparent to-indigo-400/4',
};

/*
 * Phase 3C uses the About-page composition as the canonical public-page
 * biomedical brand layout. Page variants may change tone/intensity, but DNA,
 * blood-cell, and network placement stays stable across the public website.
 */
const MASTER_COMPOSITION_CLASS =
  'origin-center md:-translate-x-[5%] md:-translate-y-[7%] md:scale-[1.08] lg:-translate-x-[8%]';
const MASTER_ORBIT_CLASS = 'right-[22%] top-16';

const compositionOpacityClass: Record<BiomedicalBackgroundVariant, string> = {
  network: '',
  ai: '',
  ocr: '',
  emergency: '',
  research: '',
  dna: '',
  minimal: 'opacity-60',
  security: 'opacity-80',
};

export function BiomedicalPageBackground({ variant = 'network' }: { variant?: BiomedicalBackgroundVariant }) {
  const reducedMotion = useReducedMotion();
  const emergency = variant === 'emergency';
  const minimal = variant === 'minimal';

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div
        className={`absolute inset-0 transition-transform duration-500 ${MASTER_COMPOSITION_CLASS} ${compositionOpacityClass[variant]}`}
      >
        <BiomedicalBackground />
      </div>

      <div className={`absolute inset-0 bg-gradient-to-br ${variantGlow[variant]}`} />
      {minimal ? <div className="absolute inset-0 bg-[#020617]/28" /> : null}

      <motion.div
        className={`absolute -right-20 top-16 h-72 w-72 rounded-full blur-[120px] ${emergency ? 'bg-rose-400/8' : 'bg-cyan-400/7'}`}
        animate={reducedMotion ? undefined : { x: [0, -14, 0], y: [0, 10, 0], opacity: [0.4, 0.68, 0.4] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="absolute -left-24 bottom-10 h-64 w-64 rounded-full bg-teal-400/6 blur-[120px]"
        animate={reducedMotion ? undefined : { x: [0, 12, 0], y: [0, -8, 0], opacity: [0.32, 0.55, 0.32] }}
        transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
      />

      {!minimal ? (
        <div className={`public-orbit public-orbit-${variant} absolute h-60 w-60 opacity-30 ${MASTER_ORBIT_CLASS}`} />
      ) : null}
    </div>
  );
}
