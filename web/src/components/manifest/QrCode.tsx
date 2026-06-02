/**
 * Client-side QR code renderer. We generate the SVG path on-mount via the
 * `qrcode` lib so the QR survives offline printing (no external image
 * fetch). The output is an inline <svg> which scales crisply on paper.
 */

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function QrCode({
  value,
  size = 120,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const [svg, setSvg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, {
      type: 'svg',
      margin: 1,
      width: size,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#FFFFFF' },
    }).then(s => {
      if (!cancelled) setSvg(s);
    }).catch(err => {
      console.error('[manifest] QR generation failed:', err);
    });
    return () => { cancelled = true; };
  }, [value, size]);

  if (!svg) {
    return (
      <div
        className={className}
        style={{ width: size, height: size, background: '#f0f0f0' }}
      />
    );
  }

  return <div className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
