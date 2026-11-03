import { useCallback, useEffect, useRef, useState } from 'react';
import { Music2 } from 'lucide-react';
import { useSiteData } from '../context/SiteDataContext';
import {
  announceMusicStart,
  announceMusicStop,
  onVideoAudioOn,
} from '../lib/audioBus';

const PREF_KEY = 'nodata-music-v1';
const FADE_MS = 420;

function readWantsMusic() {
  try {
    return window.localStorage.getItem(PREF_KEY) === 'on';
  } catch {
    return false;
  }
}

function writeWantsMusic(on: boolean) {
  try {
    window.localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    // localStorage bisa penuh / diblokir (mode penyamaran) — tidak fatal.
  }
}

/**
 * Tombol backsound di header.
 *
 * Browser memblokir audio yang bunyi sendiri, jadi musik **tidak pernah** diputar
 * sebelum ada gesture. Kalau pengunjung pernah menyalakan musik, preferensinya
 * disimpan: pada kunjungan berikutnya musik menyala otomatis begitu ia berinteraksi
 * sekali saja (klik / ketuk / scroll) — tetap tanpa suara mendadak saat halaman dibuka.
 */
export default function SoundToggle({ className = '' }: { className?: string }) {
  const { siteData } = useSiteData();
  const sound = siteData.sound;
  const audio = useRef<HTMLAudioElement | null>(null);
  const fade = useRef<ReturnType<typeof setInterval> | null>(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const pausedByTab = useRef(false);

  const url = sound?.url || '';
  const enabled = Boolean(sound?.enabled && url);
  const title = sound?.title || 'Backsound';
  const baseVolume = Math.min(1, Math.max(0, Number(sound?.volume ?? 0.35) || 0.35));

  const stopFade = useCallback(() => {
    if (fade.current) {
      clearInterval(fade.current);
      fade.current = null;
    }
  }, []);

  /** Naikkan / turunkan volume bertahap supaya tidak "njeglek". */
  const fadeTo = useCallback(
    (target: number, done?: () => void) => {
      const el = audio.current;
      if (!el) return;
      stopFade();
      const from = el.volume;
      const steps = 14;
      const stepMs = Math.max(16, Math.round(FADE_MS / steps));
      let i = 0;
      fade.current = setInterval(() => {
        i += 1;
        const ratio = Math.min(1, i / steps);
        el.volume = Math.min(1, Math.max(0, from + (target - from) * ratio));
        if (i >= steps) {
          stopFade();
          el.volume = target;
          done?.();
        }
      }, stepMs);
    },
    [stopFade]
  );

  const stop = useCallback(
    (announce = true) => {
      const el = audio.current;
      if (!el) return;
      stopFade();
      writeWantsMusic(false);
      const finish = () => {
        el.pause();
        try {
          el.currentTime = 0;
        } catch {
          // Beberapa browser menolak seek sebelum metadata siap — aman diabaikan.
        }
        setPlaying(false);
        if (announce) announceMusicStop();
      };
      if (el.paused) {
        finish();
        return;
      }
      fadeTo(0, finish);
    },
    [fadeTo, stopFade]
  );

  const start = useCallback(() => {
    const el = audio.current;
    if (!el || !url) return;
    if (el.getAttribute('src') !== url) {
      el.src = url;
      el.load();
    }
    el.volume = 0;
    el.loop = true;
    const attempt = el.play();
    if (attempt && typeof attempt.then === 'function') {
      attempt
        .then(() => {
          setPlaying(true);
          setBlocked(false);
          writeWantsMusic(true);
          fadeTo(baseVolume);
          announceMusicStart();
        })
        .catch(() => {
          // Autoplay diblokir browser (belum ada gesture) atau berkas gagal dimuat.
          setPlaying(false);
          setBlocked(true);
        });
    } else {
      setPlaying(true);
      writeWantsMusic(true);
      fadeTo(baseVolume);
      announceMusicStart();
    }
  }, [baseVolume, fadeTo, url]);

  // Elemen <audio> tunggal yang dipakai bersama (loop, tidak di-preload sebelum diperlukan).
  useEffect(() => {
    if (!enabled) return;
    const el = new Audio();
    el.preload = 'none';
    el.loop = true;
    el.setAttribute('playsinline', '');
    el.src = url;
    audio.current = el;
    setReady(true);
    return () => {
      stopFade();
      el.pause();
      el.src = '';
      audio.current = null;
      setReady(false);
    };
  }, [enabled, url, stopFade]);

  // Musik berhenti bila pengunjung menyalakan audio video (perilaku saling eksklusif).
  useEffect(() => onVideoAudioOn(() => stop(false)), [stop]);

  // Mode "ingat preferensi" (autoStart): pengunjung yang pernah menyalakan musik
  // akan didengarkan lagi — menyala otomatis setelah interaksi pertama, bukan begitu
  // halaman dibuka. Tanpa pengaturan ini musik murni dikendalikan tombol.
  useEffect(() => {
    if (!enabled || playing) return;
    if (!sound?.autoStart) return;
    if (typeof window === 'undefined' || !readWantsMusic()) return;
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
    const kick = () => {
      cleanup();
      start();
    };
    const cleanup = () => {
      for (const evt of events) window.removeEventListener(evt, kick);
    };
    for (const evt of events) window.addEventListener(evt, kick, { passive: true });
    return cleanup;
  }, [enabled, playing, start, sound?.autoStart]);

  // Jeda saat tab disembunyikan, lanjutkan lagi (tanpa bunyi tiba-tiba) saat tab kembali.
  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      const el = audio.current;
      if (!el) return;
      if (document.hidden) {
        if (!el.paused) {
          el.pause();
          pausedByTab.current = true;
          setPlaying(false);
          announceMusicStop();
        }
      } else if (pausedByTab.current) {
        pausedByTab.current = false;
        el.play()
          .then(() => {
            setPlaying(true);
            fadeTo(baseVolume);
            announceMusicStart();
          })
          .catch(() => setBlocked(true));
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [enabled, baseVolume, fadeTo]);

  if (!enabled || !ready) return null;

  const toggle = () => {
    if (playing) {
      stop();
      return;
    }
    setBlocked(false);
    start();
  };

  const label = playing
    ? `Matikan backsound: ${title}`
    : blocked
      ? `Backsound diblokir browser. Ketuk untuk memutar: ${title}`
      : `Putar backsound: ${title}`;

  return (
    <button
      className={`sound-toggle ${playing ? 'sound-on' : ''} ${blocked ? 'sound-blocked' : ''} ${className}`}
      onClick={toggle}
      aria-pressed={playing}
      aria-label={label}
      title={label}
      type="button"
    >
      {playing ? (
        <span className="sound-eq" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      ) : (
        <Music2 size={18} aria-hidden="true" />
      )}
    </button>
  );
}
