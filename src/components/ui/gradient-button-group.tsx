"use client"

// Cult UI gradient group adapted to real catalogue filters; the app keeps its nocturnal theme.
import { useId, useRef, type ReactNode } from "react";
import { motion } from "motion/react";
import { useActiveMotion } from "./use-active-motion";

export function GradientButtonGroup({items,value,onValueChange}: {items:{id:string;label:string;icon:ReactNode}[];value:string;onValueChange:(value:string)=>void}) {
  const id=useId(), ref=useRef<HTMLDivElement>(null), active=useActiveMotion(ref);
  return <div ref={ref} className="gradient-button-group" role="group" aria-label="Disponibilidad de eventos">{items.map(item=><button key={item.id} type="button" aria-pressed={value===item.id} onClick={()=>onValueChange(item.id)}>
    {value===item.id && <motion.span className="gradient-active-ring" layoutId={id} transition={{duration:active ? 0.24 : 0,ease:"easeOut"}}><span className={active?'gradient-ring-spin':''} /></motion.span>}
    <span className="gradient-button-face">{item.icon}<span>{item.label}</span></span>
  </button>)}</div>;
}
