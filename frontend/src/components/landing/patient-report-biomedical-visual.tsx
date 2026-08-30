import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'framer-motion';
import { useEffect, useRef, type RefObject } from 'react';

const RBC_PRIMARY = '/assets/biomedical/clinora-rbc-primary.png';
const RBC_ANGLE = '/assets/biomedical/clinora-rbc-angle.png';
const NEURON_ENVIRONMENT = '/assets/biomedical/clinora-neuron-environment.png';

export function PatientReportBiomedicalVisual() {
  const reducedMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const parallax = usePatientReportParallax(rootRef, !reducedMotion);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="patient-report-biomedical pointer-events-none absolute inset-0 overflow-hidden"
      data-clinical-ambient-visual="patient-report"
      data-clinical-ambient-motion={reducedMotion ? 'reduced' : 'ambient'}
      data-biomedical-depth-system="three-plane"
    >
      <div className="patient-report-ambient patient-report-ambient--cyan absolute inset-0" />
      <div className="patient-report-ambient patient-report-ambient--teal absolute inset-0" />
      <div className="patient-report-ambient patient-report-ambient--blood absolute inset-0" />
      <div className="patient-report-microtexture absolute inset-0" />

      <motion.div
        className="patient-report-neural-layer absolute inset-0"
        data-depth-plane="mid"
        style={{ x: parallax.midX, y: parallax.midY }}
        animate={
          reducedMotion
            ? undefined
            : {
                x: [0, 1.5, -1, 0],
                y: [0, -2, 1.5, 0],
                rotate: [-0.35, 0.2, -0.15, -0.35],
                scale: [1, 1.012, 0.997, 1],
              }
        }
        transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
      >
        <img
          className="patient-report-neural-model"
          src={NEURON_ENVIRONMENT}
          alt=""
          draggable={false}
          data-biomedical-neuron="model-derived"
        />
        <svg
          className="patient-report-neural-sparkles absolute inset-0 h-full w-full"
          viewBox="0 0 620 420"
          preserveAspectRatio="xMidYMid slice"
          role="presentation"
          focusable="false"
        >
          <g data-biomedical-particles="mid">
            <circle cx="135" cy="92" r="2" />
            <circle cx="185" cy="66" r="1.5" />
            <circle cx="252" cy="332" r="1.8" />
            <circle cx="326" cy="82" r="1.4" />
            <circle cx="408" cy="70" r="1.8" />
            <circle cx="470" cy="284" r="1.4" />
            <circle cx="530" cy="158" r="1.8" />
            <circle cx="576" cy="204" r="1.3" />
            <circle cx="548" cy="348" r="2.1" />
            <circle cx="112" cy="282" r="1.4" />
          </g>
        </svg>
      </motion.div>

      <motion.div
        className="patient-report-rbc-layer patient-report-rbc-layer--far"
        data-depth-plane="far"
        style={{ x: parallax.farX, y: parallax.farY }}
      >
        <motion.img
          className="patient-report-rbc patient-report-rbc--far"
          src={RBC_PRIMARY}
          alt=""
          draggable={false}
          data-biomedical-cell="far"
          data-biomedical-cell-tone="blood-red"
          initial={false}
          animate={
            reducedMotion ? undefined : { x: [0, -2.5, 1.5, 0], y: [0, 2.5, -1.5, 0], rotate: [-14, -12.8, -15.2, -14] }
          }
          transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>

      <motion.div
        className="patient-report-rbc-layer patient-report-rbc-layer--mid"
        style={{ x: parallax.midX, y: parallax.midY }}
      >
        <motion.img
          className="patient-report-rbc patient-report-rbc--mid"
          src={RBC_ANGLE}
          alt=""
          draggable={false}
          data-biomedical-cell="mid"
          data-biomedical-cell-tone="blood-red"
          initial={false}
          animate={reducedMotion ? undefined : { x: [0, 4, -1.5, 0], y: [0, -3, 2, 0], rotate: [-7, -5.3, -8.4, -7] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>

      <motion.div
        className="patient-report-rbc-layer patient-report-rbc-layer--foreground"
        data-depth-plane="foreground"
        style={{ x: parallax.foregroundX, y: parallax.foregroundY }}
      >
        <motion.img
          className="patient-report-rbc patient-report-rbc--foreground"
          src={RBC_PRIMARY}
          alt=""
          draggable={false}
          data-biomedical-cell="foreground"
          data-biomedical-cell-tone="blood-red"
          initial={false}
          animate={reducedMotion ? undefined : { x: [0, 4.5, -1.5, 0], y: [0, -4, 2.5, 0], rotate: [9, 10.2, 8.2, 9] }}
          transition={{ duration: 21, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  );
}

function usePatientReportParallax(rootRef: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const springX = useSpring(targetX, { stiffness: 28, damping: 24, mass: 1 });
  const springY = useSpring(targetY, { stiffness: 28, damping: 24, mass: 1 });

  useEffect(() => {
    const host = rootRef.current?.parentElement;
    const fineDesktop = window.matchMedia('(min-width: 1024px) and (pointer: fine)');
    const reset = () => {
      targetX.set(0);
      targetY.set(0);
    };

    if (!host || !enabled) {
      reset();
      return;
    }

    const handlePointer = (event: PointerEvent) => {
      if (!fineDesktop.matches) {
        reset();
        return;
      }

      const bounds = host.getBoundingClientRect();
      const normalizedX = ((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 2;
      const normalizedY = ((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * 2;
      targetX.set(Math.max(-1, Math.min(1, normalizedX)));
      targetY.set(Math.max(-1, Math.min(1, normalizedY)));
    };

    const handleMediaChange = () => {
      if (!fineDesktop.matches) reset();
    };

    host.addEventListener('pointermove', handlePointer, { passive: true });
    host.addEventListener('pointerleave', reset);
    window.addEventListener('blur', reset);
    fineDesktop.addEventListener('change', handleMediaChange);

    return () => {
      host.removeEventListener('pointermove', handlePointer);
      host.removeEventListener('pointerleave', reset);
      window.removeEventListener('blur', reset);
      fineDesktop.removeEventListener('change', handleMediaChange);
      reset();
    };
  }, [enabled, rootRef, targetX, targetY]);

  return {
    farX: useParallaxRange(springX, 1.2),
    farY: useParallaxRange(springY, 1),
    midX: useParallaxRange(springX, 2.6),
    midY: useParallaxRange(springY, 2.1),
    foregroundX: useParallaxRange(springX, 4.4),
    foregroundY: useParallaxRange(springY, 3.6),
  };
}

function useParallaxRange(source: MotionValue<number>, range: number) {
  return useTransform(source, (value) => value * range);
}
