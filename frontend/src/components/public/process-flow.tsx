import { ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

export function ProcessFlow({
  steps,
  label,
  tone = 'cyan',
}: {
  steps: readonly string[];
  label: string;
  tone?: 'cyan' | 'rose' | 'teal';
}) {
  const reducedMotion = useReducedMotion();
  const tones = {
    cyan: 'text-cyan-300 border-cyan-300/12 hover:border-cyan-300/22',
    rose: 'text-rose-300 border-rose-300/12 hover:border-rose-300/22',
    teal: 'text-teal-300 border-teal-300/12 hover:border-teal-300/22',
  };

  return (
    <ol aria-label={label} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {steps.map((step, index) => (
        <motion.li
          key={step}
          initial={reducedMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
          whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.45 }}
          transition={{ duration: 0.5, delay: index * 0.075, ease: [0.22, 1, 0.36, 1] }}
          className={`group relative min-h-32 rounded-[var(--radius-component)] border bg-white/[0.035] p-5 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.05] ${tones[tone]}`}
        >
          <span className="text-xs font-bold tabular-nums">{String(index + 1).padStart(2, '0')}</span>
          <p className="mt-8 text-sm font-semibold leading-6 text-slate-200">{step}</p>
          {index < steps.length - 1 ? (
            <ArrowRight
              aria-hidden="true"
              className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-slate-600 xl:block"
              size={18}
            />
          ) : null}
        </motion.li>
      ))}
    </ol>
  );
}
