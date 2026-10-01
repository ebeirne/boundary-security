import React,{useEffect,useRef,useState} from 'react';
import './smoke.css';
import {PaintedDrawing} from './painted-drawing.jsx';
export function SmokeShell({children}){
 const content=useRef(null),[route,setRoute]=useState(location.hash.slice(1)||'home');
 useEffect(()=>{const change=()=>setRoute(location.hash.slice(1)||'home');addEventListener('hashchange',change);return()=>removeEventListener('hashchange',change);},[]);
 return <div data-art={['review','repair','evidence','trust'].includes(route)?'sculpture':'arch'} className={`smoke-shell ${route==='home'?'smoke-home':'smoke-inner'}`}><svg width="0" height="0" className="ink-filter-defs" aria-hidden="true"><defs><filter id="royal-ink" colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values=".1926 .648 .0654 0 .094 .1635 .55 .0555 0 .231 .0576 .1938 .0196 0 .729 0 0 0 1 0"/></filter></defs></svg>{route!=='home'&&<PaintedDrawing key={route} light study={!['review','repair','evidence','trust'].includes(route)}/>}<div ref={content} className="smoke-content">{children}</div></div>;
}
