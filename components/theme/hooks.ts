import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

// Mirrors the Personal Best reference's counter easing exactly: 1.4s, cubic ease-out.
export function useCountUp(target: number, active: boolean): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const dur = 1400;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active]);
  return value;
}

// Fires once when the element first enters the viewport (threshold 0.25), with a
// timeout fallback in case IntersectionObserver never fires, matching the
// Personal Best reference's force-complete guard.
export function useReveal<T extends HTMLElement>(): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    let done = false;
    const reveal = () => { if (!done) { done = true; setRevealed(true); } };
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { reveal(); io.disconnect(); } });
    }, { threshold: 0.25 });
    io.observe(el);
    const fallback = setTimeout(reveal, 900);
    return () => { io.disconnect(); clearTimeout(fallback); };
  }, []);

  return [ref, revealed];
}

// Tracks whether the viewport is at/under a breakpoint (default 768px — phone
// and small-tablet portrait). Use this to switch layout-shape inline style
// values (grid columns, padding, which nav items render) since plain React
// inline styles can't express @media queries directly. Font sizing should
// prefer CSS clamp() strings instead of this hook where possible — that
// scales continuously and doesn't need JS at all.
export function useIsMobile(breakpoint: number = 768): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
  );
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [breakpoint]);
  return isMobile;
}
