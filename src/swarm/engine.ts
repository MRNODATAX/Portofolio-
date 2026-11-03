/// <reference types="vite/client" />
import { NAMA_AGEN, WARNA_AGEN, type SwarmAgent, type SwarmHandle, type SwarmItem, type SwarmOptions } from './types';

/**
 * Mesin animasi Swarm — Fase 3A.
 *
 * Perubahan besar fase ini: kursor TIDAK lagi digerakkan dengan tween lurus
 * dari A ke B. Tiap kursor punya kecepatan dan gaya dorong sendiri (steering),
 * jalurnya melengkung, dan saat menganggur mereka **berputar mengitari** target
 * seperti gerombolan (boids). Ini yang bikin gerakannya terasa hidup.
 *
 * Semua rumus di bawah ditulis ulang dari spesifikasi perilaku referensi
 * (ukuran, kecepatan, lengkungan, tempo) — bukan salinan kode.
 *
 * Murni DOM + requestAnimationFrame, tanpa dependensi dan tanpa React.
 */

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const acak = (a: number, b: number) => a + Math.random() * (b - a);

// ── konstanta gerombolan ──────────────────────────────────────────────────
/** Kursor yang masuk bersamaan saat pembukaan (spesifikasi: 18). */
const AGEN_INTRO = 18;
/** Batas bawah & atas jumlah kursor yang dipertahankan. */
const AGEN_MIN_BAWAAN = 8;
/** Batas atas kursor yang boleh bekerja bersamaan. */
const AGEN_MAKS = 36;
/**
 * Lantai jumlah kursor saat kinerja diturunkan otomatis (keputusan Mas:
 * HP mulai penuh seperti desktop, baru dikurangi kalau fps benar-benar turun).
 */
const AGEN_LANTAI = 4;

/** Korutin: tiap `yield` menerima `dt` (detik) dari loop animasi. */
type Korutin = Generator<void, void, number>;

interface OpsiPindah {
  /** Pengali kecepatan (0.75 = lebih pelan dari normal). */
  speed?: number;
  /** Sedang menyeret — easing dipertahankan easeInOut sampai akhir. */
  drag?: boolean;
  /** Besar lengkungan; 0 = lurus (dipakai saat menyeret kotak). */
  bend?: number;
  /** Dipanggil setiap langkah — dipakai untuk memperbarui kotak yang digambar. */
  onStep?: () => void;
}

interface Tugas {
  item: SwarmItem;
  kerangka: HTMLDivElement;
  kotak: HTMLDivElement;
  teks?: HTMLDivElement;
  lencana: HTMLDivElement;
  state: 'wait' | 'active' | 'done';
}

interface Pekerja extends SwarmAgent {
  el: HTMLDivElement;
  /** Kecepatan saat ini (px/s). */
  vx: number;
  vy: number;
  /** Kecepatan maksimal (px/s) — 25 % kursor "cepat", sisanya normal. */
  speed: number;
  /** Percepatan maksimal (px/s²). */
  force: number;
  /** Kecepatan berputar saat mengorbit. */
  spin: number;
  /** Arah lengkungan gerak (-1..1). */
  curl: number;
  /** Radius orbit yang diinginkan. */
  orbit: number;
  /** 0..1 — kursor sedang "menekan". */
  press: number;
  /** Kemiringan kursor mengikuti arah gerak (derajat). */
  miring: number;
  tugas?: Tugas;
  gen?: Korutin;
  /** Sedang mengitari target (belum/sudah tidak mengerjakan tugas). */
  follow: boolean;
  /** Sedang keluar layar. */
  leaving: boolean;
  /** Kursor "asli" yang tidak pernah dikeluarkan. */
  home: boolean;
  worked: boolean;
  idleFor: number;
}

const SVG_KURSOR = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M5 3l14 8.2-6.2 1.4L10 20z" fill="currentColor" stroke="#0b0e13" stroke-width="1.1" stroke-linejoin="round"/></svg>`;

export function mulaiSwarm(opsi: SwarmOptions): SwarmHandle {
  const { host, items, speed, background, onDone, bunyi } = opsi;
  /** Jumlah kursor minimum yang selalu dipertahankan (diatur dari /admin). */
  const agenMin = Math.round(clamp(opsi.agents || AGEN_MIN_BAWAAN, 4, 24));
  const agenIntro = Math.min(AGEN_MAKS, Math.max(AGEN_INTRO, agenMin));

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

  const lebar = () => window.innerWidth;
  const tinggi = () => window.innerHeight;

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
      teks.style.padding = '0 2px';
      teks.style.whiteSpace = 'pre-wrap';
      kotak.appendChild(teks);
    }

    const lencana = document.createElement('div');
    lencana.className = 'lencana';

    lapis.appendChild(kerangka);
    lapis.appendChild(kotak);
    lapis.appendChild(lencana);
    return { item, kerangka, kotak, teks, lencana, state: 'wait' as const };
  });

  // ── siapkan agen ─────────────────────────────────────────────────────────
  let urut = 0;
  function buatAgen(x: number, y: number, home = false): Pekerja {
    const id = urut++;
    const cepat = Math.random() < 0.25;
    const el = document.createElement('div');
    el.className = 'agen';
    el.style.color = WARNA_AGEN[id % WARNA_AGEN.length];
    el.innerHTML = `${SVG_KURSOR}`;
    lapisKursor.appendChild(el);
    return {
      nama: NAMA_AGEN[id % NAMA_AGEN.length],
      warna: WARNA_AGEN[id % WARNA_AGEN.length],
      x,
      y,
      el,
      vx: 0,
      vy: 0,
      speed: cepat ? acak(1000, 1500) : acak(300, 750),
      force: cepat ? acak(3500, 6000) : acak(700, 1800),
      spin: cepat ? acak(2.2, 3.4) : acak(0.8, 1.8),
      curl: acak(-1, 1),
      orbit: acak(70, 170),
      press: 0,
      miring: 0,
      follow: false,
      leaving: false,
      home,
      worked: false,
      idleFor: 0,
    };
  }

  const agen: Pekerja[] = [];
  for (let n = 0; n < agenIntro; n++) {
    const kiri = n % 2 === 0;
    const p = buatAgen(
      kiri ? -40 - acak(0, 200) : lebar() + 40 + acak(0, 200),
      acak(0.05, 0.95) * tinggi(),
      n < agenMin,
    );
    p.follow = true;
    agen.push(p);
  }

  let waktu = 0;
  let tempo = 2.1;

  // ── penjaga kinerja adaptif ─────────────────────────────────────────────
  // Dimulai penuh seperti desktop. Bila frame konsisten di bawah 40 fps selama
  // 1,2 detik (diukur SETELAH pembukaan selesai, supaya jank saat halaman
  // dikosongkan tidak ikut terhitung), kursor dikurangi otomatis. Satu arah:
  // tidak dikembalikan, supaya tidak berfluktuasi.
  let fpsHalus = 60;
  let detikLambat = 0;
  let kinerjaTurun = false;
  /** Batas jumlah kursor saat ini — menyusut bila kinerja diturunkan. */
  let batasAgen = agenMin;
  let berhenti = false;
  let rampung = false;
  let dimulai = false;
  let jedaLahir = 0;
  /** Penanda supaya hitung mundur selesai hanya dijadwalkan sekali. */
  let dijadwalkan = false;
  let raf = 0;
  let terakhir = performance.now();
  let watchdog = 0;
  /** Kapan gerombolan mulai mengerjakan tugas (setelah orbit pembuka). */
  const mulaiPada = 0.7 / Math.max(0.2, speed);

  // ── primitif gerak ───────────────────────────────────────────────────────

  /** Tunggu beberapa detik (terpengaruh tempo). */
  function* tunggu(detik: number): Korutin {
    let n = 0;
    while (n < detik) n += (yield) * tempo;
  }

  /**
   * Pindahkan kursor ke target dengan **jalur melengkung**.
   * Lengkungannya (`bend`) digeser tegak lurus arah gerak memakai `sin(π × e)`,
   * sehingga kursor melambung sedikit lalu mendarat tepat di target.
   */
  function* pindah(c: Pekerja, tx: number, ty: number, o: OpsiPindah = {}): Korutin {
    const x0 = c.x;
    const y0 = c.y;
    const jarak = Math.hypot(tx - x0, ty - y0);
    if (jarak < 0.5) {
      c.x = tx;
      c.y = ty;
      o.onStep?.();
      return;
    }
    const dur = clamp(0.12 + Math.sqrt(jarak) * 0.021, 0.14, 0.9) / (o.speed || 1);
    const bend =
      (o.bend != null ? o.bend : (Math.random() < 0.5 ? -1 : 1) * acak(0.04, 0.14)) * Math.min(jarak, 600);
    let t = 0;
    while (t < dur) {
      t += (yield) * tempo;
      const k = Math.min(1, t / dur);
      const e = o.drag || k < 0.15 ? easeInOut(k) : easeOut(k);
      const dx = tx - x0;
      const dy = ty - y0;
      const L = Math.hypot(dx, dy) || 1;
      const off = Math.sin(Math.PI * e) * bend;
      c.x = x0 + dx * e + (-dy / L) * off;
      c.y = y0 + dy * e + (dx / L) * off;
      o.onStep?.();
    }
    c.x = tx;
    c.y = ty;
    o.onStep?.();
  }

  /** Ketik teks karakter demi karakter, dengan jeda acak seperti orang sungguhan. */
  function* ketik(t: Tugas, c: Pekerja): Korutin {
    const teks = t.item.text;
    const N = teks.length;
    if (!t.teks || !N) return;
    // Teks panjang diketik lebih cepat per karakternya.
    const k = clamp(70 / Math.max(1, N), 0.06, 1);
    let anggaran = 0;
    let i = 0;
    while (i < N) {
      anggaran += (yield) * tempo;
      let maju = false;
      while (i < N && anggaran > 0) {
        const ch = teks[i];
        let d = acak(0.012, 0.04);
        if (ch === ' ') d += acak(0, 0.03);
        if (ch === '\n') d += 0.1;
        if (Math.random() < 0.025) d += acak(0.08, 0.2); // ragu sebentar
        anggaran -= d * k;
        i++;
        maju = true;
      }
      if (maju) {
        t.teks.textContent = teks.slice(0, i);
        // Kursor mengikuti ujung teks (perkiraan proporsional).
        const bagian = i / N;
        c.x = t.item.x + clamp(t.item.w * bagian, 2, Math.max(2, t.item.w - 2));
        c.y = t.item.y + Math.min(t.item.h - 2, t.item.fontSize * 1.2);
        bunyi?.ketik();
      }
    }
  }

  /** Satu tugas utuh: terbang → gambar kotak → isi → ketik teksnya. */
  function* kerjakan(c: Pekerja, t: Tugas): Korutin {
    const item = t.item;
    yield* pindah(c, item.x, item.y);
    c.press = 1;
    t.kerangka.style.opacity = '1';
    t.kerangka.style.borderColor = c.warna;
    t.kerangka.style.width = '0px';
    t.kerangka.style.height = '0px';
    t.lencana.style.color = c.warna;
    t.lencana.style.opacity = '1';
    bunyi?.gambar();

    // Tarik kotaknya. Kalau kotaknya lebih besar dari layar, tarik cuma sampai
    // mendekati tepi — supaya kursor tidak "keluar" dari layar.
    const kanan = lebar() - 30;
    const bawah = tinggi() - 40;
    const akhirX = item.x + item.w > kanan ? Math.max(item.x + Math.min(item.w, 40), kanan) : item.x + item.w;
    const akhirY = item.y + item.h > bawah ? Math.max(item.y + Math.min(item.h, 40), bawah) : item.y + item.h;

    yield* pindah(c, akhirX, akhirY, {
      speed: 0.75,
      drag: true,
      bend: 0,
      onStep: () => {
        const w = Math.max(0, c.x - item.x);
        const h = Math.max(0, c.y - item.y);
        t.kerangka.style.width = `${w}px`;
        t.kerangka.style.height = `${h}px`;
        t.lencana.style.transform = `translate(${c.x + 16}px, ${c.y + 22}px)`;
        t.lencana.textContent = `${Math.round(w)} × ${Math.round(h)}`;
      },
    });

    // Kalau tarikan tadi berhenti sebelum kotak penuh, penuhi sisanya.
    if (c.x < item.x + item.w - 0.5 || c.y < item.y + item.h - 0.5) {
      const w0 = Math.max(0, c.x - item.x);
      const h0 = Math.max(0, c.y - item.y);
      let k = 0;
      while (k < 1) {
        k = Math.min(1, k + ((yield) * tempo) / 0.5);
        const w = w0 + (item.w - w0) * k;
        const h = h0 + (item.h - h0) * k;
        t.kerangka.style.width = `${w}px`;
        t.kerangka.style.height = `${h}px`;
        t.lencana.style.transform = `translate(${item.x + w + 16}px, ${item.y + h + 22}px)`;
        t.lencana.textContent = `${Math.round(w)} × ${Math.round(h)}`;
        c.x = item.x + w;
        c.y = item.y + h;
      }
    }

    t.kotak.classList.add('muncul');
    yield* tunggu(0.17);
    c.press = 0;
    bunyi?.gambar();

    if (t.teks && item.text) {
      t.teks.classList.add('mengetik');
      const yTeks = item.y + Math.min(item.h - 2, item.fontSize * 1.2);
      yield* pindah(c, item.x + 3, yTeks, { speed: 1.5 });
      yield* ketik(t, c);
      t.teks.classList.remove('mengetik');
      t.teks.textContent = item.text;
    }

    t.kerangka.style.opacity = '0';
    t.lencana.style.opacity = '0';
  }

  /** Kursor menganggur: berkeliling di tengah layar sambil menunggu tugas. */
  function* menganggur(c: Pekerja): Korutin {
    for (;;) {
      const tx = acak(0.17, 0.83) * lebar();
      const ty = acak(0.2, 0.8) * tinggi();
      yield* pindah(c, tx, ty, { speed: 0.35 });
      let w = acak(0.4, 1.4);
      while (w > 0) w -= yield;
    }
  }

  /** Kursor keluar layar (dipanggil saat tidak ada lagi yang dikerjakan). */
  function* keluar(c: Pekerja): Korutin {
    const kanan = c.x > lebar() / 2;
    yield* pindah(c, kanan ? lebar() + 60 : -60, c.y, { speed: 0.8 });
  }

  // ── gerombolan (boids-ish orbit) ─────────────────────────────────────────

  /**
   * Kursor mengitari titik pusat: ada gaya tangensial (berputar), gaya radial
   * (mendekat/menjauh sesuai radius idaman masing-masing), dan sedikit lengkungan
   * khas tiap kursor. Kursor yang berdekatan juga saling menyesuaikan kecepatan.
   */
  function ikut(dt: number, daftar: Pekerja[], ox: number, oy: number, skala = 1) {
    const R = 135 * skala * (1 + 0.18 * Math.sin(waktu * 0.55));
    const putaran = Math.tanh(Math.cos(waktu * 0.11) * 3);
    const mau: [number, number][] = [];
    for (const c of daftar) {
      const vx = c.x - ox;
      const vy = c.y - oy;
      const d = Math.hypot(vx, vy) || 0.01;
      const nx = vx / d;
      const ny = vy / d;
      const sudut = Math.atan2(vy, vx);
      const off = (c.orbit - 120) * 0.55 * skala;
      const rr = R * (1 + 0.3 * Math.sin(3 * sudut + waktu * 0.7)) + off;
      const tangen = 300 * (0.7 + c.spin * 0.2) * putaran;
      const radial = clamp((rr - d) * 4, -2600, 1400);
      const jauh = clamp((d - rr) / 600, 0, 1);
      mau.push([
        -ny * tangen + nx * radial - ny * c.curl * 400 * jauh,
        nx * tangen + ny * radial + nx * c.curl * 400 * jauh,
      ]);
    }

    for (let i = 0; i < daftar.length; i++) {
      const c = daftar[i];
      let ax = 0;
      let ay = 0;
      let bobot = 0;
      for (let j = 0; j < daftar.length; j++) {
        if (j === i) continue;
        const q = daftar[j];
        const d = Math.hypot(q.x - c.x, q.y - c.y);
        if (d > 90) continue;
        const w = 1 - d / 90;
        ax += q.vx * w;
        ay += q.vy * w;
        bobot += w;
      }
      let [fx, fy] = mau[i];
      if (bobot > 0) {
        fx = fx * 0.7 + (ax / bobot) * 0.3;
        fy = fy * 0.7 + (ay / bobot) * 0.3;
      }
      const jarak = Math.max(0, Math.hypot(c.x - ox, c.y - oy) - 180 * skala);
      const maksV = c.speed * (1.3 + Math.min(3.2, jarak / 90));
      const L = Math.hypot(fx, fy);
      if (L > maksV) {
        fx *= maksV / L;
        fy *= maksV / L;
      }
      let gx = (fx - c.vx) * 6;
      let gy = (fy - c.vy) * 6;
      const maksF = c.force * (1.4 + Math.min(5, jarak / 50));
      const G = Math.hypot(gx, gy);
      if (G > maksF) {
        gx *= maksF / G;
        gy *= maksF / G;
      }
      c.vx += gx * dt;
      c.vy += gy * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.press = Math.max(0, c.press - dt * 6);
      // Miringkan sedikit searah gerak — memberi kesan "ditarik".
      c.miring += (clamp(c.vx / 900, -1, 1) * 14 - c.miring) * Math.min(1, dt * 8);
    }
  }

  // ── pemilihan tugas ──────────────────────────────────────────────────────

  /** Tugas yang belum dikerjakan. */
  function tersedia(): Tugas[] {
    return antrean.filter((t) => t.state === 'wait');
  }

  /**
   * Ambil tugas yang PALING DEKAT dengan kursor — bukan urut dari atas.
   * Referensi memakai jarak murni, dengan bonus besar untuk tugas "guide"
   * (kerangka bagian) supaya struktur halaman tergambar lebih dulu. Bonus itu
   * menyusul di Fase 3B/3C saat kerangka bagian ikut diukur; kini jarak murni.
   */
  function pilih(c: Pekerja, daftar: Tugas[]): Tugas | undefined {
    let terbaik: Tugas | undefined;
    let nilai = Infinity;
    for (const t of daftar) {
      const d = Math.hypot(t.item.x - c.x, t.item.y - c.y);
      if (d < nilai) {
        nilai = d;
        terbaik = t;
      }
    }
    return terbaik;
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

  // ── loop utama ───────────────────────────────────────────────────────────

  function langkah(sekarang: number) {
    if (berhenti) return;
    const dt = Math.min((sekarang - terakhir) / 1000, 0.05);
    terakhir = sekarang;
    waktu += dt;

    const sisa = tersedia();
    // Tempo global: makin banyak pekerjaan & makin banyak kursor, makin cepat.
    tempo = clamp(2.1 + (sisa.length / Math.max(1, agen.length)) * 0.5, 2.1, 4.5) * speed;

    // Ukur fps memakai dt engine (sudah dibatasi 0,05 s → batas bawah 20 fps).
    // Diukur hanya setelah pembukaan lewat, supaya jank awal tidak ikut dihitung.
    if (dimulai && dt > 0) {
      fpsHalus = fpsHalus * 0.9 + (1 / dt) * 0.1;
      if (fpsHalus < 40) detikLambat += dt;
      else detikLambat = 0;
      if (!kinerjaTurun && detikLambat > 1.2) {
        kinerjaTurun = true;
        batasAgen = Math.max(AGEN_LANTAI, Math.round(agenMin / 2));
        // Usir kursor tambahan yang sedang menganggur (yang sedang pegang tugas
        // dibiarkan menyelesaikan dulu supaya tidak ada kotak yang mangkrak).
        let aktif = agen.filter((c) => !c.leaving).length;
        for (const c of agen) {
          if (aktif <= batasAgen) break;
          if (c.leaving || c.home || c.tugas) continue;
          c.leaving = true;
          c.gen = keluar(c);
          aktif--;
        }
      }
    }

    if (!dimulai && waktu >= mulaiPada) {
      dimulai = true;
      for (const c of agen) {
        c.follow = false;
        c.vx = 0;
        c.vy = 0;
      }
    }

    // Kursor yang menganggur berputar mengitari tengah layar.
    const pengikut = agen.filter((c) => c.follow);
    if (pengikut.length) ikut(dt, pengikut, lebar() / 2, tinggi() / 2, dimulai ? 1 : 0.7);

    // Jejak dev: posisi tiap kursor per frame — dipakai pengujian otomatis untuk
    // mengukur gerak sebenarnya (arah masuk, kecepatan, kelengkungan lintasan).
    // Hanya menyala saat `npm run dev`; build produksi membuang blok ini.
    // Ditaruh SEBELUM `return` fase pembukaan supaya gerakan masuk ikut terekam.
    if (import.meta.env.DEV) {
      const g = window as unknown as {
        __jejakSwarm?: number[][];
        __profilSwarm?: { cepat: boolean; speed: number; force: number; spin: number }[];
      };
      if (!g.__jejakSwarm) {
        g.__jejakSwarm = [];
        // Profil kursor (sekali): dipakai pengujian untuk memastikan 25% kursor
        // dibuat "cepat" dengan speed/force/spin 2–3× lebih besar.
        g.__profilSwarm = agen.map((c) => ({
          cepat: c.speed > 900,
          speed: Math.round(c.speed),
          force: Math.round(c.force),
          spin: Number(c.spin.toFixed(2)),
        }));
      }
      if (g.__jejakSwarm.length < 900) {
        const baris: number[] = [Number(waktu.toFixed(4))];
        for (const c of agen) baris.push(Math.round(c.x), Math.round(c.y));
        g.__jejakSwarm.push(baris);
        (window as unknown as { __kinerjaSwarm?: { fps: number; turun: boolean; batas: number } }).__kinerjaSwarm = {
          fps: Math.round(fpsHalus),
          turun: kinerjaTurun,
          batas: batasAgen,
        };
      }
    }

    if (!dimulai) {
      raf = requestAnimationFrame(langkah);
      return;
    }

    // Tambah kursor kalau pekerjaan masih banyak.
    jedaLahir -= dt;
    const diinginkan = Math.min(
      clamp(agenMin + Math.floor(sisa.length / 2), agenMin, AGEN_MAKS),
      Math.max(AGEN_LANTAI, batasAgen),
    );
    const aktif = agen.filter((c) => !c.leaving).length;
    const sibuk = agen.filter((c) => c.tugas).length;
    if (aktif < diinginkan && sisa.length > aktif - sibuk && jedaLahir <= 0) {
      const kiri = Math.random() < 0.5;
      agen.push(buatAgen(kiri ? -40 : lebar() + 40, acak(0.2, 0.8) * tinggi()));
      jedaLahir = 0.035;
    }

    // Bagi tugas ke kursor yang sedang menganggur.
    for (const c of agen) {
      if (c.tugas || c.leaving || c.follow) continue;
      const t = pilih(c, sisa);
      if (!t) continue;
      sisa.splice(sisa.indexOf(t), 1);
      t.state = 'active';
      // Jejak dev: catat jarak tugas yang dipilih vs jarak rata-rata semua
      // tugas yang tersedia — bukti bahwa kursor mengambil yang terdekat.
      if (import.meta.env.DEV) {
        const g = window as unknown as { __tugasSwarm?: number[][] };
        if (!g.__tugasSwarm) g.__tugasSwarm = [];
        if (g.__tugasSwarm.length < 400) {
          const j = (it: Tugas) => Math.hypot(it.item.x - c.x, it.item.y - c.y);
          const kandidat = [...sisa, t];
          const rata = kandidat.reduce((a, b) => a + j(b), 0) / kandidat.length;
          g.__tugasSwarm.push([Number(waktu.toFixed(3)), Math.round(j(t)), Math.round(rata)]);
        }
      }
      c.tugas = t;
      c.worked = true;
      c.idleFor = 0;
      c.gen = kerjakan(c, t);
    }

    // Jalankan satu langkah tiap kursor.
    for (const c of [...agen]) {
      if (c.follow) continue;
      c.press = Math.max(0, c.press - dt * 6);
      if (c.miring) c.miring *= 1 - Math.min(1, dt * 10);
      if (!c.tugas) {
        c.idleFor += dt;
        const jumlahAktif = agen.filter((m) => !m.leaving).length;
        if (!c.leaving && c.idleFor > 2.5 && jumlahAktif > batasAgen && !c.home) {
          c.leaving = true;
          c.gen = keluar(c);
        }
        if (!c.gen) c.gen = menganggur(c);
      }
      if (!c.gen) continue;
      const hasil = c.gen.next(dt);
      if (hasil.done) {
        if (c.tugas) {
          c.tugas.state = 'done';
          c.tugas = undefined;
        }
        c.gen = undefined;
        if (c.leaving) {
          c.el.remove();
          const idx = agen.indexOf(c);
          if (idx >= 0) agen.splice(idx, 1);
        }
      }
    }

    // Pakai transform 3D supaya digabung di GPU.
    for (const c of agen) {
      c.el.style.transform = `translate3d(${Math.round(c.x)}px, ${Math.round(c.y)}px, 0) rotate(${c.miring.toFixed(1)}deg)`;
      c.el.style.opacity = c.leaving ? '0.35' : '1';
    }


    if (!dijadwalkan && !sisa.length && agen.every((c) => !c.tugas)) {
      // Semua tugas selesai: biarkan gerombolan mengitari layar sebentar, lalu
      // usai. Penanda `dijadwalkan` penting — tanpa itu hitung mundur ini
      // dibuat ulang setiap frame dan tidak pernah sempat berbunyi.
      dijadwalkan = true;
      window.clearTimeout(watchdog);
      watchdog = window.setTimeout(selesai, 900);
    }

    raf = requestAnimationFrame(langkah);
  }

  if (!antrean.length || !items.length) {
    selesai();
    return { cancel() {} };
  }

  watchdog = window.setTimeout(selesai, 20000 / Math.max(0.2, speed));
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
