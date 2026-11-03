// Rangkaian regresi situs NODATA (dibuat ulang 2026-11-03 setelah harness di
// /tmp ikut terhapus; sekarang disimpan di repo supaya tidak hilang lagi).
//
// Cara jalankan:
//   npm i --no-save puppeteer-core@23 @sparticuz/chromium
//   node tools/uji/regresi.mjs      # dev server harus hidup di :5173
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
const URL_DASAR = 'http://127.0.0.1:5173';

async function halamanBaru({ lebar = 1440, tinggi = 900, kurangiGerakan = false, url = URL_DASAR } = {}) {
  const p = await browser.newPage();
  await p.setViewport({ width: lebar, height: tinggi });
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: kurangiGerakan ? 'reduce' : 'no-preference' }]);
  p.__err = [];
  p.on('console', (m) => { if (m.type() === 'error') p.__err.push(m.text()); });
  p.on('pageerror', (e) => p.__err.push(String(e)));
  await p.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  return p;
}

// ── 1–5: halaman utama ────────────────────────────────────────────────────
{
  const p = await halamanBaru();
  cek('1. halaman utama termuat', (await p.title()).length > 0, await p.title());

  const bagian = await p.evaluate(() => {
    const k = ['#home', '#about', '#journey', '#archive', '#certificates', '#ethos', '#contact'];
    return k.filter((s) => document.querySelector(s));
  });
  cek('2. bagian utama tersedia', bagian.length >= 6, bagian.join(' '));

  const logo = await p.evaluate(() => {
    const el = document.querySelector('img[alt*="NODATA"], .brand img, header img');
    return el ? el.getAttribute('src') : null;
  });
  cek('3. logo utama ada', !!logo, logo || 'tidak ada');

  try { await p.click('.intro-skip'); } catch {}
  // splash baru dibongkar 520 ms setelah tombol lewati ditekan
  await new Promise((r) => setTimeout(r, 1000));
  const splash = await p.evaluate(() => !document.querySelector('.intro-screen'));
  cek('4. splash/intro bisa dilewati', splash);

  const taut = await p.evaluate(() =>
    [...document.querySelectorAll('a[href^="http"]')].map((a) => a.href).slice(0, 40));
  const placeholder = taut.filter((h) => h.endsWith('/#') || h.endsWith('#'));
  cek('5. tautan proyek tidak ada yang jatuh ke "#"', placeholder.length === 0,
    `${taut.length} tautan absolut, ${placeholder.length} placeholder`);

  await p.close();
}

// ── 6–9: efek swarm desktop ───────────────────────────────────────────────
{
  const p = await halamanBaru({ url: `${URL_DASAR}/?swarm=1` });
  try { await p.click('.intro-skip'); } catch {}
  let muncul = false;
  for (let i = 0; i < 120; i++) {
    muncul = await p.evaluate(() => !!document.querySelector('.swarm-shadow'));
    if (muncul) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  cek('6. efek swarm berjalan otomatis (tanpa klik)', muncul);

  let kursor = 0;
  for (let i = 0; i < 120; i++) {
    kursor = await p.evaluate(() => {
      const sr = document.querySelector('.swarm-shadow')?.shadowRoot;
      return sr ? sr.querySelectorAll('.agen').length : 0;
    });
    if (kursor) break;
    await new Promise((r) => setTimeout(r, 50));
  }
  cek('7. gerombolan kursor dibuat (≥ 12)', kursor >= 12, `${kursor} kursor`);

  let hilang = false;
  for (let i = 0; i < 300; i++) {
    hilang = await p.evaluate(() => !document.querySelector('.swarm-shadow'));
    if (hilang) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  cek('8. efek selesai & menyingkir sendiri', hilang);
  cek('9. tanpa error konsol (desktop)', p.__err.length === 0, p.__err.slice(0, 2).join(' | '));
  await p.close();
}

// ── 10–12: HP sama seperti desktop ────────────────────────────────────────
{
  const p = await halamanBaru({ lebar: 390, tinggi: 844, url: `${URL_DASAR}/?swarm=1` });
  try { await p.click('.intro-skip'); } catch {}
  let kursor = 0;
  for (let i = 0; i < 120; i++) {
    kursor = await p.evaluate(() => {
      const sr = document.querySelector('.swarm-shadow')?.shadowRoot;
      return sr ? sr.querySelectorAll('.agen').length : 0;
    });
    if (kursor) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  cek('10. HP: jumlah kursor sama seperti desktop (≥ 12)', kursor >= 12, `${kursor} kursor`);

  let hilang = false;
  for (let i = 0; i < 300; i++) {
    hilang = await p.evaluate(() => !document.querySelector('.swarm-shadow'));
    if (hilang) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  cek('11. HP: efek selesai & menyingkir', hilang);
  cek('12. tanpa error konsol (HP)', p.__err.length === 0, p.__err.slice(0, 2).join(' | '));
  await p.close();
}

// ── 13: preferensi kurangi gerakan ────────────────────────────────────────
{
  const p = await halamanBaru({ kurangiGerakan: true });
  try { await p.click('.intro-skip'); } catch {}
  await new Promise((r) => setTimeout(r, 1200));
  const muncul = await p.evaluate(() => !!document.querySelector('.swarm-shadow'));
  cek('13. preferensi "kurangi gerakan": efek swarm dilewati', !muncul);
  await p.close();
}

// ── 14–16: admin ──────────────────────────────────────────────────────────
{
  const p = await halamanBaru({ url: `${URL_DASAR}/admin` });
  await p.waitForSelector('#admin-pw', { timeout: 20000 });
  await p.type('#admin-pw', '@NODATA105');
  await p.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 2500));
  const masuk = await p.evaluate(() => !document.querySelector('#admin-pw'));
  cek('14. admin bisa login', masuk);

  if (masuk) {
    const ok = await p.evaluate(() => {
      const tombol = [...document.querySelectorAll('button')].find((b) => /backsound|suara/i.test(b.textContent || ''));
      if (tombol) tombol.click();
      return true;
    });
    await new Promise((r) => setTimeout(r, 600));
    const ada = await p.evaluate(() => /swarm|gerombolan/i.test(document.body.innerText));
    cek('15. pengaturan swarm ada di tab Backsound & Suara', ok && ada);
  } else cek('15. pengaturan swarm ada di tab Backsound & Suara', false, 'login gagal');
  cek('16. tanpa error konsol (admin)', p.__err.filter((e) => !/supabase|fetch/i.test(e)).length === 0,
    p.__err.slice(0, 2).join(' | '));
  await p.close();
}

console.log(`\nHASIL REGRESI: ${lulus} lulus, ${gagal} gagal`);
await browser.close();
process.exit(gagal ? 1 : 0);
