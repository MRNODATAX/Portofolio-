import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { GAYA_SWARM } from './styles';
import { mulaiSwarm } from './engine';
import { ukurHeroStabil, warnaLatar } from './snapshot';
import type { SwarmHandle } from './types';
import './swarm.css';

interface Props {
  agents: number;
  speed: number;
  onDone: () => void;
}

/**
 * Apakah masih ada animasi/transisi berdurasi terbatas yang berjalan di hero?
 * Selama `.portrait-assembly` memudar (opacity 0 → 1) Chrome meratakan 3D-nya,
 * sehingga `translateZ(58px)` chip CURRENTLY EXPLORING belum mengembang dan
 * posisinya meleset ~10px. Karena itu pengukuran ditahan sampai animasi selesai.
 * Animasi tanpa henti (portrait-hover, glass-reflect, …) diabaikan.
 */
function heroTenang(): boolean {
  const hero = document.querySelector('.hero');
  if (!hero) return true;
  return !document.getAnimations().some((a) => {
    const target = (a.effect as KeyframeEffect | null)?.target;
    if (!(target instanceof Element) || !hero.contains(target)) return false;
    const putaran = (a.effect?.getTiming?.() as { iterations?: number } | undefined)?.iterations;
    if (putaran === Infinity || putaran === null) return false;
    return a.playState === 'running';
  });
}

/**
 * Tunggu sampai data situs selesai dimuat (`/api/content`), font aktif, dan
 * animasi masuk hero berhenti. Kalau diukur sebelum itu, teks yang tertangkap
 * masih versi bawaan dan rect elemen 3D belum final. Batas 2,5 detik supaya
 * tetap fail-open walau jaringan lambat/gagal.
 */
function tungguSiap(): Promise<void> {
  const batas = performance.now() + 2500;
  return new Promise((selesai) => {
    const periksa = () => {
      const data = document.documentElement.getAttribute('data-content') === 'ready';
      const font = !document.fonts || document.fonts.status === 'loaded';
      if ((data && font && heroTenang()) || performance.now() > batas) selesai();
      else window.setTimeout(periksa, 120);
    };
    periksa();
  });
}

/**
 * Fase 1 (spike): layer yang menutupi layar, mengukur hero, lalu menggambar
 * ulang kerangkanya dengan beberapa kursor. Situs aslinya TIDAK diubah —
 * begini cara paling aman: kalau apa pun gagal, layer tinggal memudar.
 */
export default function SwarmLayer({ agents, speed, onDone }: Props) {
  const bayangan = useRef<HTMLDivElement>(null);
  const keluar = useRef(false);
  const [pergi, setPergi] = useState(false);

  function tutup() {
    if (keluar.current) return;
    keluar.current = true;
    setPergi(true);
    document.documentElement.removeAttribute('data-swarm');
    window.setTimeout(onDone, 320);
  }

  useEffect(() => {
    const host = bayangan.current;
    if (!host) return;

    let pegang: SwarmHandle | null = null;
    let batal = false;
    const waktu: number[] = [];
    const atur = (fn: () => void, ms: number) => {
      waktu.push(window.setTimeout(() => { if (!batal) fn(); }, ms));
    };

    // React StrictMode bisa menjalankan efek dua kali — pakai shadow root yang sudah ada.
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '';

    tungguSiap().then(() => { if (!batal) atur(jalankan, 260); });

    async function jalankan() {
      try {
        const items = await ukurHeroStabil();
        if (!items.length) {
          // Tidak ada yang bisa digambar → langsung lepas layar (fail-open).
          atur(tutup, 60);
          return;
        }

        const gaya = document.createElement('style');
        gaya.textContent = GAYA_SWARM;
        shadow.appendChild(gaya);

        const wadah = document.createElement('div');
        wadah.style.cssText = 'position:absolute;inset:0';
        shadow.appendChild(wadah);

        document.documentElement.setAttribute('data-swarm', 'on');

        pegang = mulaiSwarm({
          host: wadah,
          items,
          agents,
          speed,
          background: warnaLatar(),
          onDone: tutup,
        });
      } catch {
        // Fail-open: error apa pun → tampilkan halaman normal.
        atur(tutup, 60);
      }
    }

    return () => {
      batal = true;
      waktu.forEach((id) => window.clearTimeout(id));
      pegang?.cancel();
      document.documentElement.removeAttribute('data-swarm');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (e.key === 'Escape') tutup();
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`swarm-host${pergi ? ' swarm-leaving' : ''}`} role="status" aria-label="Membangun ulang halaman">
      <div className="swarm-shadow" ref={bayangan} aria-hidden="true" />
      <button type="button" className="swarm-skip" onClick={tutup}>
        <X size={13} /> Lewati
      </button>
    </div>
  );
}
