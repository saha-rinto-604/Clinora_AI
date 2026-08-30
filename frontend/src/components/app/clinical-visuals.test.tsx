import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { describe, expect, it } from 'vitest';
import { ClinicalBackdrop, type ClinicalMotifFamily, type ClinicalMotifSpec } from './clinical-visuals';

const families: ClinicalMotifFamily[] = [
  'hematology',
  'biomarker',
  'document-scan',
  'radiology',
  'neural',
  'molecular',
];

describe('Clinical biomedical visuals', () => {
  it('exposes every reusable motif family as non-interactive decorative vector artwork', async () => {
    const motifs: ClinicalMotifSpec[] = families.map((type, index) => ({
      type,
      intensity: index % 3 === 0 ? 'ambient' : index % 3 === 1 ? 'supporting' : 'focused',
      motion: index % 2 === 0 ? 'parallax-drift' : 'drift',
      placement: 'fill',
    }));
    const { container } = render(<ClinicalBackdrop motifs={motifs} illumination="balanced" />);

    const backdrop = container.querySelector('[data-clinical-backdrop="true"]');
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    expect(backdrop).toHaveClass('pointer-events-none');

    const renderedMotifs = container.querySelectorAll('[data-clinical-motif]');
    expect(renderedMotifs).toHaveLength(families.length);
    renderedMotifs.forEach((motif, index) => {
      expect(motif).toHaveAttribute('data-clinical-motif', families[index]);
      expect(motif).toHaveAttribute('aria-hidden', 'true');
      expect(motif).toHaveAttribute('focusable', 'false');
      expect(motif).toHaveClass('pointer-events-none');
      expect(motif).toHaveAttribute('data-motif-motion', index % 2 === 0 ? 'parallax-drift' : 'drift');
    });
    expect(container.querySelectorAll('[data-motif-intensity="ambient"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-motif-intensity="supporting"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-motif-intensity="focused"]')).toHaveLength(2);
    expect(container.querySelectorAll('.clinical-motif-layer--primary')).toHaveLength(families.length);
    expect(container.querySelectorAll('.clinical-motif-layer--secondary')).toHaveLength(3);
    expect(container.querySelectorAll('.clinical-motif-layer--marks')).toHaveLength(3);
    expect(container.querySelectorAll('[data-clinical-cell]')).toHaveLength(3);
    expect(await axe(container)).toHaveNoViolations();
  });
});
