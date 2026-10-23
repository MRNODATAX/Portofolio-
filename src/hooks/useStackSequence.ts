import { useEffect, useRef, useState } from 'react';
/** Three deliberate phases. Time freezes offscreen, in a dialog, or with motion paused. */
export function useStackSequence(paused:boolean){
  const stage=useRef<HTMLDivElement>(null),remaining=useRef(1500),[phase,setPhase]=useState(-1);
  function start(){remaining.current=1500;setPhase(paused?3:0);}
  useEffect(()=>{
    if(phase<0||phase>2||!stage.current)return;
    let visible=false,timer:ReturnType<typeof setTimeout>|undefined,started=0;
    const stop=()=>{if(timer!==undefined){clearTimeout(timer);timer=undefined;remaining.current=Math.max(0,remaining.current-(performance.now()-started));}};
    const wake=()=>{
      stop();
      if(paused||!visible||document.hidden||document.documentElement.hasAttribute('data-intro')||document.documentElement.hasAttribute('data-panel-open'))return;
      started=performance.now();timer=setTimeout(()=>{timer=undefined;remaining.current=1500;setPhase(p=>p+1);},remaining.current);
    };
    const io=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;wake();});io.observe(stage.current);
    const changes=new MutationObserver(wake);changes.observe(document.documentElement,{attributes:true,attributeFilter:['data-intro','data-panel-open']});
    document.addEventListener('visibilitychange',wake);
    return()=>{stop();io.disconnect();changes.disconnect();document.removeEventListener('visibilitychange',wake);};
  },[phase,paused]);
  return {stage,phase,start,running:phase>=0&&phase<3};
}
