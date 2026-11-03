/**
 * Bunyi sintetis untuk efek Swarm — **nol kilobyte**, tidak ada berkas audio.
 *
 * Terinspirasi repo aslinya (DhvanilPatel/swarm-cursors): ketikan pelan saat teks
 * diketik, dan nada "piano kaca" setiap kali sebuah kotak selesai digambar.
 *
 * Aturan PR #7 tetap berlaku:
 * - Bunyi hanya dibuat kalau pengunjung **sudah** menyalakan backsound sendiri
 *   (tidak ada autoplay dalam bentuk apa pun).
 * - Selama efek berjalan backsound diredam, lalu dikembalikan setelahnya
 *   (aturan saling eksklusif).
 *
 * Semua kegagalan di sini tidak boleh mengganggu efek visual — karena itu setiap
 * jalan keluar dibungkus `try/catch` dan `mulaiBunyiSwarm()` mengembalikan `null`
 * kalau WebAudio tidak tersedia.
 */

export interface BunyiSwarm {
  /** Sebuah kotak mulai digambar. */
  gambar(): void;
  /** Satu karakter selesai diketik (sudah di-throttle di dalam). */
  ketik(): void;
  /** Seluruh blueprint rampung. */
  selesai(): void;
  /** Lepas sumber daya (dipanggil saat layer ditutup). */
  tutup(): void;
}

// Nada piano kaca: E mayor pentatonik (E4, F#4, G#4, B4, C#5).
const NADA = [329.63, 369.99, 415.3, 493.88, 554.37];
const JEDA_KETIK = 42; // ms — jangan bunyi untuk setiap karakter

export function mulaiBunyiSwarm(): BunyiSwarm | null {
  try {
    const Buat: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Buat) return null;

    const ctx = new Buat();
    // Browser bisa memberi context dalam keadaan `suspended` walau sudah ada gesture.
    void ctx.resume().catch(() => undefined);

    const induk = ctx.createGain();
    induk.gain.value = 0.085; // pelan: efeknya latar, bukan konser
    induk.connect(ctx.destination);

    let terakhirKetik = 0;
    let indeksNada = 0;
    let ditutup = false;

    /** Satu nada pendek dengan envelope lembut. */
    function nada(frekuensi: number, durasi: number, jenis: OscillatorType, puncak: number) {
      if (ditutup) return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = jenis;
        osc.frequency.value = frekuensi;
        const kini = ctx.currentTime;
        gain.gain.setValueAtTime(0.0001, kini);
        gain.gain.exponentialRampToValueAtTime(puncak, kini + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, kini + durasi);
        osc.connect(gain);
        gain.connect(induk);
        osc.start(kini);
        osc.stop(kini + durasi + 0.02);
      } catch {
        // Audio yang gagal tidak boleh menghentikan animasi.
      }
    }

    return {
      gambar() {
        // Naik pelan mengikuti urutan kotak, lalu melingkar.
        const f = NADA[indeksNada % NADA.length];
        indeksNada += 1;
        nada(f, 0.26, 'triangle', 0.5);
      },
      ketik() {
        const kini = performance.now();
        if (kini - terakhirKetik < JEDA_KETIK) return;
        terakhirKetik = kini;
        // Klik keyboard: bunyi pendek, sedikit acak supaya tidak monoton.
        nada(1500 + Math.random() * 700, 0.035, 'square', 0.16);
      },
      selesai() {
        // Akord lembut penutup.
        NADA.filter((_, i) => i % 2 === 0).forEach((f, i) => {
          window.setTimeout(() => nada(f, 0.9, 'triangle', 0.4), i * 90);
        });
      },
      tutup() {
        if (ditutup) return;
        ditutup = true;
        // Beri waktu nada penutup selesai sebelum context ditutup.
        window.setTimeout(() => {
          try {
            void ctx.close();
          } catch {
            // Sudah tertutup — tidak apa-apa.
          }
        }, 1400);
      },
    };
  } catch {
    return null;
  }
}
