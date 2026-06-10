/**
 * Signature pad — a small HTML canvas that captures mouse / touch /
 * pen strokes and exports a PNG. No external dependency.
 *
 * The wrapper sizes the canvas to the container while keeping a
 * stable internal resolution so the captured image is crisp on
 * high-DPI displays.
 */

import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';

export interface SignaturePadHandle {
  /** Returns the signature as a base64 PNG, or null if the pad is empty. */
  toPng: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
}

interface Props {
  width?: number;
  height?: number;
  /** Stroke colour. Default: dark ink. */
  color?: string;
  /** Called whenever a stroke ends — useful for clearing a "needed" error. */
  onStrokeEnd?: () => void;
}

export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { width = 480, height = 160, color = '#1a1611', onStrokeEnd },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [width, height, color]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let drawing = false;
    let lastX = 0;
    let lastY = 0;

    function getPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
      const rect = canvas!.getBoundingClientRect();
      if ('touches' in e) {
        const t = e.touches[0] ?? (e as any).changedTouches?.[0];
        return { x: t.clientX - rect.left, y: t.clientY - rect.top };
      }
      return { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top };
    }

    function start(e: MouseEvent | TouchEvent) {
      e.preventDefault();
      drawing = true;
      const { x, y } = getPos(e);
      lastX = x; lastY = y;
    }
    function move(e: MouseEvent | TouchEvent) {
      if (!drawing) return;
      e.preventDefault();
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();
      lastX = x; lastY = y;
      dirtyRef.current = true;
    }
    function end() {
      if (drawing && onStrokeEnd) onStrokeEnd();
      drawing = false;
    }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', end);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
    };
  }, [onStrokeEnd]);

  useImperativeHandle(ref, () => ({
    toPng: () => {
      const canvas = canvasRef.current;
      if (!canvas || !dirtyRef.current) return null;
      // strip the "data:image/png;base64," prefix
      const url = canvas.toDataURL('image/png');
      return url.slice(url.indexOf(',') + 1);
    },
    clear: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      dirtyRef.current = false;
    },
    isEmpty: () => !dirtyRef.current,
  }), [width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="border border-hairline-strong rounded bg-paper cursor-crosshair touch-none"
      style={{ width, height }}
    />
  );
});
