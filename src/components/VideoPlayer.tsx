import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useSiteData } from '../context/SiteDataContext';

export default function VideoPlayer() {
  const { siteData } = useSiteData();
  const VIDEO = siteData.personal.video;
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const visible = useRef(false);
  const mouseInside = useRef(false);
  const hide = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [muted, setMuted] = useState(true);
  const [title, setTitle] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);

  function reveal() {
    clearTimeout(hide.current);
    setTitle(true);
    if (!mouseInside.current) hide.current = setTimeout(() => setTitle(false), 2600);
  }
  function toggleAudio() {
    const el = video.current;
    const next = el ? !el.muted : !muted;
    if (el) {
      el.muted = next;
      if (visible.current && !document.hidden) void el.play().catch(() => {});
    }
    setMuted(next);
    reveal();
  }

  useEffect(() => {
    const el = video.current;
    const surface = frame.current;
    if (!el || !VIDEO?.url) return;
    const resume = () => {
      if (!visible.current || document.hidden) return;
      if (el.getAttribute('src') !== VIDEO.url) {
        el.src = VIDEO.url;
        el.load();
      } else if (el.error) el.load();
      void el.play().catch(() => {});
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry.isIntersecting && entry.intersectionRatio >= 0.15;
        if (visible.current) resume();
        else el.pause();
      },
      { threshold: 0.15 }
    );
    if (frame.current) io.observe(frame.current);
    const change = () => {
      if (document.hidden) el.pause();
      else resume();
    };
    const gesture = () => {
      if (el.paused) resume();
    };
    document.addEventListener('visibilitychange', change);
    surface?.addEventListener('pointerdown', gesture);
    return () => {
      io.disconnect();
      clearTimeout(hide.current);
      document.removeEventListener('visibilitychange', change);
      surface?.removeEventListener('pointerdown', gesture);
    };
  }, [VIDEO?.url]);

  if (!VIDEO?.url) return null;

  return (
    <div
      className="video-banner"
      ref={frame}
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') {
          mouseInside.current = true;
          clearTimeout(hide.current);
          setTitle(true);
        }
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') {
          mouseInside.current = false;
          setTitle(false);
        }
      }}
      onPointerDown={reveal}
    >
      <img
        className={`video-poster ${playing ? 'poster-hidden' : ''}`}
        src={VIDEO.poster || '/posters/cote.webp'}
        alt=""
        width="1280"
        height="720"
        loading="lazy"
      />
      <div className={VIDEO.rotation ? 'video-rotated-wrap' : 'video-standard-wrap'}>
        <video
          ref={video}
          muted={muted}
          loop
          playsInline
          preload="none"
          aria-label={VIDEO.title}
          onPlaying={() => {
            setPlaying(true);
            setError(false);
          }}
          onError={() => setError(true)}
        />
      </div>
      <div className={`video-title ${title ? 'video-title-visible' : ''}`}>
        <h3>{VIDEO.title}</h3>
      </div>
      <button
        className="video-audio"
        onClick={toggleAudio}
        onFocus={reveal}
        aria-pressed={!muted}
        aria-label={muted ? 'Aktifkan audio video' : 'Bisukan audio video'}
      >
        {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
      </button>
      {error && (
        <span className="video-status" role="status">
          Video sedang tidak tersedia.
        </span>
      )}
    </div>
  );
}
