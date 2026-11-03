import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Pengatur kapan efek Swarm boleh jalan.
 *
 * Fase 1 (spike): hanya jalan bila ada flag `?swarm=1` atau localStorage
 * `nodata:swarm=1` — jadi pengunjung reguler belum melihat apa pun.
 *
 * Penjaga (guard):
 * - preferensi "kurangi gerakan" → lewati (kecuali dipaksa lewat ?swarm=1)
 * - mode hemat data / jaringan 2g → lewati
 * - hanya sekali per kunjungan (sessionStorage)
 * - menunggu intro selesai (event `rhmt:intro-complete`)
 */

const KUNCI_SESI = 'nodata:swarm-played';

function koneksiLemah(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!c) return false;
  return Boolean(c.saveData) || /^(slow-)?2g$/.test(c.effectiveType || '');
}

export interface SwarmState {
  aktif: boolean;
  agents: number;
  speed: number;
  /** Naik setiap kali "putar ulang" diminta — dipakai sebagai kunci remount. */
  putaran: number;
  tutup: () => void;
  mainkan: () => void;
}

export function useSwarmIntro(): SwarmState {
  const [aktif, setAktif] = useState(false);
  const [putaran, setPutaran] = useState(0);
  const siap = useRef(false);

  const ringan =
    typeof window !== 'undefined' &&
    (window.matchMedia('(max-width: 900px)').matches || window.matchMedia('(pointer: coarse)').matches);

  const dipaksa = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('swarm') === '1';
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (siap.current) return;
    siap.current = true;

    const paksa = dipaksa();
    const diaktifkan = paksa || window.localStorage.getItem('nodata:swarm') === '1';
    if (!diaktifkan) return;

    // Penjaga
    if (koneksiLemah()) return;
    if (!paksa) {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (window.sessionStorage.getItem(KUNCI_SESI) === '1') return;
    }
    if (window.sessionStorage.getItem(KUNCI_SESI) === '1' && !paksa) return;

    let pengaturWaktu = 0;
    let jalan = () => {
      window.sessionStorage.setItem(KUNCI_SESI, '1');
      setAktif(true);
    };

    const introSelesai = !document.documentElement.hasAttribute('data-intro');
    if (introSelesai) {
      jalan();
    } else {
      const lanjut = () => {
        window.clearTimeout(pengaturWaktu);
        jalan();
      };
      window.addEventListener('rhmt:intro-complete', lanjut, { once: true });
      // Jaga-jaga bila intro tidak pernah memancarkan event-nya.
      pengaturWaktu = window.setTimeout(jalan, 12000);
    }
  }, [dipaksa]);

  const tutup = useCallback(() => setAktif(false), []);

  const mainkan = useCallback(() => {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(KUNCI_SESI, '1');
    setPutaran((n) => n + 1);
    setAktif(false);
    window.setTimeout(() => setAktif(true), 60);
  }, []);

  return {
    aktif,
    agents: ringan ? 4 : 6,
    speed: ringan ? 1.35 : 1,
    putaran,
    tutup,
    mainkan,
  };
}
