import { motion, useReducedMotion } from 'framer-motion';

const basePairs = [
  [122, 84, 206, 84],
  [106, 120, 220, 120],
  [100, 158, 226, 158],
  [108, 196, 218, 196],
  [126, 234, 202, 234],
  [142, 272, 186, 272],
  [126, 310, 202, 310],
  [108, 348, 218, 348],
  [100, 386, 226, 386],
  [106, 424, 220, 424],
  [122, 462, 206, 462],
] as const;

const networkEdges = [
  [430, 100, 520, 144],
  [520, 144, 606, 102],
  [520, 144, 574, 226],
  [574, 226, 662, 190],
  [574, 226, 642, 300],
  [642, 300, 718, 250],
  [642, 300, 690, 386],
  [690, 386, 774, 344],
  [430, 100, 462, 202],
  [462, 202, 574, 226],
  [462, 202, 420, 310],
  [420, 310, 512, 356],
  [512, 356, 642, 300],
] as const;

const networkNodes = [
  [430, 100],
  [520, 144],
  [606, 102],
  [574, 226],
  [662, 190],
  [642, 300],
  [718, 250],
  [690, 386],
  [774, 344],
  [462, 202],
  [420, 310],
  [512, 356],
] as const;

export function LandingBiomedicalVisual() {
  const reducedMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-clinical-ambient-visual="landing"
      data-clinical-ambient-motion={reducedMotion ? 'reduced' : 'ambient'}
    >
      <div className="biomedical-grid absolute inset-0 opacity-35" />
      <div className="absolute -left-32 top-16 h-[34rem] w-[34rem] rounded-full bg-cyan-500/10 blur-[120px]" />
      <motion.div
        className="absolute -right-24 top-20 h-[30rem] w-[30rem] rounded-full bg-teal-400/10 blur-[120px]"
        animate={reducedMotion ? undefined : { x: [0, -18, 0], y: [0, 14, 0], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 left-[38%] h-80 w-80 rounded-full bg-rose-500/5 blur-[110px]"
        animate={reducedMotion ? undefined : { x: [0, 20, 0], opacity: [0.25, 0.45, 0.25] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />

      <svg
        className="absolute -right-12 top-10 h-[27rem] w-[19rem] opacity-35 md:hidden"
        viewBox="0 0 260 420"
        role="presentation"
      >
        <defs>
          <linearGradient id="mobileDnaStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <motion.g
          animate={reducedMotion ? undefined : { y: [0, -6, 0], opacity: [0.55, 0.82, 0.55] }}
          transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path
            d="M104 18 C38 72, 38 132, 104 190 C170 248, 170 310, 104 402"
            fill="none"
            stroke="url(#mobileDnaStroke)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M184 18 C250 72, 250 132, 184 190 C118 248, 118 310, 184 402"
            fill="none"
            stroke="url(#mobileDnaStroke)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {[58, 102, 146, 190, 234, 278, 322, 366].map((y, index) => {
            const inset = index % 4 === 0 ? 12 : index % 4 === 1 ? 4 : index % 4 === 2 ? -4 : 4;
            return (
              <line
                key={y}
                x1={92 + inset}
                y1={y}
                x2={196 - inset}
                y2={y}
                stroke="#67E8F9"
                strokeOpacity="0.2"
                strokeWidth="1.2"
              />
            );
          })}
        </motion.g>
        <motion.g
          animate={reducedMotion ? undefined : { opacity: [0.28, 0.52, 0.28] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        >
          <line x1="34" y1="96" x2="76" y2="130" stroke="#38BDF8" strokeOpacity="0.18" />
          <line x1="76" y1="130" x2="48" y2="176" stroke="#2DD4BF" strokeOpacity="0.18" />
          <line x1="76" y1="130" x2="122" y2="116" stroke="#38BDF8" strokeOpacity="0.14" />
          <circle cx="34" cy="96" r="3" fill="#38BDF8" fillOpacity="0.42" />
          <circle cx="76" cy="130" r="4" fill="#2DD4BF" fillOpacity="0.46" />
          <circle cx="48" cy="176" r="2.8" fill="#38BDF8" fillOpacity="0.38" />
          <circle cx="122" cy="116" r="2.6" fill="#2DD4BF" fillOpacity="0.34" />
        </motion.g>
      </svg>

      <svg
        className="absolute right-[-6rem] top-20 hidden h-[34rem] w-[54rem] opacity-70 md:block lg:right-[-2rem] xl:right-[2%]"
        viewBox="0 0 820 540"
        role="presentation"
      >
        <defs>
          <linearGradient id="dnaStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id="networkStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#14B8A6" stopOpacity="0.38" />
          </linearGradient>
          <filter id="softGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <motion.g
          animate={reducedMotion ? undefined : { y: [0, -10, 0], opacity: [0.66, 0.9, 0.66] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          filter="url(#softGlow)"
        >
          <path
            d="M132 52 C48 116, 48 184, 132 248 C216 312, 216 380, 132 488"
            fill="none"
            stroke="url(#dnaStroke)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M194 52 C278 116, 278 184, 194 248 C110 312, 110 380, 194 488"
            fill="none"
            stroke="url(#dnaStroke)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {basePairs.map(([x1, y1, x2, y2]) => (
            <line
              key={`${y1}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#67E8F9"
              strokeOpacity="0.28"
              strokeWidth="1.5"
            />
          ))}
        </motion.g>

        <motion.g
          data-biomedical-network="true"
          animate={reducedMotion ? undefined : { opacity: [0.45, 0.7, 0.45] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        >
          {networkEdges.map(([x1, y1, x2, y2], index) => (
            <line
              key={`edge-${index}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="url(#networkStroke)"
              strokeWidth="1.2"
            />
          ))}
          {networkNodes.map(([cx, cy], index) => (
            <circle
              key={`node-${index}`}
              cx={cx}
              cy={cy}
              r={index % 3 === 0 ? 4 : 2.7}
              fill={index % 2 === 0 ? '#38BDF8' : '#2DD4BF'}
              fillOpacity="0.55"
            />
          ))}
        </motion.g>

        <motion.g
          data-biomedical-particles="true"
          animate={reducedMotion ? undefined : { y: [0, -8, 0], opacity: [0.25, 0.5, 0.25] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        >
          <circle cx="356" cy="116" r="2" fill="#E0F2FE" />
          <circle cx="738" cy="130" r="1.8" fill="#99F6E4" />
          <circle cx="382" cy="402" r="2.2" fill="#E0F2FE" />
          <circle cx="754" cy="438" r="1.6" fill="#99F6E4" />
          <circle cx="568" cy="458" r="1.8" fill="#E0F2FE" />
          <circle cx="314" cy="292" r="1.4" fill="#99F6E4" />
        </motion.g>
      </svg>

      <motion.div
        className="blood-cell blood-cell-a"
        data-biomedical-cell="true"
        animate={reducedMotion ? undefined : { y: [0, -18, 0], x: [0, 8, 0], rotate: [0, 4, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="blood-cell blood-cell-b"
        data-biomedical-cell="true"
        animate={reducedMotion ? undefined : { y: [0, 14, 0], x: [0, -10, 0], rotate: [0, -5, 0] }}
        transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut', delay: 1.3 }}
      />
      <motion.div
        className="blood-cell blood-cell-c"
        data-biomedical-cell="true"
        animate={reducedMotion ? undefined : { y: [0, -12, 0], x: [0, 7, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 0.7 }}
      />
      <motion.div
        className="blood-cell blood-cell-d hidden lg:block"
        data-biomedical-cell="true"
        animate={reducedMotion ? undefined : { y: [0, 16, 0], x: [0, -6, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
    </div>
  );
}
