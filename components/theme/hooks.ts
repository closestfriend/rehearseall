import { useEffect, useRef, useState } from 'react';

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
export function useReveal<T extends HTMLElement>(): [React.RefObject<T>, boolean] {
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
