// Uji penjaga kinerja adaptif: setelah efek berjalan, CPU di-throttle berat
// (20×) sampai fps anjlok di bawah 40. Jumlah kursor harus menyusut otomatis
// (keputusan Mas: HP mulai penuh seperti desktop, baru menyusut kalau berat).
//
// Catatan: throttle dipasang SETELAH efek mulai, bukan sebelum navigasi —
// kalau sebelum, `networkidle2` tidak pernah tercapai dan navigasi timeout.
process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs22.x';
const chromium = await import('@sparticuz/chromium');
const puppeteer = await import('puppeteer-core');
const exe = await chromium.default.executablePath();
const browser = await puppeteer.default.launch({ args: chromium.default.args, executablePath: exe, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
await page.goto('http://127.0.0.1:5173/?swarm=1', { waitUntil: 'domcontentloaded', timeout: 120000 });
try { await page.click('.intro-skip'); } catch {}

let lulus = 0; let gagal = 0;
const cek = (n, ok, info = '') => { if (ok) { lulus++; console.log(`  ✅ ${n} ${info}`); } else { gagal++; console.log(`  ❌ ${n} ${info}`); } };

// tunggu kursor lahir
let awal = 0;
for (let i = 0; i < 300; i++) {
  awal = await page.evaluate(() => {
    const sr = document.querySelector('.swarm-shadow')?.shadowRoot;
    return sr ? sr.querySelectorAll('.agen').length : 0;
  });
  if (awal) break;
  await new Promise((r) => setTimeout(r, 100));
}
cek('efek mulai dengan kursor penuh', awal >= 12, `${awal} kursor`);

const cdp = await page.createCDPSession();
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });

let kinerja = null;
for (let i = 0; i < 300; i++) {
  kinerja = await page.evaluate(() => window.__kinerjaSwarm || null);
  if (kinerja && kinerja.turun) break;
  if (!(await page.evaluate(() => !!document.querySelector('.swarm-shadow')))) break;
  await new Promise((r) => setTimeout(r, 200));
}
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

cek('penurunan otomatis menyala saat fps anjlok', !!kinerja?.turun,
  kinerja ? `fps ${kinerja.fps}, batas kursor ${kinerja.batas}` : 'telemetri kosong');
cek('jumlah kursor diturunkan, tapi tidak sampai nol',
  !!kinerja && kinerja.batas >= 4 && kinerja.batas < awal,
  kinerja ? `${awal} → ${kinerja.batas}` : '');

// Setelah throttle dilepas, pembangunan harus tetap berjalan (tidak macet).
const p1 = await page.evaluate(() => document.querySelector('.swarm-shadow')?.shadowRoot?.querySelectorAll('.kotak.muncul').length ?? -1);
await new Promise((r) => setTimeout(r, 8000));
const p2 = await page.evaluate(() => document.querySelector('.swarm-shadow')?.shadowRoot?.querySelectorAll('.kotak.muncul').length ?? -1);
cek('pembangunan tetap berjalan meski kinerja sempat diturunkan', p2 > p1 || p2 === -1,
  `${p1} → ${p2} kotak selesai`);

console.log(`\nHASIL KINERJA: ${lulus} lulus, ${gagal} gagal`);
await browser.close();
process.exit(gagal ? 1 : 0);
