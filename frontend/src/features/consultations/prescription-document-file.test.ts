import { afterEach, describe, expect, it, vi } from 'vitest';
import { preparePrescriptionDocumentViewer, presentPrescriptionDocument } from './prescription-document-file';

describe('prescription document viewer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('uses a real preview handle without classifying a successful no-opener tab as blocked', () => {
    vi.useFakeTimers();
    const replace = vi.fn();
    const viewer = {
      closed: false,
      close: vi.fn(),
      location: { replace },
      opener: window,
    } as unknown as Window;
    const open = vi.spyOn(window, 'open').mockReturnValue(viewer);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/prescription');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

    const preparedViewer = preparePrescriptionDocumentViewer();
    presentPrescriptionDocument(
      new Blob(['%PDF-1.7 prescription'], { type: 'application/pdf' }),
      'prescription.pdf',
      'view',
      preparedViewer,
    );

    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(viewer.opener).toBeNull();
    expect(replace).toHaveBeenCalledWith('blob:http://localhost/prescription');
  });

  it('reports a genuinely blocked preview before requesting document bytes', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);

    expect(() => preparePrescriptionDocumentViewer()).toThrow('viewer was blocked');
  });

  it('rejects an empty or unsupported response instead of opening a broken viewer', () => {
    expect(() =>
      presentPrescriptionDocument(new Blob([], { type: 'application/json' }), 'prescription.pdf', 'view'),
    ).toThrow('empty or had an unsupported content type');
  });
});
