import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useSiteData } from '../context/SiteDataContext';

/**
 * The banner frame is a fixed 16:9 landscape window (see `.video-banner` in glass.css).
 * A vertical (portrait) source clip has to be rotated by ±90° to fill that window, and
 * when it is rotated its element box must be swapped as well — otherwise the picture
 * ends up sideways AND cropped (the classic "video miring" bug).
 *
 * Frame is W x H (16:9). After a quarter turn the element's rendered width becomes its
 * height, so the element must be H wide and W tall:
 *   width  = (H / W) * 100% = 56.25%
 *   height = (W / H) * 100% = 177.7778%
 */
const FRAME_RATIO = 16 / 9;

function normalizeRotation(raw: unknown) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  return ((Math.round(value / 90) * 90) % 360 + 360) % 360; // -> 0 | 90 | 180 | 270
}

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
  const rotation = normalizeRotation(VIDEO?.rotation);
  // Putaran seperempat (90° / 270°) berarti sumber video vertikal: kotak elemennya
  // harus ditukar (lebar ↔ tinggi) supaya hasilnya pas mengisi jendela 16:9.
  const quarterTurn = rotation === 90 || rotation === 270;
  const objectFit = VIDEO?.fit === 'contain' ? 'contain' : 'cover';

  const videoStyle = useMemo(
    (): CSSProperties => ({
      width: quarterTurn ? `${100 / FRAME_RATIO}%` : '100%',
      height: quarterTurn ? `${FRAME_RATIO * 100}%` : '100%',
      transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      objectFit,
    }),
    [quarterTurn, rotation, objectFit]
  );

  useEffect(() => {
    setPlaying(false);
  }, [VIDEO?.url]);

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
      <div className="cote-frame">
        <img
          className={`video-poster ${playing ? 'poster-hidden' : ''}`}
          src={VIDEO.poster || '/posters/cote.webp'}
          alt=""
          width="1280"
          height="720"
          loading="lazy"
        />
        <video
          ref={video}
          className="cote-video"
          key={VIDEO.url}
          style={videoStyle}
          muted={muted}
          loop
          playsInline
          preload="none"
          aria-label={`Video ${VIDEO.title}, diputar otomatis dan berulang`}
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
