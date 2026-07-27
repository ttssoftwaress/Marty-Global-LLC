import { useEffect, useState } from 'react';
import { QrCode as QrCodeIcon } from 'lucide-react';
import QRCode from 'qrcode';

/*
 * The deposit address as a scannable code. `qrcode` renders it — a hand-rolled
 * encoder was tried first and produced codes a real scanner could not read,
 * which for this screen is the worst possible failure: a customer scanning a
 * wrong-destination code loses their funds irrecoverably.
 *
 * Rendered as an SVG string so it stays crisp at any size and inherits no
 * canvas/DPI problems. Error-correction level M is the standard default and
 * tolerates a little camera noise.
 */

type QrCodeProps = {
  value: string;
  /** Rendered pixel size of the square. */
  size?: number;
  className?: string;
};

export function QrCode({ value, size = 176, className }: QrCodeProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    QRCode.toString(value, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      // The quiet zone is required for a scanner to find the symbol.
      margin: 2,
      width: size,
      color: { dark: '#1e1e1e', light: '#ffffff' },
    })
      .then((markup) => {
        if (!cancelled) {
          setSvg(markup);
          setFailed(false);
        }
      })
      .catch(() => {
        // Never render a partial or guessed code — fall back to the address
        // text, which the screen shows beside this anyway.
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-gray-300 bg-gray-50 p-4 text-center ${className ?? ''}`}
        style={{ width: size, height: size }}
      >
        <QrCodeIcon className="size-6 text-gray-400" strokeWidth={1.75} aria-hidden="true" />
        <p className="text-small text-gray-500">
          Copy the address below instead
        </p>
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        className={`animate-pulse rounded-card bg-gray-200 ${className ?? ''}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-card bg-white ${className ?? ''}`}
      style={{ width: size, height: size }}
      // The address is shown as selectable text beside this, so the code itself
      // is decorative to a screen reader rather than a second copy to read out.
      role="img"
      aria-label="QR code for the USDT deposit address"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
