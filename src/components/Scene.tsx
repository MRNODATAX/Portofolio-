import { useRef, useState, type PointerEvent } from 'react';
import { ArrowUpRight, Braces, Layers3 } from 'lucide-react';
import { useSiteData } from '../context/SiteDataContext';

export default function Scene({ paused = false }: { mode?: 'hero'; paused?: boolean }) {
  const { siteData } = useSiteData();
  const { identity, archive, personal } = siteData;
  const favAnime = personal.anime[0];

  const photos = [
    {
      id: 'portrait',
      src: identity.portraitImage || '/images/nodata-portrait.jpg',
      alt: `Foto ${identity.fullName} (${identity.name})`,
      title: identity.name,
      caption: identity.heroStack?.portraitCaption || 'Fresh Graduate · Web & App Dev',
      focal: identity.portraitFocal || 'center 42%',
      width: 768,
      height: 1376,
    },
    {
      id: 'work',
      src: identity.heroStack?.workImage || '/components/works/repo-flow.svg',
      alt: `Ilustrasi karya pilihan ${identity.name}`,
      title: identity.heroStack?.workTitle || 'Selected Works',
      caption: `${archive.projects.length} karya & eksperimen`,
      focal: 'center',
      width: 820,
      height: 500,
    },
    {
      id: 'personal',
      src: favAnime?.image || '/images/anime-v22/alya.jpg',
      alt: favAnime?.name || 'Alya Kujou',
      title: favAnime?.name || 'Alya Kujou',
      caption: identity.heroStack?.personalCaption || 'A little more me.',
      focal: favAnime?.focal || '50% 18%',
      width: 736,
      height: 1226,
    },
  ];

  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [order, setOrder] = useState([0, 1, 2]);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(0);

  function cycle(direction: number, focus = false) {
    const next = direction > 0 ? order[1] : order[order.length - 1];
    choose(next);
    if (focus) ref.current?.querySelector<HTMLButtonElement>(`[data-photo-index="${next}"]`)?.focus({ preventScroll: true });
  }
  function down(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' || !(e.target as HTMLElement).closest('.portrait-assembly')) return;
    gesture.current = { x: e.clientX, y: e.clientY };
  }
  function up(e: PointerEvent<HTMLDivElement>) {
    const origin = gesture.current;
    gesture.current = null;
    if (!origin) return;
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      cycle(dx < 0 ? 1 : -1);
      suppressClick.current = performance.now() + 400;
    }
  }
  function choose(index: number) {
    setOrder((current) => [index, ...current.filter((i) => i !== index)]);
  }
  function tilt(e: PointerEvent<HTMLDivElement>) {
    if (paused || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    ref.current?.style.setProperty('--glass-light-x', `${((e.clientX - r.left) / r.width) * 100}%`);
    ref.current?.style.setProperty('--glass-light-y', `${((e.clientY - r.top) / r.height) * 100}%`);
    ref.current?.style.setProperty('--tilt-x', `${(-((e.clientY - r.top - r.height / 2) / r.height)) * 8}deg`);
    ref.current?.style.setProperty('--tilt-y', `${((e.clientX - r.left - r.width / 2) / r.width) * 10}deg`);
  }
  function reset() {
    ref.current?.style.setProperty('--tilt-x', '0deg');
    ref.current?.style.setProperty('--tilt-y', '0deg');
  }

  const exploringLines = (identity.heroExploringText || 'Web, App & AI\nBot Automation').split('\n');

  return (
    <div
      className={`scene scene-hero ${expanded ? 'stack-open' : ''}`}
      ref={ref}
      onPointerMove={tilt}
      onPointerLeave={reset}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={() => {
        gesture.current = null;
      }}
      onClickCapture={(e) => {
        if (performance.now() < suppressClick.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      data-paused={paused}
    >
      <div className="portrait-assembly">
        {photos.map((photo, index) => {
          const slot = order.indexOf(index);
          return (
            <button
              type="button"
              key={photo.id}
              className={`portrait-sheet ${
                slot === 0 ? 'portrait-glass' : `portrait-backplate ${slot === 1 ? 'backplate-work' : 'backplate-personal'}`
              }`}
              data-slot={slot}
              data-photo-index={index}
              aria-label={`${slot === 0 ? 'Gambar utama:' : 'Tampilkan di depan:'} ${photo.title}`}
              aria-pressed={slot === 0}
              onClick={() => choose(index)}
              onKeyDown={(e) => {
                if (slot === 0 && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                  e.preventDefault();
                  cycle(e.key === 'ArrowRight' ? 1 : -1, true);
                }
              }}
            >
              <div className={`portrait-window ${photo.id === 'portrait' ? 'portrait-original' : 'portrait-art'}`}>
                <img
                  src={photo.src}
                  alt={photo.alt}
                  width={photo.width}
                  height={photo.height}
                  style={{ objectPosition: photo.focal }}
                  fetchPriority={index === 0 ? 'high' : 'auto'}
                  loading={index === 0 ? 'eager' : 'lazy'}
                />
              </div>
              <span className="portrait-caption">
                <strong>{photo.title}</strong>
                <span>{photo.caption}</span>
              </span>
              <span className="portrait-sheen" aria-hidden="true" />
              <span className="glass-corner corner-one" />
              <span className="glass-corner corner-two" />
            </button>
          );
        })}
        <div className="portrait-exploring">
          <Braces size={18} />
          <div>
            <small>{identity.heroExploringLabel || 'CURRENTLY EXPLORING'}</small>
            <span>
              {exploringLines.map((line, idx) => (
                <span key={idx}>
                  {idx > 0 && <br />}
                  {line}
                </span>
              ))}
            </span>
          </div>
          <ArrowUpRight size={15} />
        </div>
        <div className="portrait-location">
          <span aria-hidden="true" className="indonesia-flag" />
          <div>
            <strong>{identity.heroLocationLabel || 'JAKARTA, ID'}</strong>
            <span>{identity.heroLocationSub || 'Research & build.'}</span>
          </div>
        </div>
        <span className="portrait-signature" aria-hidden="true">
          {identity.signature || 'No_Data.'}
        </span>
      </div>
      <div className="stack-controls">
        <button className="stack-toggle" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} aria-controls="photo-choices">
          <Layers3 size={15} />
          {expanded ? 'Rapatkan stack' : 'Buka stack'}
          <span aria-hidden="true">{expanded ? '−' : '+'}</span>
        </button>
        <div hidden={!expanded} className="photo-choices" id="photo-choices" aria-label="Pilih gambar stack">
          {photos.map((photo, i) => (
            <button key={photo.id} aria-label={`Tampilkan ${photo.title}`} aria-pressed={order[0] === i} onClick={() => choose(i)}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              {photo.title}
            </button>
          ))}
        </div>
      </div>
      <span className="sr-only" aria-live="polite">
        Gambar utama: {photos[order[0]].title}
      </span>
    </div>
  );
}
