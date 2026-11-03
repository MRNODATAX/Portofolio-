// Uji penjaga kinerja adaptif: dengan CPU di-throttle berat, fps turun di
// bawah 40 → jumlah kursor harus dikurangi otomatis (keputusan Mas: HP mulai
// penuh seperti desktop, baru menyusut kalau benar-benah berat).
process.env.AWS_LAMBDA_JS_RUNTIME = 'nodejs22.x';
const chromium = await import('@sparticuz/chromium');
const puppeteer = await import('puppeteer-core');
const exe = await chromium.default.executablePath();
const browser = await puppeteer.default.launch({ args: chromium.default.args, executablePath: exe, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844 });
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
const cdp = await page.createCDPSession();
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
await page.goto('http://127.0.0.1:5173/?swarm=1', { waitUntil: 'networkidle2', timeout: 120000 });
try { await page.click('.intro-skip'); } catch {}

let kinerja = null;
for (let i = 0; i < 300; i++) {
  kinerja = await page.evaluate(() => window.__kinerjaSwarm || null);
  if (kinerja && kinerja.turun) break;
  if (!(await page.evaluate(() => !!document.querySelector('.swarm-shadow')))) break;
  await new Promise((r) => setTimeout(r, 200));
}
const puncak = await page.evaluate(() => (window.__jejakSwarm?.[0]?.length - 1) / 2 || 0);
let lulus = 0; let gagal = 0;
const cek = (n, ok, info = '') => { if (ok) { lulus++; console.log(`  ✅ ${n} ${info}`); } else { gagal++; console.log(`  ❌ ${n} ${info}`); } };

cek('penurunan otomatis menyala saat fps anjlok', !!kinerja?.turun,
  kinerja ? `fps ${kinerja.fps}, batas kursor ${kinerja.batas} (dari ${puncak} kursor awal)` : 'telemetri kosong');
cek('jumlah kursor diturunkan, tapi tidak sampai nol', !!kinerja && kinerja.batas >= 4 && kinerja.batas < puncak,
  kinerja ? `${puncak} → ${kinerja.batas}` : '');

let hilang = false;
for (let i = 0; i < 300; i++) {
  hilang = await page.evaluate(() => !document.querySelector('.swarm-shadow'));
  if (hilang) break;
  await new Promise((r) => setTimeout(r, 250));
}
cek('efek tetap selesai meski kinerja diturunkan', hilang);
console.log(`\nHASIL KINERJA: ${lulus} lulus, ${gagal} gagal`);
await browser.close();
process.exit(gagal ? 1 : 0);
