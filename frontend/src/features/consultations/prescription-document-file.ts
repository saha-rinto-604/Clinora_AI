const PRESCRIPTION_DOCUMENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

export function preparePrescriptionDocumentViewer() {
  const viewer = window.open('about:blank', '_blank');
  if (!viewer) {
    throw new Error('The prescription document viewer was blocked by the browser.');
  }
  viewer.opener = null;
  return viewer;
}

export function closePrescriptionDocumentViewer(viewer: Window | null) {
  if (viewer && !viewer.closed) viewer.close();
}

export function presentPrescriptionDocument(
  blob: Blob,
  filename: string,
  disposition: 'view' | 'download',
  preparedViewer: Window | null = null,
) {
  if (blob.size === 0 || !PRESCRIPTION_DOCUMENT_TYPES.has(blob.type.toLowerCase())) {
    throw new Error('The prescription document response was empty or had an unsupported content type.');
  }

  const url = URL.createObjectURL(blob);
  if (disposition === 'download') {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename || 'prescription-document';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }

  let viewer = preparedViewer;
  try {
    viewer ??= preparePrescriptionDocumentViewer();
    if (viewer.closed) throw new Error('The prescription document viewer was closed.');
    viewer.location.replace(url);
  } catch (error) {
    URL.revokeObjectURL(url);
    closePrescriptionDocumentViewer(viewer);
    throw error;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
