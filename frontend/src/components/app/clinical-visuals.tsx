import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from 'framer-motion';
import { useEffect, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type ClinicalMotifFamily = 'hematology' | 'biomarker' | 'document-scan' | 'radiology' | 'neural' | 'molecular';

export type ClinicalMotifIntensity = 'ambient' | 'supporting' | 'focused';
export type ClinicalMotifMotion = 'none' | 'drift' | 'parallax' | 'parallax-drift';
export type ClinicalMotifPlacement = 'top-right' | 'surface-left' | 'surface-right' | 'fill';

export type ClinicalMotifSpec = {
  type: ClinicalMotifFamily;
  intensity?: ClinicalMotifIntensity;
  motion?: ClinicalMotifMotion;
  placement?: ClinicalMotifPlacement;
  className?: string;
};

type ClinicalPointer = {
  x: MotionValue<number>;
  y: MotionValue<number>;
};

const intensityClasses: Record<ClinicalMotifIntensity, string> = {
  ambient: 'clinical-motif--ambient',
  supporting: 'clinical-motif--supporting',
  focused: 'clinical-motif--focused',
};

const placementClasses: Record<ClinicalMotifPlacement, string> = {
  'top-right':
    'clinical-placement--top-right absolute right-[-2rem] top-4 w-[46rem] max-xl:right-[-4rem] max-xl:w-[42rem] max-lg:right-[-5rem] max-lg:top-12 max-lg:w-[38rem] max-md:right-[-10rem] max-md:top-10 max-md:w-[27rem]',
  'surface-left': 'absolute -bottom-20 -left-16 w-[23rem] max-md:hidden',
  'surface-right':
    'clinical-placement--surface-right absolute -right-12 -top-8 w-[31rem] max-lg:-right-16 max-lg:w-[27rem] max-md:-right-24 max-md:top-0 max-md:w-[24rem]',
  fill: 'clinical-placement--fill absolute inset-0 h-full w-full',
};

const parallaxRange: Record<ClinicalMotifIntensity, number> = {
  ambient: 10,
  supporting: 6,
  focused: 7,
};

const motionIncludesParallax = (value: ClinicalMotifMotion | undefined) =>
  value === 'parallax' || value === 'parallax-drift';

const motionIncludesDrift = (value: ClinicalMotifMotion) => value === 'drift' || value === 'parallax-drift';

export function ClinicalBackdrop({
  motifs,
  illumination = 'balanced',
  texture = true,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  motifs: readonly ClinicalMotifSpec[];
  illumination?: 'none' | 'cyan' | 'balanced' | 'reports';
  texture?: boolean;
}) {
  const pointer = useClinicalPointer(motifs.some((motif) => motionIncludesParallax(motif.motion)));

  return (
    <div
      {...props}
      aria-hidden="true"
      data-clinical-backdrop="true"
      className={cn('clinical-backdrop pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {illumination !== 'none' ? <div className={cn('absolute inset-0', `clinical-ambient--${illumination}`)} /> : null}
      {texture ? <div className="clinical-technical-texture absolute inset-0" /> : null}
      {motifs.map((motif, index) => (
        <ClinicalMotifVisual
          key={`${motif.type}-${motif.placement ?? 'fill'}-${index}`}
          {...motif}
          pointerSource={pointer}
        />
      ))}
    </div>
  );
}

export function ClinicalMotif(props: ClinicalMotifSpec) {
  return <ClinicalMotifVisual {...props} />;
}

function ClinicalMotifVisual({
  type,
  intensity = 'ambient',
  motion: motifMotion = 'none',
  placement = 'fill',
  className,
  pointerSource,
}: ClinicalMotifSpec & { pointerSource?: ClinicalPointer }) {
  const reducedMotion = useReducedMotion();
  const ownPointer = useClinicalPointer(!pointerSource && motionIncludesParallax(motifMotion));
  const pointer = pointerSource ?? ownPointer;
  const range = parallaxRange[intensity];
  const x = useTransform(pointer.x, (value) => value * range);
  const y = useTransform(pointer.y, (value) => value * range * 0.65);
  const parallaxEnabled = motionIncludesParallax(motifMotion) && !reducedMotion;
  const driftEnabled = motionIncludesDrift(motifMotion) && !reducedMotion;

  return (
    <motion.div
      aria-hidden="true"
      data-clinical-motif-frame={type}
      className={cn('clinical-motif-frame pointer-events-none select-none', placementClasses[placement], className)}
      style={parallaxEnabled ? { x, y } : undefined}
    >
      <svg
        viewBox={type === 'hematology' ? '0 0 760 500' : '0 0 640 420'}
        fill="none"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
        data-clinical-motif={type}
        data-motif-intensity={intensity}
        data-motif-motion={motifMotion}
        className={cn(
          'clinical-motif pointer-events-none select-none text-[var(--clinora-accent-cyan)]',
          intensityClasses[intensity],
          driftEnabled && 'clinical-motif-motion--drift',
          driftEnabled && `clinical-motif-motion--${type}`,
        )}
      >
        {motifArtwork[type]}
      </svg>
    </motion.div>
  );
}

function useClinicalPointer(enabled: boolean): ClinicalPointer {
  const reducedMotion = useReducedMotion();
  const targetX = useMotionValue(0);
  const targetY = useMotionValue(0);
  const x = useSpring(targetX, { stiffness: 34, damping: 22, mass: 0.8 });
  const y = useSpring(targetY, { stiffness: 34, damping: 22, mass: 0.8 });

  useEffect(() => {
    const reset = () => {
      targetX.set(0);
      targetY.set(0);
    };

    if (!enabled || reducedMotion) {
      reset();
      return;
    }

    const desktop = window.matchMedia('(min-width: 1024px)');
    const handlePointer = (event: PointerEvent) => {
      if (!desktop.matches) {
        reset();
        return;
      }
      targetX.set((event.clientX / window.innerWidth - 0.5) * 2);
      targetY.set((event.clientY / window.innerHeight - 0.5) * 2);
    };
    const handleBreakpoint = () => {
      if (!desktop.matches) reset();
    };

    window.addEventListener('pointermove', handlePointer, { passive: true });
    window.addEventListener('blur', reset);
    desktop.addEventListener('change', handleBreakpoint);
    return () => {
      window.removeEventListener('pointermove', handlePointer);
      window.removeEventListener('blur', reset);
      desktop.removeEventListener('change', handleBreakpoint);
      reset();
    };
  }, [enabled, reducedMotion, targetX, targetY]);

  return { x, y };
}

const hematologyArtwork = (
  <>
    <g className="clinical-motif-layer--primary">
      <path
        data-clinical-cell="primary"
        d="M454 24c93-31 199 14 236 105 38 92-2 203-91 249-88 46-205 13-253-73-48-85-18-192 55-254 17-14 35-22 53-27Z"
        fill="var(--clinora-surface-2)"
        stroke="currentColor"
        strokeWidth="2.3"
      />
      <path
        className="clinical-cell--tablet"
        data-clinical-cell="supporting"
        d="M92 292c58-65 164-74 224-11 60 63 43 171-30 217-73 47-180 19-215-61-22-51-11-104 21-145Z"
        fill="var(--clinora-surface-2)"
        stroke="var(--clinora-accent-teal)"
        strokeWidth="2"
      />
    </g>
    <g className="clinical-motif-layer--secondary">
      <path
        d="M486 73c66-21 141 11 166 77 25 67-6 145-70 176-64 31-146 4-177-59-31-61-8-137 46-179 11-8 23-13 35-15Z"
        stroke="var(--clinora-accent-teal)"
        strokeWidth="1.5"
        strokeDasharray="7 11"
      />
      <ellipse cx="534" cy="201" rx="53" ry="38" fill="var(--clinora-surface-hero)" stroke="currentColor" />
      <path
        className="clinical-cell--tablet"
        d="M130 326c42-42 110-44 151-3 41 42 34 111-13 145-47 33-117 19-143-32-18-35-14-77 5-110Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="6 10"
      />
      <ellipse
        className="clinical-cell--tablet"
        cx="198"
        cy="397"
        rx="38"
        ry="29"
        fill="var(--clinora-surface-hero)"
        stroke="var(--clinora-accent-teal)"
      />
      <path
        className="clinical-cell--desktop-only"
        data-clinical-cell="desktop"
        d="M604 292c65-47 157-27 194 43 37 71-2 159-79 183-77 23-160-27-171-107-8-51 15-94 56-119Z"
        fill="var(--clinora-surface-2)"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <ellipse
        className="clinical-cell--desktop-only"
        cx="715"
        cy="414"
        rx="32"
        ry="24"
        fill="var(--clinora-surface-hero)"
        stroke="var(--clinora-accent-teal)"
      />
    </g>
    <g className="clinical-motif-layer--marks">
      <circle cx="680" cy="82" r="4" fill="currentColor" />
      <circle cx="389" cy="105" r="3" fill="var(--clinora-accent-teal)" />
      <circle cx="607" cy="397" r="3.5" fill="currentColor" />
      <circle className="clinical-cell--tablet" cx="338" cy="408" r="2.5" fill="var(--clinora-accent-teal)" />
      <circle className="clinical-cell--desktop-only" cx="727" cy="274" r="2.5" fill="currentColor" />
      <path d="M373 140h24m-12-12v24M617 416h20m-10-10v20" stroke="currentColor" />
      <path d="M704 126h28M718 112v28" stroke="var(--clinora-accent-teal)" strokeDasharray="3 4" />
      <path d="M430 397h54m-27-7v14" stroke="currentColor" strokeDasharray="2 6" />
    </g>
  </>
);

const biomarkerArtwork = (
  <>
    <g className="clinical-motif-layer--primary" stroke="currentColor" strokeWidth="1.4">
      <path d="M58 334C132 316 150 346 220 276s116-26 172-86c52-55 88-40 187-130" />
      <path d="M58 358h522M58 310h522M58 262h522M58 214h522" strokeDasharray="2 12" />
    </g>
    <g className="clinical-motif-layer--secondary" stroke="var(--clinora-accent-teal)" strokeWidth="1.1">
      <path d="M128 317V199m92 77V145m90 91V116m82 74V87m96 52V55" strokeDasharray="5 9" />
      <path d="M128 199h28m64-54h28m62-29h28m54-29h28m68-32h28" />
    </g>
    <g className="clinical-motif-layer--marks">
      {[
        [58, 334, 6],
        [128, 317, 8],
        [220, 276, 9],
        [310, 236, 7],
        [392, 190, 10],
        [488, 139, 7],
        [579, 60, 9],
      ].map(([cx, cy, r]) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r={r} fill="var(--clinora-surface-2)" stroke="currentColor" />
          <circle cx={cx} cy={cy} r="2.2" fill="var(--clinora-accent-teal)" />
        </g>
      ))}
      <path d="M48 182h34m-17-17v34m476 137h30" stroke="currentColor" />
      <path d="M88 382h58m28 0h42m28 0h76" stroke="var(--clinora-accent-teal)" strokeDasharray="3 8" />
    </g>
  </>
);

const documentScanArtwork = (
  <>
    <g className="clinical-motif-layer--primary">
      <rect x="130" y="34" width="342" height="350" rx="18" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M154 94V58h38m218 0h38v36M154 326v34h38m218 0h38v-34"
        stroke="var(--clinora-accent-teal)"
        strokeWidth="2.2"
      />
      <path d="M176 128h212m-212 46h248m-248 46h158m-158 46h222m-222 46h122" stroke="currentColor" />
    </g>
    <g className="clinical-motif-layer--secondary">
      <path d="M102 211h414" stroke="var(--clinora-accent-teal)" strokeWidth="1.5" strokeDasharray="9 8" />
      <rect x="360" y="249" width="88" height="63" rx="8" stroke="currentColor" strokeDasharray="4 6" />
      <path
        d="M471 106c63-28 137 11 148 78 11 66-43 125-110 115-52-8-91-56-83-108 6-39 20-69 45-85Z"
        stroke="var(--clinora-accent-teal)"
        strokeWidth="1.5"
      />
      <ellipse cx="522" cy="202" rx="25" ry="19" fill="var(--clinora-surface-hero)" stroke="currentColor" />
      <path d="m334 220 55 29m-91 63 91-1m59-62 50-32" stroke="currentColor" strokeDasharray="3 7" />
    </g>
    <g className="clinical-motif-layer--marks">
      <circle cx="176" cy="128" r="4" fill="var(--clinora-accent-teal)" />
      <circle cx="334" cy="220" r="4" fill="currentColor" />
      <circle cx="298" cy="312" r="4" fill="var(--clinora-accent-teal)" />
      <circle cx="498" cy="217" r="3.5" fill="currentColor" />
      <path d="M540 76h24m-12-12v24M508 330h28m-14-14v28" stroke="currentColor" />
      <path d="M88 108h22m-11-11v22" stroke="var(--clinora-accent-teal)" />
    </g>
  </>
);

const radiologyArtwork = (
  <g className="clinical-motif-layer--primary">
    <path d="M116 339A230 230 0 0 1 516 95" stroke="currentColor" strokeWidth="1.5" />
    <path d="M158 347A184 184 0 0 1 494 135" stroke="var(--clinora-accent-teal)" strokeDasharray="6 10" />
    <path d="M211 345A132 132 0 0 1 463 182" stroke="currentColor" />
    <path d="M86 84h54V42m414 42h-54V42M86 336h54v42m414-42h-54v42" stroke="currentColor" />
    <circle cx="337" cy="247" r="42" stroke="var(--clinora-accent-teal)" />
    <path d="M337 188v118m-59-59h118" stroke="currentColor" strokeDasharray="3 8" />
  </g>
);

export function ClinicalNeuralArtwork() {
  return (
    <>
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <path d="M86 311c78-20 83-92 145-103 71-12 90 71 156 49 52-17 72-92 166-114" />
        <path d="M231 208c-33-67 8-116 53-151m103 200c28 56 78 77 138 86" />
        <path d="M231 208c25 42 7 89-41 140m197-91c-34-52-19-112 32-168" stroke="var(--clinora-accent-teal)" />
      </g>
      {[
        [86, 311],
        [231, 208],
        [284, 57],
        [190, 348],
        [387, 257],
        [419, 89],
        [525, 343],
        [553, 143],
      ].map(([cx, cy], index) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r={index === 1 || index === 4 ? 9 : 5}
          fill="var(--clinora-surface-2)"
          stroke={index % 2 ? 'var(--clinora-accent-teal)' : 'currentColor'}
        />
      ))}
    </>
  );
}

const neuralArtwork = (
  <g className="clinical-motif-layer--primary">
    <ClinicalNeuralArtwork />
  </g>
);

const molecularArtwork = (
  <g className="clinical-motif-layer--primary">
    <g stroke="currentColor" strokeWidth="1.4">
      <path d="m178 104 82 47 2 95-81 49-82-47-2-95 81-49Z" />
      <path d="m414 134 76 44-1 88-77 44-76-44 2-88 76-44Z" stroke="var(--clinora-accent-teal)" />
      <path d="m262 198 76 24m-157 73 83 64m225-93 68 55" />
    </g>
    {[
      [178, 104],
      [260, 151],
      [262, 246],
      [181, 295],
      [99, 248],
      [97, 153],
      [414, 134],
      [490, 178],
      [489, 266],
      [412, 310],
      [336, 266],
      [338, 178],
    ].map(([cx, cy], index) => (
      <circle
        key={`${cx}-${cy}`}
        cx={cx}
        cy={cy}
        r={index % 3 === 0 ? 8 : 5}
        fill="var(--clinora-surface-2)"
        stroke={index > 5 ? 'var(--clinora-accent-teal)' : 'currentColor'}
      />
    ))}
  </g>
);

const motifArtwork: Record<ClinicalMotifFamily, ReactNode> = {
  hematology: hematologyArtwork,
  biomarker: biomarkerArtwork,
  'document-scan': documentScanArtwork,
  radiology: radiologyArtwork,
  neural: neuralArtwork,
  molecular: molecularArtwork,
};
