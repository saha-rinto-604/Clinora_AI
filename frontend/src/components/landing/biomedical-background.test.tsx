import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BiomedicalBackground } from './biomedical-background';

const motionPreference = vi.hoisted(() => ({ reduced: false }));

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    useReducedMotion: () => motionPreference.reduced,
  };
});

describe('BiomedicalBackground', () => {
  beforeEach(() => {
    motionPreference.reduced = false;
  });

  it('keeps the established landing composition as the default shared visual', () => {
    const { container } = render(<BiomedicalBackground />);
    const visual = container.querySelector('[data-clinical-ambient-visual="landing"]');

    expect(visual).toHaveAttribute('aria-hidden', 'true');
    expect(visual).toHaveClass('pointer-events-none');
    expect(visual).toHaveAttribute('data-clinical-ambient-motion', 'ambient');
    expect(container.querySelectorAll('[data-biomedical-cell]')).toHaveLength(4);
    expect(container.querySelector('[data-biomedical-network="true"]')).toBeInTheDocument();
  });

  it('reuses a layered patient-report composition without WebGL or medical status content', async () => {
    const { container } = render(<BiomedicalBackground variant="patient-report" />);
    const visual = container.querySelector('[data-clinical-ambient-visual="patient-report"]');

    expect(visual).toHaveAttribute('aria-hidden', 'true');
    expect(visual).toHaveClass('pointer-events-none');
    expect(visual).toHaveAttribute('data-biomedical-depth-system', 'three-plane');
    expect(visual).toHaveAttribute('data-clinical-ambient-motion', 'ambient');
    expect(container.querySelectorAll('[data-depth-plane]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-biomedical-cell="foreground"]')).toHaveLength(1);
    container.querySelectorAll('[data-biomedical-cell]').forEach((cell) => {
      expect(cell).toHaveAttribute('data-biomedical-cell-tone', 'blood-red');
    });
    const neuron = container.querySelector('img[data-biomedical-neuron="model-derived"]');
    expect(neuron).toBeInTheDocument();
    expect(neuron).toHaveAttribute('src', '/assets/biomedical/clinora-neuron-environment.png');
    expect(container.querySelectorAll('img[data-biomedical-cell]')).toHaveLength(3);
    expect(container.querySelector('[data-biomedical-particles="mid"]')).toBeInTheDocument();
    expect(container.querySelector('[data-biomedical-network]')).not.toBeInTheDocument();
    expect(container.querySelector('[id*="dna" i]')).not.toBeInTheDocument();
    expect(container.querySelector('canvas')).not.toBeInTheDocument();
    expect(container.querySelector('[data-bio-record-stage]')).not.toBeInTheDocument();
    expect(container.textContent).toBe('');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('keeps every patient-report depth plane visible while exposing its reduced-motion state', () => {
    motionPreference.reduced = true;
    const { container } = render(<BiomedicalBackground variant="patient-report" />);
    const visual = container.querySelector('[data-clinical-ambient-visual="patient-report"]');

    expect(visual).toHaveAttribute('data-clinical-ambient-motion', 'reduced');
    expect(container.querySelectorAll('[data-depth-plane]')).toHaveLength(3);
    expect(container.querySelector('[data-biomedical-neuron="model-derived"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-biomedical-cell]')).toHaveLength(3);
  });
});
