import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

export function Reveal({
  children,
  className = '',
  delay = 0,
  distance = 28,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: distance, scale: 0.985 }}
      whileInView={reducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.22, margin: '-24px 0px' }}
      transition={{ duration: 0.56, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
