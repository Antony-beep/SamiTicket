'use client';
import { useRef } from 'react';
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, CloudMoon, Moon, Sun } from 'lucide-react';
import { useActiveMotion } from './ui/use-active-motion';

export function WeatherIcon({code,isDay=true}: {code:number;isDay?:boolean}) {
  const ref=useRef<HTMLSpanElement>(null), active=useActiveMotion(ref);
  const Icon=code>=95 ? CloudLightning : code>=71&&code<=77||code===85||code===86 ? CloudSnow : code>=51 ? CloudRain : code===45||code===48 ? CloudFog : code===3 ? Cloud : code===2 ? isDay ? CloudSun : CloudMoon : isDay ? Sun : Moon;
  return <span ref={ref} className={`weather-symbol weather-code-${code}`} aria-hidden="true"><Icon size={64} strokeWidth={1.25} style={{animationPlayState:active?'running':'paused'}} /></span>;
}
