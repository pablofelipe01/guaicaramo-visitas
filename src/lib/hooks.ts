'use client';

import { useEffect, useRef, useState } from 'react';

/** Dispara `true` cuando el elemento entra al viewport */
export function useReveal(threshold = 0.15): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, seen];
}

interface CounterOptions {
  duration?: number;
  start?: boolean;
}

/** Anima un número desde 0 hasta `target` cuando `start` es true */
export function useCounter(target: number, { duration = 1400, start = false }: CounterOptions = {}): number {
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!start) return;
    let raf: number;
    const t0 = performance.now();
    const ease = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setVal(target * ease(p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);

  return val;
}
