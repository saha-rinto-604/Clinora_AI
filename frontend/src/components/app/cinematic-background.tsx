import { useReducedMotion } from 'framer-motion';
import { useState } from 'react';

const RESEARCHER_3D_VIDEO = '/assets/biomedical/researcher_3D_home_design.mp4';
const DEFAULT_POSTER = '/assets/biomedical/clinora-core-home-cinematic-poster.webp';

export interface CinematicBackgroundProps {
  className?: string;
  heightClass?: string;
  opacityClass?: string;
  videoSrc?: string;
  posterSrc?: string;
}

/**
 * CinematicBackground
 * Renders the 3D cinematic ambient animation for Researcher and Admin workspaces
 * with multi-plane gradient scrims for seamless integration into dark-mode workspaces.
 */
export function CinematicBackground({
  className = '',
  heightClass = 'h-[360px]',
  opacityClass = 'opacity-90',
  videoSrc = RESEARCHER_3D_VIDEO,
  posterSrc = DEFAULT_POSTER,
}: CinematicBackgroundProps) {
  const reducedMotion = useReducedMotion();
  const [videoFailed, setVideoFailed] = useState(false);

  return (
    <div
      aria-hidden="true"
      style={{ pointerEvents: 'none' }}
      className={`pointer-events-none absolute inset-0 ${heightClass} overflow-hidden select-none -z-10 ${className}`}
      data-clinora-cinematic-bg="true"
    >
      {reducedMotion || videoFailed ? (
        <img
          src={posterSrc}
          alt=""
          draggable={false}
          style={{ pointerEvents: 'none' }}
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover object-[58%_45%] ${opacityClass} saturate-[1.1]`}
        />
      ) : (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={posterSrc}
          tabIndex={-1}
          disablePictureInPicture
          onError={() => setVideoFailed(true)}
          style={{ pointerEvents: 'none' }}
          className={`pointer-events-none absolute inset-0 h-full w-full object-cover object-[58%_45%] ${opacityClass} saturate-[1.1]`}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      )}

      {/* Cinematic Biomedical Scrims */}
      <div
        style={{ pointerEvents: 'none' }}
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(4,20,27,0.92)_0%,rgba(4,20,27,0.70)_25%,rgba(4,20,27,0.18)_55%,rgba(4,20,27,0.72)_88%,rgba(4,20,27,0.95)_100%)]"
      />
      <div
        style={{ pointerEvents: 'none' }}
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(4,20,27,0.25)_0%,rgba(4,20,27,0.05)_40%,rgba(2,11,20,0.80)_85%,var(--clinora-bg-canvas,#020b14)_100%)]"
      />
    </div>
  );
}
