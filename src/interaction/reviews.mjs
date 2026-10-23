/** Keep a fractional position independent of CSSOM rounding at low autoplay speeds. */
export function advanceReviewRail(position,direction,maximum,delta){
  const max=Math.max(0,maximum),dt=Math.max(0,Math.min(.1,delta));
  const next=Math.max(0,Math.min(max,position+direction*dt*22));
  const atEdge=direction>0?next>=max:next<=0;
  return {position:next,direction:atEdge?-direction:direction,atEdge};
}
