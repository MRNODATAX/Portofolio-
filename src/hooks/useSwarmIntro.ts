import { useCallback, useEffect, useRef, useState } from 'react';
import { useSiteData } from '../context/SiteDataContext';
import { musikSedangMenyala } from '../lib/audioBus';

/**
 * Pengatur kapan efek Swarm boleh jalan.
 *
 * Fase 2: **tayang otomatis untuk semua pengunjung setiap kali halaman dimuat /
 * di-refresh**, tanpa tombol ulangi (sesuai permintaan Mas). Pengaturannya ada di
 * `/admin` → tab "Backsound & Suara" (blok `swarm` di data situs).
 *
 * Penjaga (guard) yang tetap berlaku:
 * - preferensi "kurangi gerakan" → lewati (kecuali dipaksa lewat ?swarm=1)
 * - mode hemat data / jaringan 2g → lewati
 * - menunggu intro selesai (event `rhmt:intro-complete`)
 *
 * Penunda URL: `?swarm=1` memaksa tayang (untuk menguji), `?swarm=0` mematikannya.
 */

function koneksiLemah(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!c) return false;
  return Boolean(c.saveData) || /^(slow-)?2g$/.test(c.effectiveType || '');
}

const angka = (v: unknown, bawaan: number, min: number, maks: number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return bawaan;
  return Math.max(min, Math.min(maks, n));
};

export interface SwarmState {
  aktif: boolean;
  agents: number;
  speed: number;
  /** Naik setiap kali efek dimulai — dipakai sebagai kunci remount. */
  putaran: number;
  /** Boleh bersuara (sudah mempertimbangkan aturan PR #7). */
  suara: boolean;
  tutup: () => void;
}

export function useSwarmIntro(): SwarmState {
  const { siteData } = useSiteData();
  const swarm = siteData?.swarm;
  const [aktif, setAktif] = useState(false);
  const [suara, setSuara] = useState(false);
  const [putaran, setPutaran] = useState(0);
  const siap = useRef(false);

  const ringan =
    typeof window !== 'undefined' &&
    (window.matchMedia('(max-width: 900px)').matches || window.matchMedia('(pointer: coarse)').matches);

  const agenMentah = ringan ? swarm?.agents?.mobile : swarm?.agents?.desktop;
  const agents = Math.round(angka(agenMentah, ringan ? 4 : 6, 2, 8));
  const speed = angka(swarm?.speed, 1, 0.6, 1.8) * (ringan ? 1.15 : 1);

  const diizinkan = swarm?.enabled !== false;
  const otomatis = swarm?.auto !== false;
  const bolehBersuara = swarm?.sound !== false;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const param = new URLSearchParams(window.location.search).get('swarm');
    if (param === '0') return; // dimatikan lewat URL
    const dipaksa = param === '1';

    if (!dipaksa) {
      if (!diizinkan) return;
      if (!otomatis) {
        // Mode lama (Fase 1): hanya jalan kalau diminta lewat localStorage.
        let diminta = false;
        try {
          diminta = window.localStorage.getItem('nodata:swarm') === '1';
        } catch {
          diminta = false;
        }
        if (!diminta) return;
      }
      if (koneksiLemah()) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    }

    let pengaturWaktu = 0;
    const jalan = () => {
      // Cukup sekali per mount. Penjagaan di sini (bukan di awal efek) supaya
      // StrictMode yang menjalankan efek dua kali tidak membuat listener hilang
      // tanpa diganti.
      if (siap.current) return;
      siap.current = true;
      window.clearTimeout(pengaturWaktu);
      window.removeEventListener('rhmt:intro-complete', jalan);
      // Aturan PR #7: bunyi hanya kalau pengunjung sudah menyalakan backsound sendiri.
      setSuara(dipaksa ? bolehBersuara : bolehBersuara && musikSedangMenyala());
      setPutaran((n) => n + 1);
      setAktif(true);
    };

    const introSelesai = !document.documentElement.hasAttribute('data-intro');
    if (introSelesai) {
      jalan();
    } else {
      window.addEventListener('rhmt:intro-complete', jalan, { once: true });
      // Jaga-jaga bila intro tidak pernah memancarkan event-nya.
      pengaturWaktu = window.setTimeout(jalan, 12000);
    }

    return () => {
      window.removeEventListener('rhmt:intro-complete', jalan);
      window.clearTimeout(pengaturWaktu);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diizinkan, otomatis, bolehBersuara]);

  const tutup = useCallback(() => setAktif(false), []);

  return { aktif, agents, speed, putaran, suara, tutup };
}
