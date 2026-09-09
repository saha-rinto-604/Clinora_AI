import { useReducedMotion } from 'framer-motion';

const AMBIENT_VIDEO_SRC = '/assets/biomedical/clinora-biomedical-ambient.mp4';
const AMBIENT_POSTER_SRC = '/assets/biomedical/clinora-biomedical-ambient-poster.webp';

export function LandingAmbientVideo() {
  const reducedMotion = useReducedMotion();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#020617]"
      data-clinical-ambient-visual="landing-video"
      data-clinical-ambient-motion={reducedMotion ? 'reduced' : 'video'}
    >
      {reducedMotion ? (
        <img
          src={AMBIENT_POSTER_SRC}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover object-center opacity-[0.9]"
        />
      ) : (
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          poster={AMBIENT_POSTER_SRC}
          className="absolute inset-0 h-full w-full object-cover object-center opacity-[0.9]"
        >
          <source src={AMBIENT_VIDEO_SRC} type="video/mp4" />
        </video>
      )}

      <div className="absolute inset-0 bg-[#020617]/10" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#020617]/10 via-transparent to-[#020617]/35" />
    </div>
  );
}
