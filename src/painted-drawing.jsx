import React,{useEffect,useRef} from 'react';
export function PaintedDrawing({light=false,study=false,duration=30000}){
 const root=useRef(null),canvas=useRef(null);
 useEffect(()=>{
  const host=root.current,c=canvas.current,ctx=c.getContext('2d'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let frame=0,disposed=false,visible=false,last=0,elapsed=0,loaded=false,completed=false,order,cursor=0,pixels,paint,pc,w,h,worker;
  const stop=()=>{cancelAnimationFrame(frame);frame=0;last=0;};
  const schedule=()=>{if(!frame&&!disposed&&loaded&&order&&visible&&!document.hidden&&!reduce.matches&&!completed)frame=requestAnimationFrame(draw);};
  const present=()=>{if(!loaded)return;const vw=innerWidth,vh=innerHeight,dpr=Math.min(devicePixelRatio,1.5),cw=Math.round(vw*dpr),ch=Math.round(vh*dpr);if(c.width!==cw||c.height!==ch){c.width=cw;c.height=ch;}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,vw,vh);const scale=Math.max(vw/w,vh/h);ctx.drawImage(paint,(vw-w*scale)/2,(vh-h*scale)/2,w*scale,h*scale);};
  function draw(now){frame=0;if(disposed||!visible||document.hidden||reduce.matches)return;elapsed+=last?Math.min(80,now-last):0;last=now;const target=Math.min(order.length,Math.floor((.34+.66*Math.min(1,elapsed/duration))*order.length));for(;cursor<target;cursor++)pixels.data[order[cursor]*4+3]=255;pc.putImageData(pixels,0,0);present();completed=cursor===order.length;host.dataset.progress=String(Math.min(1,elapsed/duration));host.dataset.complete=String(completed);if(!completed)schedule();}
  const image=new Image();image.onload=()=>{if(disposed)return;w=image.naturalWidth;h=image.naturalHeight;paint=document.createElement('canvas');paint.width=w;paint.height=h;pc=paint.getContext('2d',{willReadFrequently:true});pc.filter=light&&!study?'invert(1) grayscale(1)':'grayscale(1)';pc.drawImage(image,0,0);pc.filter='none';pixels=pc.getImageData(0,0,w,h);const source=new Uint8ClampedArray(pixels.data);for(let i=0;i<w*h;i++)pixels.data[i*4+3]=(i%w<w*.2||i%w>=w*.86)?255:0;pc.putImageData(pixels,0,0);loaded=true;present();worker=new Worker(new URL('./painting-worker.mjs',import.meta.url),{type:'module'});worker.onmessage=({data})=>{if(disposed)return;order=data.order;loaded=true;host.dataset.ready='true';schedule();worker.terminate();};worker.postMessage({pixels:source,width:w,height:h,light,left:.2,right:.86},[source.buffer]);};image.src=`${import.meta.env.BASE_URL}images/${study?'classical-ink-studies.png':'roman-fresco-grown.png'}`;
  const io=new IntersectionObserver(([e])=>{visible=e.isIntersecting;if(visible)schedule();else stop();});io.observe(host);const visibility=()=>document.hidden?stop():schedule();const preference=()=>{if(reduce.matches){stop();ctx.clearRect(0,0,c.width,c.height);}else{present();schedule();}};const resize=()=>{if(visible&&!reduce.matches)present();};document.addEventListener('visibilitychange',visibility);reduce.addEventListener('change',preference);addEventListener('resize',resize);
  return()=>{disposed=true;stop();worker?.terminate();image.onload=null;io.disconnect();document.removeEventListener('visibilitychange',visibility);reduce.removeEventListener('change',preference);removeEventListener('resize',resize);};
 },[light,study,duration]);
 return <div ref={root} className={`mural-drawing ${light?'drawing-light':''}`} aria-hidden="true"><canvas ref={canvas}/></div>;
}

