export function presentPrescriptionDocument(blob: Blob, filename: string, disposition: 'view' | 'download') {
  const url = URL.createObjectURL(blob);
  if (disposition === 'download') {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename || 'prescription-document';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    return;
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    URL.revokeObjectURL(url);
    throw new Error('The prescription document viewer was blocked by the browser.');
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
