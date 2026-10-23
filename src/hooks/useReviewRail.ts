import { useEffect, useRef, useState } from 'react';
import { advanceReviewRail } from '../interaction/reviews.mjs';
/** Native swipe plus reversible autoplay. Geometry is measured on wake/resize, not each frame. */
export function useReviewRail(count:number,paused:boolean){
  const rail=useRef<HTMLDivElement>(null),[auto,setAuto]=useState(true),direction=useRef(1),resumeAt=useRef(0),syncPending=useRef(true);
  const hold=()=>{resumeAt.current=performance.now()+5000;syncPending.current=true;};
  function move(by:number){const el=rail.current;if(!el)return;hold();el.scrollBy({left:by*(el.querySelector<HTMLElement>('.visitor-note')?.offsetWidth||el.clientWidth*.8),behavior:paused?'instant':'smooth'});}
  useEffect(()=>{
    const el=rail.current;if(!el||count<2)return;
    let frame=0,last=0,drawAt=0,visible=false,hover=false,focus=false,pressed=false,edgeAt=0,maximum=0,position=0;
    const canMove=()=>auto&&!paused&&visible&&!document.hidden&&!hover&&!focus&&!pressed&&!document.documentElement.hasAttribute('data-intro')&&!document.documentElement.hasAttribute('data-panel-open')&&maximum>2;
    const tick=(now:number)=>{frame=0;if(!canMove())return;if(!drawAt||now-drawAt>=32){const dt=last?Math.min(.1,(now-last)/1000):0;last=now;drawAt=now;if(now>=resumeAt.current&&now>=edgeAt){if(syncPending.current){position=el.scrollLeft;syncPending.current=false;}const next=advanceReviewRail(position,direction.current,maximum,dt);position=next.position;direction.current=next.direction;el.scrollLeft=position;if(next.atEdge)edgeAt=now+1800;}}frame=requestAnimationFrame(tick);};
    const wake=()=>{cancelAnimationFrame(frame);frame=0;last=0;drawAt=0;maximum=Math.max(0,el.scrollWidth-el.clientWidth);position=el.scrollLeft;if(canMove())frame=requestAnimationFrame(tick);};
    const enter=(event:PointerEvent)=>{if(event.pointerType==='mouse'){hover=true;wake();}},leave=()=>{hover=false;hold();wake();},down=()=>{pressed=true;wake();},up=()=>{if(!pressed)return;pressed=false;hold();wake();},focusIn=()=>{focus=true;wake();},focusOut=()=>{focus=el.contains(document.activeElement);hold();wake();};
    const io=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;wake();});io.observe(el);
    const resize=new ResizeObserver(wake);resize.observe(el);
    const changes=new MutationObserver(wake);changes.observe(document.documentElement,{attributes:true,attributeFilter:['data-intro','data-panel-open']});
    el.addEventListener('pointerenter',enter);el.addEventListener('pointerleave',leave);el.addEventListener('pointerdown',down);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);el.addEventListener('focusin',focusIn);el.addEventListener('focusout',focusOut);el.addEventListener('wheel',hold,{passive:true});document.addEventListener('visibilitychange',wake);
    return()=>{cancelAnimationFrame(frame);io.disconnect();resize.disconnect();changes.disconnect();el.removeEventListener('pointerenter',enter);el.removeEventListener('pointerleave',leave);el.removeEventListener('pointerdown',down);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);el.removeEventListener('focusin',focusIn);el.removeEventListener('focusout',focusOut);el.removeEventListener('wheel',hold);document.removeEventListener('visibilitychange',wake);};
  },[count,paused,auto]);
  return {rail,auto,setAuto,move,hold};
}
