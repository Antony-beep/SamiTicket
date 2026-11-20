'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MotionConfig, useReducedMotion } from 'motion/react';
import { Check, CircleAlert, Info, X } from 'lucide-react';
import { DynamicIsland, DynamicIslandProvider, DynamicContainer } from '@/components/ui/dynamic-island';
import { HaloProgress } from '@/components/ui/halo-progress';
import type { Notice } from '@/lib/feedback';

export function AppExperience({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}<AppFeedback /></MotionConfig>;
}

export function AppFeedback() {
  const [notice, setNotice] = useState<(Notice & { key: number }) | null>(null);
  const [pending, setPending] = useState(0), [celebration, setCelebration] = useState(false);
  const reduceMotion = useReducedMotion();
  const pendingCelebration = useRef<Notice | null>(null);
  useEffect(() => {
    let key = 0;
    const onNotice = (event: Event) => {
      const detail = (event as CustomEvent<Notice>).detail;
      setNotice({ ...detail, key: ++key });
      pendingCelebration.current = detail.celebrate && detail.eventId ? detail : null;
      setCelebration(Boolean(detail.celebrate) && !detail.eventId && document.visibilityState !== 'hidden');
    };
    const onArrival = (event: Event) => {
      const pending = pendingCelebration.current;
      if (!pending || pending.eventId !== (event as CustomEvent<string>).detail) return;
      pendingCelebration.current = null;
      setNotice({...pending,key:++key});
      setCelebration(document.visibilityState !== 'hidden');
    };
    const onRequest = (event: Event) => setPending(value => Math.max(0, value + (event as CustomEvent<number>).detail));
    const hide = () => { if (document.visibilityState === 'hidden') setCelebration(false); };
    window.addEventListener('samiticket:notice', onNotice);
    window.addEventListener('samiticket:request', onRequest);
    window.addEventListener('samiticket:arrival', onArrival);
    document.addEventListener('visibilitychange', hide);
    return () => { window.removeEventListener('samiticket:notice', onNotice); window.removeEventListener('samiticket:request', onRequest); window.removeEventListener('samiticket:arrival', onArrival); document.removeEventListener('visibilitychange', hide); };
  }, []);
  useEffect(() => {
    if (!notice || notice.tone === 'error') return;
    const timer = setTimeout(() => setNotice(null), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(() => setCelebration(false), 2400);
    return () => clearTimeout(timer);
  }, [celebration, notice?.key]);
  const Icon = notice?.tone === 'error' ? CircleAlert : notice?.tone === 'success' ? Check : Info;
  return <>
    {pending > 0 && <div className="request-progress"><HaloProgress value={null} aria-label="Solicitudes en curso" /></div>}
    {notice && <div className="notification-island" key={notice.key}><DynamicIslandProvider initialSize="large"><DynamicIsland id="feedback-island"><DynamicContainer className="notification-content"><div role={notice.tone === 'error' ? 'alert' : 'status'} className={`notification-message ${notice.tone ?? 'info'}`}><Icon size={22} aria-hidden="true" /><div><strong>{notice.title}</strong>{notice.description && <p>{notice.description}</p>}</div><button type="button" aria-label="Cerrar notificación" onClick={() => {pendingCelebration.current=null;setNotice(null);setCelebration(false);}}><X size={18} /></button></div></DynamicContainer></DynamicIsland></DynamicIslandProvider></div>}
    {celebration && !reduceMotion && <div className="confetti" aria-hidden="true">{Array.from({length:44}, (_, index) => <i key={index} style={{'--x':`${(index*67)%110-5}vw`,'--drift':`${(index%2?1:-1)*(30+index%90)}px`,'--delay':`${index%7*35}ms`,'--spin':`${index%2?440:-520}deg`,background:['#ff455f','#ceff70','#ffb28e','#e7dfff'][index%4]} as CSSProperties} />)}</div>}
  </>;
}
