import { useEffect, useState } from 'react';
export function useTheme() {
  const [theme,setTheme]=useState<'dark'|'light'>('dark');
  useEffect(()=>{setTheme(document.documentElement.dataset.theme==='light'?'light':'dark');},[]);
  function toggle(){const next=theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;setTheme(next);try{localStorage.setItem('rhmt-theme',next);}catch{}document.querySelector('meta[name="theme-color"]')?.setAttribute('content',next==='dark'?'#080b10':'#eef0f2');}
  return {theme,toggle};
}
