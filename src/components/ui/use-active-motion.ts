'use client';
import { useEffect, useState, type RefObject } from 'react';
import { useReducedMotion } from 'motion/react';

export function useActiveMotion(ref: RefObject<HTMLElement | null>) {
  const reduced = useReducedMotion();
  const [onscreen, setOnscreen] = useState(false), [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    update(); document.addEventListener('visibilitychange', update);
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => setOnscreen(entries[0]?.isIntersecting ?? false));
    if (observer && ref.current) observer.observe(ref.current);
    else setOnscreen(true);
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, [ref]);
  return onscreen && visible && !reduced;
}
