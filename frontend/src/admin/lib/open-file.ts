/*
 * Opening a presigned link the backend just minted.
 *
 * Two behaviours, and they are genuinely different — which is why the backend
 * signs the disposition into the URL rather than leaving it to the browser:
 *
 *   inline     — a new tab, so the operator keeps the screen they were working
 *                on. The response is served as stored, so a PDF or an image
 *                renders where the tab can.
 *   attachment — a plain anchor click. The response carries
 *                `Content-Disposition: attachment`, so the browser saves the file
 *                and stays put; `window.open` would leave a blank tab behind, and
 *                the `download` attribute alone is ignored cross-origin.
 *
 * Shared by the order documents card and the result form because both open a
 * customer-facing document the same way, and a second copy of the anchor dance is
 * exactly the kind of thing that drifts.
 */

export type FileDisposition = 'inline' | 'attachment';

export function openPresignedFile(
  url: string,
  disposition: FileDisposition,
  fileName: string,
): void {
  if (disposition === 'inline') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.rel = 'noopener';
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
