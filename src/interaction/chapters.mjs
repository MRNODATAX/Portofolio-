const clamp=value=>Math.min(1,Math.max(0,value));
/** Progress starts when the next chapter reaches the screen and ends below the header. */
export function coverProgress(archiveTop,viewportHeight,headerHeight,initialArchiveTop=viewportHeight){const start=Math.min(viewportHeight,initialArchiveTop);return clamp((start-archiveTop)/Math.max(1,start-headerHeight));}
/** Tall mobile heroes scroll naturally first, then pin their trailing scene for the handoff. */
export function heroPinTop(heroHeight,viewportHeight,headerHeight){return Math.min(headerHeight,viewportHeight-heroHeight);}
