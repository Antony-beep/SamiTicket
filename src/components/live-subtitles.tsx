'use client';
import { useEffect, useRef, useState } from 'react';
import { useInView, useReducedMotion } from 'motion/react';
import { Pause, Play } from 'lucide-react';
import { LightBoard } from '@/components/ui/lightboard';

const subtitle = 'MUSICA EN VIVO / FIESTAS Y TRADICION / NOS VEMOS EN LA PISTA';
export function LiveSubtitles() {
  const ref = useRef<HTMLDivElement>(null), inView = useInView(ref);
  const reduceMotion = useReducedMotion();
  const [paused, setPaused] = useState(false), [visible, setVisible] = useState(true);
  useEffect(() => { const update=()=>setVisible(document.visibilityState!=='hidden'); update(); document.addEventListener('visibilitychange',update); return ()=>document.removeEventListener('visibilitychange',update); }, []);
  const running = inView && visible && !paused && !reduceMotion;
  return <section className="container live-subtitles" aria-label="Música, fiestas y tradición" ref={ref}>
    <div className="lightboard-surface" aria-hidden="true">{running ? <LightBoard text={subtitle} rows={7} lightSize={3} gap={1.5} updateInterval={80} colors={{background:'#170e12',textDim:'#ff626b',textBright:'#36151e',drawLine:'#ceff70'}} /> : <p>Música en vivo. Fiestas y tradición.</p>}</div>
    <p className="sr-only">Música en vivo. Fiestas y tradición. Nos vemos en la pista.</p>
    <button type="button" className="lightboard-control" aria-label={paused ? 'Reanudar letrero' : 'Pausar letrero'} aria-pressed={paused} disabled={Boolean(reduceMotion)} onClick={()=>setPaused(value=>!value)}>{paused ? <Play size={16} /> : <Pause size={16} />}</button>
  </section>;
}
