import { NAMA_AGEN, WARNA_AGEN, type SwarmAgent, type SwarmHandle, type SwarmItem, type SwarmOptions } from './types';

/**
 * Mesin animasi: menggambar ulang blueprint dengan beberapa kursor sekaligus.
 * Murni DOM + requestAnimationFrame, tanpa dependensi dan tanpa React.
 */

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const acak = (a: number, b: number) => a + Math.random() * (b - a);

type Fase = 'orbit' | 'terbang' | 'gambar' | 'isi' | 'ketik' | 'selesai';

interface Tugas {
  item: SwarmItem;
  kerangka: HTMLDivElement;
  kotak: HTMLDivElement;
  teks?: HTMLDivElement;
  lencana: HTMLDivElement;
}

interface Pekerja extends SwarmAgent {
  el: HTMLDivElement;
  fase: Fase;
  tugas?: Tugas;
  m: number; // waktu fase berjalan (ms)
  durasi: number;
  ax: number; // posisi awal fase terbang
  ay: number;
  bx: number; // posisi tujuan
  by: number;
  sudut: number;
}

const SVG_KURSOR = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 3l14 8.2-6.2 1.4L10 20z" fill="currentColor" stroke="#0b0e13" stroke-width="1.1" stroke-linejoin="round"/></svg>`;

export function mulaiSwarm(opsi: SwarmOptions): SwarmHandle {
  const { host, items, speed, background, onDone, bunyi } = opsi;
  const jumlahAgen = Math.max(1, Math.min(opsi.agents || 5, NAMA_AGEN.length));

  const stage = document.createElement('div');
  stage.className = 'stage';
  stage.style.background = background;
  host.appendChild(stage);

  const lapis = document.createElement('div');
  lapis.className = 'lapis';
  stage.appendChild(lapis);

  const lapisKursor = document.createElement('div');
  lapisKursor.className = 'kursor';
  stage.appendChild(lapisKursor);

  // ── siapkan tugas ────────────────────────────────────────────────────────
  const antrean: Tugas[] = items.map((item) => {
    const kerangka = document.createElement('div');
    kerangka.className = 'kerangka';
    kerangka.style.left = `${item.x}px`;
    kerangka.style.top = `${item.y}px`;
    kerangka.style.borderRadius = `${item.radius}px`;

    const kotak = document.createElement('div');
    kotak.className = 'kotak';
    kotak.style.left = `${item.x}px`;
    kotak.style.top = `${item.y}px`;
    kotak.style.width = `${item.w}px`;
    kotak.style.height = `${item.h}px`;
    kotak.style.borderRadius = `${item.radius}px`;
    if (item.fill) kotak.style.background = item.fill;
    if (item.border) kotak.style.border = item.border;

    let teks: HTMLDivElement | undefined;
    if (item.text) {
      teks = document.createElement('div');
      teks.className = 'teks';
      teks.style.color = item.color;
      teks.style.fontSize = `${item.fontSize}px`;
      teks.style.fontWeight = String(item.fontWeight);
      teks.style.lineHeight = `${item.lineHeight}px`;
      teks.style.textAlign = item.align;
      teks.style.fontFamily = item.font;
      teks.style.padding = item.kind === 'box' ? '0' : '0 2px';
      teks.style.whiteSpace = 'pre-wrap';
      kotak.appendChild(teks);
    }

    const lencana = document.createElement('div');
    lencana.className = 'lencana';

    lapis.appendChild(kerangka);
    lapis.appendChild(kotak);
    lapis.appendChild(lencana);
    return { item, kerangka, kotak, teks, lencana };
  });

  // ── siapkan agen ────────────────────────────────────────────────────────
  const pusatX = window.innerWidth / 2;
  const pusatY = window.innerHeight / 2;
  const agen: Pekerja[] = Array.from({ length: jumlahAgen }, (_, i) => {
    const el = document.createElement('div');
    el.className = 'agen';
    el.style.color = WARNA_AGEN[i % WARNA_AGEN.length];
    el.innerHTML = `${SVG_KURSOR}<span class="nama">${NAMA_AGEN[i % NAMA_AGEN.length]}</span>`;
    lapisKursor.appendChild(el);
    return {
      nama: NAMA_AGEN[i % NAMA_AGEN.length],
      warna: WARNA_AGEN[i % WARNA_AGEN.length],
      el,
      x: pusatX,
      y: pusatY,
      fase: 'orbit' as Fase,
      m: 0,
      durasi: 620,
      ax: pusatX,
      ay: pusatY,
      bx: pusatX,
      by: pusatY,
      sudut: (i / jumlahAgen) * Math.PI * 2,
    };
  });

  let sisa = antrean.length;
  /** Jumlah karakter terakhir per agen — supaya klik ketikan tidak dobel. */
  const hitungTerakhir = new WeakMap<Pekerja, number>();
  let berhenti = false;
  let rampung = false;
  let raf = 0;
  let terakhir = performance.now();
  let watchdog = 0;

  function ambilTugas(p: Pekerja) {
    const tugas = antrean.shift();
    if (!tugas) {
      p.fase = 'selesai';
      p.tugas = undefined;
      p.el.classList.add('diam');
      return;
    }
    p.tugas = tugas;
    p.fase = 'terbang';
    p.m = 0;
    p.ax = p.x;
    p.ay = p.y;
    p.bx = tugas.item.x + 6;
    p.by = tugas.item.y + 6;
    const jarak = Math.hypot(p.bx - p.ax, p.by - p.ay);
    p.durasi = clamp(jarak * 1.1, 190, 620) / speed;
    tugas.kerangka.style.borderColor = p.warna;
    tugas.lencana.style.color = p.warna;
    tugas.lencana.style.opacity = '1';
  }

  function selesaiTugas(p: Pekerja) {
    if (p.tugas) {
      p.tugas.lencana.style.opacity = '0';
      p.tugas.kerangka.style.opacity = '0';
      p.tugas = undefined;
    }
    sisa -= 1;
    if (sisa <= 0) {
      selesai();
      return;
    }
    ambilTugas(p);
  }

  function selesai() {
    if (rampung) return;
    rampung = true;
    window.clearTimeout(watchdog);
    bunyi?.selesai();
    window.setTimeout(() => {
      if (!berhenti) onDone();
    }, 420);
  }

  function langkah(sekarang: number) {
    if (berhenti) return;
    const dt = Math.min(sekarang - terakhir, 48);
    terakhir = sekarang;

    for (const p of agen) {
      p.m += dt;

      if (p.fase === 'orbit') {
        const putaran = Math.min(p.m / p.durasi, 1);
        const radius = 120 * (1 - easeOut(putaran)) + 26;
        const a = p.sudut + putaran * Math.PI * 2.2;
        p.x = pusatX + Math.cos(a) * radius;
        p.y = pusatY + Math.sin(a) * radius * 0.55;
        if (putaran >= 1) ambilTugas(p);
      } else if (p.fase === 'terbang') {
        const t = clamp(p.m / p.durasi, 0, 1);
        const e = easeInOut(t);
        p.x = p.ax + (p.bx - p.ax) * e;
        p.y = p.ay + (p.by - p.ay) * e;
        if (t >= 1) {
          p.fase = 'gambar';
          p.m = 0;
          p.durasi = clamp((p.tugas ? p.tugas.item.w + p.tugas.item.h : 200) * 0.75, 240, 620) / speed;
        }
      } else if (p.fase === 'gambar') {
        const t = clamp(p.m / p.durasi, 0, 1);
        const e = easeOut(t);
        const item = p.tugas?.item;
        if (p.tugas && item) {
          const w = Math.max(item.w * e, 2);
          const h = Math.max(item.h * e, 2);
          p.tugas.kerangka.style.width = `${w}px`;
          p.tugas.kerangka.style.height = `${h}px`;
          p.tugas.lencana.style.transform = `translate(${p.x + 16}px, ${p.y + 22}px)`;
          p.tugas.lencana.textContent = `${Math.round(w)} × ${Math.round(h)}`;
          p.x = item.x + w;
          p.y = item.y + h;
        }
        if (t >= 1) {
          p.fase = 'isi';
          p.m = 0;
          p.durasi = 170 / speed;
          if (p.tugas) p.tugas.kotak.classList.add('muncul');
          bunyi?.gambar();
        }
      } else if (p.fase === 'isi') {
        const t = clamp(p.m / p.durasi, 0, 1);
        if (p.tugas) p.tugas.kotak.style.opacity = String(easeOut(t));
        if (t >= 1) {
          if (p.tugas?.teks && p.tugas.item.ketik) {
            p.fase = 'ketik';
            p.m = 0;
            p.durasi = clamp(p.tugas.item.text.length * 17, 260, 1500) / speed;
            p.tugas.teks.classList.add('mengetik');
          } else {
            if (p.tugas?.teks) p.tugas.teks.textContent = p.tugas.item.text;
            selesaiTugas(p);
          }
        }
      } else if (p.fase === 'ketik') {
        const t = clamp(p.m / p.durasi, 0, 1);
        const item = p.tugas?.item;
        if (p.tugas?.teks && item) {
          const n = Math.round(item.text.length * easeOut(t));
          p.tugas.teks.textContent = item.text.slice(0, n);
          // Kursor mengikuti ujung teks yang sudah diketik (perkiraan proporsional).
          const maju = item.text.length ? n / item.text.length : 1;
          p.x = item.x + clamp(item.w * maju, 2, Math.max(2, item.w - 2));
          p.y = item.y + Math.min(item.h - 2, item.fontSize * 1.2);
          // Klik ketikan — cuma kalau jumlah karakternya bertambah.
          if (n !== hitungTerakhir.get(p)) {
            hitungTerakhir.set(p, n);
            bunyi?.ketik();
          }
        }
        if (t >= 1) {
          if (p.tugas?.teks) {
            p.tugas.teks.textContent = item ? item.text : '';
            p.tugas.teks.classList.remove('mengetik');
          }
          selesaiTugas(p);
        }
      }

      p.el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
      p.el.style.opacity = p.fase === 'selesai' ? '0' : '1';
    }

    raf = requestAnimationFrame(langkah);
  }

  if (!antrean.length || !items.length) {
    selesai();
    return { cancel() {} };
  }

  // Jaga-jaga kalau sesuatu macet: maksimal 15 detik lalu lepas layar.
  watchdog = window.setTimeout(selesai, 15000 / speed);
  raf = requestAnimationFrame(langkah);

  return {
    cancel() {
      berhenti = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(watchdog);
      stage.remove();
    },
  };
}

/** Suara acak kecil untuk variasi posisi awal kursor (dipakai saat replay). */
export function posisiAcak(jumlah: number): { x: number; y: number }[] {
  return Array.from({ length: jumlah }, () => ({
    x: acak(0.15, 0.85) * window.innerWidth,
    y: acak(0.2, 0.8) * window.innerHeight,
  }));
}
