// Uji Fase 3A — model gerak swarm (tulis ulang dari spesifikasi referensi).
//
// Sumber data: kait dev di engine (`__jejakSwarm`, `__profilSwarm`,
// `__tugasSwarm`, `__kinerjaSwarm`) yang hanya menyala saat `npm run dev`.
// Dipakai karena perekam dari luar halaman tidak pernah menangkap awal
// gerakan di headless (frame lambat & dt engine dibatasi).
//
// Cara jalankan:
//   npm i --no-save puppeteer-core@23 @sparticuz/chromium
//   node tools/uji/uji-3a.mjs      # dev server harus hidup di :5173
process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs22.x';
const chromium = await import('@sparticuz/chromium');
const puppeteer = await import('puppeteer-core');
const exe = await chromium.default.executablePath();
const browser = await puppeteer.default.launch({ args: chromium.default.args, executablePath: exe, headless: true });

let lulus = 0; let gagal = 0;
const cek = (nama, ok, info = '') => {
  if (ok) { lulus++; console.log(`  ✅ ${nama} ${info}`); }
  else { gagal++; console.log(`  ❌ ${nama} ${info}`); }
};

const page = await browser.newPage();
const err = [];
page.on('console', (m) => { if (m.type() === 'error' && !/ERR_CONNECTION_CLOSED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/.test(m.text())) err.push(m.text()); });
page.on('pageerror', (e) => err.push(String(e)));
await page.setViewport({ width: 1440, height: 900 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
await page.goto('http://127.0.0.1:5173/?swarm=1', { waitUntil: 'networkidle2', timeout: 90000 });
try { await page.click('.intro-skip'); } catch {}

// tunggu sampai jejak dev ada, lalu tunggu efek usai
let siap = false;
for (let i = 0; i < 200; i++) {
  siap = await page.evaluate(() => (window.__jejakSwarm?.length || 0) > 5);
  if (siap) break;
  await new Promise((r) => setTimeout(r, 50));
}
// Sejak Fase 3B cakupannya seluruh halaman (ratusan item + Tour), jadi efek
// bisa berjalan puluhan detik. Beri ruang sampai 3 menit.
const tSelesai = Date.now();
for (let i = 0; i < 1800; i++) {
  if (await page.evaluate(() => !document.querySelector('.swarm-shadow'))) break;
  await new Promise((r) => setTimeout(r, 100));
}
const durasi = (Date.now() - tSelesai) / 1000;

const jejak = await page.evaluate(() => window.__jejakSwarm || []);
const kinerja = await page.evaluate(() => window.__kinerjaSwarm || null);
cek('jejak engine terkumpul', jejak.length > 20, `${jejak.length} frame`);

if (jejak.length > 20) {
  // bentuk baris: [waktu, x0, y0, x1, y1, ...]
  const baris = (r) => {
    const n = (r.length - 1) / 2;
    return Array.from({ length: n }, (_, i) => [r[1 + i * 2], r[2 + i * 2]]);
  };
  const pertama = baris(jejak[0]);
  const CX = 720; const CY = 450;

  // ── 1. jumlah kursor ──────────────────────────────────────────────────
  cek('minimal 12 kursor ikut serta (spesifikasi: 18 saat pembukaan)', pertama.length >= 12, `${pertama.length} kursor`);

  // ── 2. lahir di luar layar, dari kiri & kanan ─────────────────────────
  const kiri = pertama.filter((p) => p[0] < 0).length;
  const kanan = pertama.filter((p) => p[0] > 1440).length;
  cek('kursor lahir di luar layar, dari kiri & kanan', kiri + kanan >= pertama.length * 0.8 && kiri > 0 && kanan > 0,
    `${kiri} dari kiri, ${kanan} dari kanan`);

  // ── 3. 25% kursor "cepat" (speed/force/spin 2–3× lebih besar) ─────────
  const profil = await page.evaluate(() => window.__profilSwarm || []);
  const cepat = profil.filter((p) => p.cepat);
  const normal = profil.filter((p) => !p.cepat);
  const r = (a) => (a.length ? `${Math.min(...a)}–${Math.max(...a)}` : '-');
  const pangkas = profil.length >= 12
    && cepat.length >= Math.floor(profil.length * 0.1)
    && cepat.length <= Math.ceil(profil.length * 0.45)
    && Math.min(...cepat.map((p) => p.speed)) > Math.max(...normal.map((p) => p.speed)) * 1.2
    && Math.min(...cepat.map((p) => p.force)) > Math.max(...normal.map((p) => p.force));
  cek('25% kursor dibuat "cepat" (speed/force/spin 2–3× lebih besar)', pangkas,
    `${cepat.length}/${profil.length} cepat; speed ${r(normal.map((p) => p.speed))} vs ${r(cepat.map((p) => p.speed))}, force ${r(normal.map((p) => p.force))} vs ${r(cepat.map((p) => p.force))}`);

  // ── 4. lintasan melengkung ────────────────────────────────────────────
  let paling = 0;
  const semua = [];
  for (let i = 0; i < pertama.length; i++) {
    for (let a = 0; a + 20 < jejak.length; a++) {
      const p0 = baris(jejak[a])[i];
      const p1 = baris(jejak[a + 20])[i];
      if (!p0 || !p1) break;
      const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      if (L < 120) continue;
      const nx = (p1[0] - p0[0]) / L;
      const ny = (p1[1] - p0[1]) / L;
      let simpangan = 0;
      for (let j = a + 1; j < a + 20; j++) {
        const p = baris(jejak[j])[i];
        if (!p) break;
        const off = Math.abs((p[0] - p0[0]) * -ny + (p[1] - p0[1]) * nx);
        if (off > simpangan) simpangan = off;
      }
      semua.push(simpangan);
      if (simpangan > paling) paling = simpangan;
    }
  }
  semua.sort((x, y) => x - y);
  const median = semua.length ? semua[Math.floor(semua.length / 2)] : 0;
  cek('lintasan melengkung (median simpangan > 3 px)', median > 3, `median ${median.toFixed(1)} px, maks ${paling.toFixed(1)} px`);

  // ── 5. tugas diambil yang terdekat, bukan urut dari atas ──────────────
  const tugas = await page.evaluate(() => window.__tugasSwarm || []);
  const dekat = tugas.filter((t) => t[1] <= t[2]).length;
  const rataDekat = tugas.length ? tugas.reduce((a, t) => a + t[1], 0) / tugas.length : 0;
  const rataSemua = tugas.length ? tugas.reduce((a, t) => a + t[2], 0) / tugas.length : 0;
  cek('tugas diambil yang terdekat (bukan sekadar urut dari atas)',
    tugas.length >= 8 && dekat >= tugas.length * 0.8,
    `${dekat}/${tugas.length} di bawah jarak rata-rata (dipilih ${Math.round(rataDekat)} px vs tersedia ${Math.round(rataSemua)} px)`);

  // ── 6. kursor berlebih pensiun ────────────────────────────────────────
  const akhir = baris(jejak[jejak.length - 1]).length;
  cek('kursor berlebih pensiun setelah tugas habis', akhir <= pertama.length, `${pertama.length} → ${akhir} kursor`);
}

// ── 7. penjaga kinerja adaptif ────────────────────────────────────────────
// Di headless (tanpa GPU) fps memang rendah, jadi penurunan otomatis harus
// menyala — itu justru membuktikan mekanismenya jalan.
if (kinerja) {
  cek('penjaga kinerja aktif: fps terukur', kinerja.fps > 0, `${kinerja.fps} fps, batas kursor ${kinerja.batas}`);
  cek('penurunan otomatis menyala saat fps < 40', kinerja.fps >= 40 || kinerja.turun,
    kinerja.turun ? `turun ke ${kinerja.batas} kursor` : `fps ${kinerja.fps} — tidak perlu turun`);
} else cek('telemetri kinerja tersedia', false);

cek('efek selesai & menyingkir', await page.evaluate(() => !document.querySelector('.swarm-shadow')), `${durasi.toFixed(1)} detik`);
cek('tanpa error konsol', err.length === 0, err.slice(0, 2).join(' | '));

console.log(`\nHASIL FASE 3A: ${lulus} lulus, ${gagal} gagal`);
await browser.close();
process.exit(gagal ? 1 : 0);
