import { useEffect, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { nearestShelfIndex, shelfDragIntent, shelfTargets } from '../interaction/shelf.mjs';

type Drag = { pointer: number; x: number; y: number; scroll: number; moved: boolean };

/** Keep the requested control position separate from the frame currently passing through the shelf. */
export function useWorkShelf(resetKey: string) {
  const shelf = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(0), [visiblePosition, setVisiblePosition] = useState(0);
  const navigation = useRef(0), pending = useRef<number | null>(null), drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false), scrollFrame = useRef(0), resizeFrame = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function targets() {
    const el = shelf.current;
    if (!el) return [];
    const origin = el.getBoundingClientRect().left + el.clientLeft;
    const cards = Array.from(el.children, child => {
      const rect = child.getBoundingClientRect();
      return { left: rect.left - origin + el.scrollLeft, width: rect.width };
    });
    return shelfTargets(cards, el.clientWidth, el.scrollWidth, false);
  }
  function read(settled = false) {
    const el = shelf.current;
    if (!el) return;
    const points = targets(), nearest = nearestShelfIndex(points, el.scrollLeft);
    setVisiblePosition(nearest);
    const width=el.clientWidth,left=el.scrollLeft;
    const poses=Array.from(el.children,child=>{const card=child as HTMLElement;return {card,offset:(card.offsetLeft+card.offsetWidth/2-left-width/2)/width};});
    poses.forEach(({card,offset}) => {
      card.style.setProperty('--work-yaw',`${Math.max(-9,Math.min(9,-offset*12))}deg`);
      card.style.setProperty('--work-depth',`${-Math.min(25,Math.abs(offset)*35)}px`);
    });
    if (settled || pending.current !== null && Math.abs(el.scrollLeft - points[pending.current]) < 1.5) pending.current = null;
    if (pending.current === null) { navigation.current = nearest; setPosition(nearest); }
  }
  function settle() {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => read(true), 160);
  }
  function move(index: number, immediate = false) {
    const el = shelf.current, points = targets();
    if (!el || !points.length) return;
    const target = Math.max(0, Math.min(points.length - 1, index));
    pending.current = target; navigation.current = target; setPosition(target);
    const staticMotion = document.documentElement.dataset.motion === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: points[target], behavior: immediate || staticMotion ? 'instant' : 'smooth' });
    read(); settle();
  }
  function onScroll() {
    if (!scrollFrame.current) scrollFrame.current = requestAnimationFrame(() => { scrollFrame.current = 0; read(); });
    settle();
  }
  function interruptNavigation() {
    const el = shelf.current;
    if (el && pending.current !== null) {
      el.scrollTo({ left: el.scrollLeft, behavior: 'instant' });
      pending.current = null; read();
    }
  }
  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!e.isPrimary || e.button !== 0) return;
    suppressClick.current = false;
    interruptNavigation();
    if (e.pointerType === 'mouse') drag.current = { pointer: e.pointerId, x: e.clientX, y: e.clientY, scroll: e.currentTarget.scrollLeft, moved: false };
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const gesture = drag.current;
    if (!gesture || gesture.pointer !== e.pointerId) return;
    const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
    if (!gesture.moved && shelfDragIntent(dx, dy)) {
      gesture.moved = true; suppressClick.current = true;
      e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.classList.add('shelf-dragging');
    }
    if (gesture.moved) { e.preventDefault(); e.currentTarget.scrollLeft = gesture.scroll - dx; }
  }
  function release(e: PointerEvent<HTMLDivElement>, cancelled = false) {
    const gesture = drag.current;
    if (!gesture || gesture.pointer !== e.pointerId) return;
    drag.current = null;
    e.currentTarget.classList.remove('shelf-dragging');
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (cancelled) { suppressClick.current = false; read(true); }
    else if (gesture.moved) move(nearestShelfIndex(targets(), e.currentTarget.scrollLeft));
  }
  function onClickCapture(e: MouseEvent<HTMLDivElement>) {
    if (suppressClick.current && e.detail > 0) { e.preventDefault(); e.stopPropagation(); suppressClick.current = false; }
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || !['ArrowRight','ArrowLeft','Home','End'].includes(e.key)) return;
    e.preventDefault();
    move(e.key === 'Home' ? 0 : e.key === 'End' ? targets().length - 1 : navigation.current + (e.key === 'ArrowRight' ? 1 : -1));
  }
  useEffect(() => {
    const el = shelf.current;
    pending.current = null; navigation.current = 0; drag.current = null; suppressClick.current = false;
    setPosition(0); setVisiblePosition(0); el?.classList.remove('shelf-dragging');
    el?.scrollTo({ left: 0, behavior: 'instant' });
    if (!el) return;
    const onResize = () => {
      if (!resizeFrame.current) resizeFrame.current = requestAnimationFrame(() => {
        resizeFrame.current = 0;
        if (!drag.current?.moved) move(navigation.current, true);
      });
    };
    // An aborted older smooth scroll can emit scrollend after a newer target was requested.
    const onEnd = () => { read(); settle(); };
    const resize = new ResizeObserver(onResize); resize.observe(el);
    if (el.firstElementChild) resize.observe(el.firstElementChild);
    el.addEventListener('scrollend', onEnd);
    window.addEventListener('resize', onResize);
    return () => {
      const gesture = drag.current; drag.current = null;
      if (gesture && el.hasPointerCapture(gesture.pointer)) el.releasePointerCapture(gesture.pointer);
      el.classList.remove('shelf-dragging');
      resize.disconnect(); el.removeEventListener('scrollend', onEnd); window.removeEventListener('resize', onResize);
      clearTimeout(settleTimer.current); cancelAnimationFrame(scrollFrame.current); cancelAnimationFrame(resizeFrame.current);
      scrollFrame.current = 0; resizeFrame.current = 0;
    };
  }, [resetKey]);
  return {
    shelf, position, visiblePosition, move, moveBy: (delta: number) => move(navigation.current + delta),
    handlers: {
      onScroll, onPointerDown, onPointerMove, onClickCapture, onKeyDown, onWheel: interruptNavigation,
      onPointerUp: (e: PointerEvent<HTMLDivElement>) => release(e),
      onPointerCancel: (e: PointerEvent<HTMLDivElement>) => release(e, true),
      onLostPointerCapture: (e: PointerEvent<HTMLDivElement>) => release(e),
      onPointerLeave: () => { if (!drag.current?.moved) drag.current = null; },
      onDragStart: (e: DragEvent<HTMLDivElement>) => e.preventDefault()
    }
  };
}
