import React,{useEffect,useState} from 'react';
import {motion,useSpring} from 'motion/react';
import './motion.css';

export function MotionShell({children}){
 const [paused,setPaused]=useState(()=>{try{return localStorage.getItem('boundary-motion')==='paused';}catch{return false;}});
 const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [hidden,setHidden]=useState(document.hidden);
 useEffect(()=>{const visibility=()=>setHidden(document.hidden),media=matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(media.matches);document.addEventListener('visibilitychange',visibility);media.addEventListener('change',change);return()=>{document.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',change);};},[]);
 const stopped=paused||reduced||hidden;
 const x=useSpring(0,{stiffness:65,damping:24}),y=useSpring(0,{stiffness:65,damping:24});
 useEffect(()=>{
  if(stopped){x.jump(0);y.jump(0);return;}
  const move=e=>{if(e.pointerType==='touch')return;x.set((e.clientX/window.innerWidth-.5)*14);y.set((e.clientY/window.innerHeight-.5)*14);};
  const reset=()=>{x.set(0);y.set(0);};
  window.addEventListener('pointermove',move,{passive:true});
  document.documentElement.addEventListener('pointerleave',reset);
  window.addEventListener('blur',reset);
  return()=>{window.removeEventListener('pointermove',move);document.documentElement.removeEventListener('pointerleave',reset);window.removeEventListener('blur',reset);x.stop();y.stop();};
 },[stopped,x,y]);
 const toggle=()=>{const next=!paused;setPaused(next);try{localStorage.setItem('boundary-motion',next?'paused':'on');}catch{}};
 return <div className="motion-shell" data-motion={stopped?'still':'on'}>
  <div className="tv-static" aria-hidden="true"><motion.div className="tv-response" style={{x,y}}><div className="tv-grain"/></motion.div><div className="tv-scanlines"/></div>
  {children}
  <div className="motion-control"><span aria-hidden="true" className="motion-symbol">{stopped?'Ⅱ':'≋'}</span><button type="button" onClick={toggle} aria-pressed={paused} disabled={reduced} aria-label={reduced?'Motion follows reduced-motion preference':paused?'Resume site motion':'Pause site motion'}>{reduced?'Reduced motion':paused?'Static paused':'Pause static'}</button></div>
 </div>;
}
