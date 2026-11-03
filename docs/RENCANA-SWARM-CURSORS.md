# Rencana Implementasi: Efek "Swarm Cursors" di Website Portofolio

**Status:** RENCANA — belum dieksekusi, menunggu persetujuan Mas Rahman.
**Sumber referensi:** https://github.com/DhvanilPatel/swarm-cursors (v1.1.0)
**Tanggal:** 2 November 2026

---

## 1. Apa sebenarnya repo `swarm-cursors` itu?

Hal terpenting lebih dulu: **ini BUKAN library live-cursor multiplayer.**

| Fakta | Keterangan |
|---|---|
| Nama asli | **Swarm Rebuild** — ekstensi Chrome Manifest V3 |
| Kursor "multiplayer" | **Simulasi**, bukan pengunjung sungguhan. Tidak ada kode jaringan sama sekali (0 `fetch`, 0 `WebSocket`; hanya `chrome.runtime.sendMessage` untuk minta screenshot) |
| Cara kerja | Snapshot DOM → kosongkan halaman → gerombolan kursor membangun ulang halaman: kotak (crosshair drag), teks diketik huruf demi huruf, garis pen-tool, penggaris gaya Figma, duplikat ⌥-drag |
| Fisika gerombolan | Orbit, alignment, flocking menghindari mouse |
| Suara | Disintesis langsung dengan Web Audio API (tanpa berkas audio) |
| Ukuran kode | `swarm.js` **3.826 baris** (nol dependensi) + `background.js` 83 baris |
| Bagian terberat | `captureModel()` ≈ 900 baris — mengubah DOM hidup menjadi "blueprint" |
| Batas | ±4.000 layer / 40.000px, canvas/video/iframe jadi placeholder, Web Components jadi elemen biasa, animasi halaman berhenti |
| **Lisensi** | **TIDAK ADA.** README menyatakan ini adaptasi karya [Joel Califa](https://joelcalifa.com) (`swarm-site`) yang juga tanpa lisensi, dan **meminta izin sebelum memakai ulang kodenya** |

> ⚠️ **Konsekuensi penting:** karena ekstensi ini hanya butuh izin `activeTab` + `scripting`, **ia sudah bisa dipakai di situs Mas sekarang juga, tanpa mengubah satu baris pun kode situs.** Cukup pasang ekstensinya lalu tekan `Alt+Shift+S`.

---

## 2. Apakah bisa diterapkan langsung ke website?

**Bisa, tapi dengan tiga realita yang harus disepakati dulu:**

1. **Lisensi (paling menentukan).** Menyalin `swarm.js` ke dalam situs = memakai ulang kode tanpa lisensi + turunan karya orang lain. Dua jalan keluar: minta izin tertulis, **atau** tulis engine sendiri yang hanya "terinspirasi" (alur & estetika boleh sama, kodenya baru).
2. **Ketergantungan API ekstensi.** Media (WebGL canvas, video menyala, iframe lintas-domain) difoto lewat `chrome.tabs.captureVisibleTab`. Di website biasa API itu tidak ada; canvas/video lintas-origin akan *tainted* → harus jadi placeholder atau butuh CORS.
3. **Situs Mas itu "berat".** Hero 3D (`preserve-3d`, `translateZ`), intro sequence, `backdrop-filter`, sticky + scroll-driven. Ini persis wilayah *edge case* buat DOM walker-nya.

---

## 3. Pilihan arah (A–D)

| Opsi | Isi | Kelebihan | Kekurangan |
|---|---|---|---|
| **A. Port penuh** | Pindahkan `swarm.js` (3,8k baris) ke situs | Paling mirip aslinya, seluruh halaman bisa "dibangun" | Risiko lisensi tinggi, +≈120 KB bundle, rawan bentrok dengan React/3D hero, usaha terbesar |
| **B. Nol kode** | Biarkan sebagai ekstensi; tambahkan catatan kecil di situs | Nol risiko, nol usaha | Hampir tidak ada pengunjung yang melihatnya |
| **C. Engine sendiri, scope Hero** ✅ **rekomendasi** | Tulis engine baru ±400–700 baris yang **hanya membangun ulang Hero** (di atas lipatan) dengan 5–8 kursor. Blueprint **ditulis tangan** dari struktur hero yang sudah kita tahu (tidak perlu DOM walker) | Nol masalah lisensi, ringan, cepat, tetap "wow", mudah dimatikan | Tidak membangun seluruh halaman |
| **D. Live cursor beneran** | Pengunjung sungguhan saling lihat kursor (Supabase Realtime) | Fitur sosial yang unik | **Bukan** isi repo ini; butuh anon key di browser, RLS, kuota realtime |

**Rekomendasi saya: Opsi C**, lalu bertahap naik (C+ = satu section penuh, C++ = seluruh halaman + panel kontrol seperti aslinya).

---

## 4. Rencana terstruktur (7 fase)

### Fase 0 — Keputusan & fondasi
- [ ] Putuskan lisensi: **tulis sendiri** (rekomendasi) atau minta izin dulu ke Dhvanil Patel + Joel Califa.
- [ ] Sepakati scope: `hero` → `section` → `page` (bertahap, jangan langsung `page`).
- [ ] Tentukan tolok ukur: waktu tayang intro tidak boleh bertambah >1,2 detik; Lighthouse tidak turun >5 poin.

### Fase 1 — Spike teknis (bukti konsep, cabang sendiri)
- [ ] Flag `?swarm=1` + `localStorage` supaya mudah diuji tanpa mengganggu pengunjung.
- [ ] Buktikan 3 hal paling berisiko:
  1. Layer full-viewport di **shadow root** benar-benar terisolasi dari `glass.css` (tidak ada CSS bocor dua arah).
  2. Kursor SVG 60 fps saat hero 3D sedang jalan.
  3. "Fail-open": bila ada error/timeout 3 detik → langsung tampilkan halaman normal.

### Fase 2 — Engine inti (`src/swarm/`)
- [ ] `blueprint.hero.ts` — blueprint tulisan tangan: judul, deskripsi, 2 tombol, badge lokasi, chip *Currently Exploring*, bingkai 3 kartu foto.
- [ ] `agents.ts` — 5–8 agen kursor: nama acak (tanpa identitas asli) + warna dari palet, gerakan easing, antrean tugas.
- [ ] `tasks.ts` — generator tugas: `rect` (crosshair + badge `W × H`), `text` (karet I-beam + ketik per huruf), `line` (pen tool), `image` (sapu atas→bawah).
- [ ] `engine.ts` — orkestrator `requestAnimationFrame`, buka tugas bertahap, `AbortController` untuk berhenti kapan saja.

### Fase 3 — Integrasi ke situs
- [ ] `SwarmLayer.tsx` — mount di dalam `App.tsx` via `lazy()` (tidak menambah bundle awal).
- [ ] Serah-terima dari `SplashScreen.tsx`: hanya jalan **setelah** intro selesai/dilewati.
- [ ] `useSwarmIntro.ts` — kumpulan *guard* (lihat §5).
- [ ] Kursor palsu `pointer-events: none`; layer bisa di-skip dengan tombol **Lewati** dan `Esc`.

### Fase 4 — Suara
- [ ] `audio.ts` — klik keyboard mekanik + nada piano kaca (E mayor pentatonik), disintesis (tanpa berkas audio).
- [ ] **Ikuti aturan PR #7:** tidak pernah bunyi sendiri saat halaman dibuka; wajib ada interaksi dulu; **saling eksklusif dengan backsound** lewat `src/lib/audioBus.ts` (`MUSIC_START` / `VIDEO_AUDIO_ON`).

### Fase 5 — Kontrol & admin
- [ ] Kontrak data baru di `src/types.ts` + `shared/site-data.json`:
      ```json
      "swarm": {
        "enabled": true,
        "autoOnce": true,
        "scope": "hero",
        "speed": 1,
        "agents": 8,
        "sound": false
      }
      ```
- [ ] Tab/kartu di `/admin`: hidup-mati, kecepatan 1×/2×/3×, jumlah kursor, suara, dan **Tombol Putar Ulang** untuk pratinjau.
- [ ] Tombol kecil "Putar ulang pembangunan" di situs (mis. di footer) — versi manual untuk pengunjung yang penasaran.

### Fase 6 — Performa, aksesibilitas, keamanan
- [ ] Bundle terpisah + `prefetch` hanya saat idle (`requestIdleCallback`).
- [ ] `prefers-reduced-motion` → **lewat**.
- [ ] Layar sentuh / lebar <900px → lewat (kursor tidak relevan + hemat baterai).
- [ ] `navigator.connection.saveData` atau `effectiveType` 2g → lewat.
- [ ] Baterai <20% (`navigator.getBattery`) → lewat.
- [ ] Tidak ada PII: nama acak dari daftar, tidak ada pelacakan, tidak ada penyimpanan.

### Fase 7 — Uji & rilis
- [ ] Unit: blueprint, antrean tugas, guard.
- [ ] Puppeteer: 6 lebar × 2 mode gerak; pastikan tidak ada tabrakan dengan chip *Currently Exploring*, bubble Relay AI, navbar, dan tidak ada error konsol.
- [ ] Uji "fail-open": matikan paksa di tengah → halaman normal tampil utuh.
- [ ] Rilis bertahap: `?swarm=1` → 10% → 100% (cukup lewat flag di `/admin`).

---

## 5. Peta berkas (konkret)

**Berkas baru**

| Berkas | Isi |
|---|---|
| `src/swarm/types.ts` | Tipe blueprint, agen, tugas |
| `src/swarm/blueprint.hero.ts` | Blueprint hero tulisan tangan |
| `src/swarm/agents.ts` | Agen kursor (nama, warna, easing) |
| `src/swarm/tasks.ts` | Generator: rect / text / line / image |
| `src/swarm/engine.ts` | Orkestrator RAF + antrean + abort |
| `src/swarm/audio.ts` | Sintesis Web Audio (opsional) |
| `src/swarm/SwarmLayer.tsx` | Komponen React + shadow root |
| `src/hooks/useSwarmIntro.ts` | Semua guard (motion, mobile, koneksi, admin) |

**Berkas yang diubah**

| Berkas | Perubahan |
|---|---|
| `src/App.tsx` | `lazy(() => import('./swarm/SwarmLayer'))` |
| `src/components/SplashScreen.tsx` | Titik serah-terima setelah intro selesai |
| `src/types.ts` | Tambah blok `swarm` |
| `shared/site-data.json` | Nilai bawaan `swarm` |
| `src/admin/AdminStudio.tsx` | Kartu pengaturan Swarm |
| `src/glass.css` | Gaya layer (kursor, badge, tanpa bentrok `z-index`) |
| `src/lib/audioBus.ts` | Event baru: `SWARM_AUDIO_START/STOP` |

---

## 6. Risiko & mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Lisensi kode sumber | Hukum/etika | Tulis sendiri (Opsi C) atau minta izin tertulis dulu |
| Bentrok dengan hero 3D | Visual rusak | Swarm hanya menggambar **di atas** layer sendiri; hero tetap utuh di belakang; urutan rilis diukur per fase |
| Membengkakkan bundle | LCP turun | `lazy()` + `requestIdleCallback`, target <15 KB gzip |
| React me-render ulang saat efek jalan | Desinkron | Efek hanya menyentuh DOM-nya sendiri di shadow root; situs "dibekukan" selama tayang |
| Audio bentrok dengan backsound | Pengalaman buruk | Ikuti `audioBus` (saling eksklusif, manual start) |
| Kursor mengganggu navigasi | Frustrasi | `Esc` / tombol Lewati setiap saat; `autoOnce` (sekali per pengunjung) |
| Gagal di HP/lambat | Halusinasi tampilan | Guard ketat di Fase 6 + fail-open |

---

## 7. Perkiraan usaha

| Fase | Perkiraan | Catatan |
|---|---|---|
| 0–1 (spike) | 1 sesi | Bukti konsep di cabang terpisah |
| 2 (engine hero) | 2–3 sesi | Bagian terbesar |
| 3–4 (integrasi + suara) | 1–2 sesi | |
| 5–6 (admin + guard) | 1–2 sesi | |
| 7 (uji + rilis) | 1 sesi | |
| **Total (Opsi C)** | **±6–9 sesi** | |
| Ekstra C+ (satu section) | +2–3 sesi | |
| Ekstra C++ (seluruh halaman) | +4–6 sesi | Perlu DOM walker sendiri |

---

## 8. Perbandingan A–D: efek, plus, minus, dan kemiripan

### Pertanyaan Mas: *"apakah bisa 100% mirip seperti repo?"*
**Jujur: tidak ada opsi yang 100%** kecuali **Opsi B** (memang memakai ekstensi aslinya). Alasannya teknis:

| Hal di repo asli | Kenapa sulit/disama-betulkan di website |
|---|---|
| Memotret media lewat `chrome.tabs.captureVisibleTab` | API ekstensi. Di website, canvas/video/iframe lintas-origin **terlarang** dibaca (tainted canvas) → harus jadi placeholder |
| Bisa membangun ulang **halaman apa saja** | Butuh DOM walker generik ±900 baris. Untuk situs kita bisa ditulis tangan (lebih mudah, tapi tidak generik) |
| Halaman "dibekukan" total saat dibangun | React tetap hidup → harus ada mode freeze eksplisit |
| Scroll mengejar gerombolan | Bisa, tapi bentrok dengan scroll-driven section yang sudah ada |

---

### Opsi A — Port penuh `swarm.js` ke situs
**Efek:** seluruh halaman dikosongkan, lalu dibangun ulang oleh puluhan kursor saat Mas menggulir — persis seperti demo repo.
- **Kemiripan:** konsep 90–95%, **realita di situs Mas 50–70%** pada percobaan pertama (naik ke 75–85% setelah tuning, karena hero 3D, `backdrop-filter`, sticky & font kustom).
- **Plus:** paling mirip & paling "wow"; semua fitur ikut (Tour, 1×/2×/3×, Go live, Replay, penggaris, duplikat).
- **Minus:** lisensi harus beres dulu; +≈120 KB (≈35–40 KB gzip) bundle; 3.826 baris kode asing yang harus dipahami & dirawat; rawan bentrok dengan React/3D hero; DOM walker generik paling sering meleset di halaman berat.
- **Usaha:** ±12–18 sesi. **Risiko: tinggi.**

### Opsi B — Nol kode, arahkan pengunjung ke ekstensi
**Efek:** tidak ada yang berubah di situs; hanya ditambahkan catatan/tautan kecil bahwa situs ini seru dicoba dengan ekstensi Swarm Rebuild.
- **Kemiripan:** **100%** (itu memang aplikasi aslinya) — tapi hanya untuk pengunjung yang mau memasang ekstensi (perkiraan <1%).
- **Plus:** nol risiko lisensi, nol usaha, nol dampak performa.
- **Minus:** hampir tidak ada yang melihatnya; tidak bisa mengatur kapan & bagaimana efek tampil.
- **Usaha:** <1 sesi. **Risiko: nol.**

### Opsi C — Engine sendiri, scope Hero dulu ✅ rekomendasi
**Efek:** setelah intro selesai, halaman tetap utuh, lalu **hero dibangun ulang** di atasnya oleh 5–8 kursor: judul diketik, tombol digambar crosshair, bingkai foto disapu, badge & chip bermunculan — lengkap dengan fisika gerombolan.
- **Kemiripan:** **gerakan & rasa 80–90%** untuk hero (karena elemen hero sedikit & kita atur sendiri), tapi **cakupan hanya hero** — tidak membangun seluruh halaman dan tidak ada scroll-chase.
- **Plus:** nol masalah lisensi (kode baru); ringan (<15 KB gzip, lazy-load); cepat rilis; mudah dimatikan; blueprint bisa disetel sampai presisi karena hero-nya kita yang punya.
- **Minus:** tidak se-"epik" versi seluruh halaman; butuh Fase lanjutan (C+ satu section, C++ seluruh halaman + panel kontrol) kalau Mas mau lebih.
- **Usaha:** ±6–9 sesi. **Risiko: rendah.**

### Opsi D — Live cursor pengunjung sungguhan (Supabase Realtime)
**Efek:** pengunjung yang sedang online saling melihat kursor & nama samaran bergerak di layar (seperti Figma/Google Docs).
- **Kemiripan:** **0%** — ini fitur yang sama sekali **berbeda** dari isi repo (repo-nya tidak punya kode jaringan sama sekali).
- **Plus:** interaktif & sosial; cocok untuk portofolio; infrastruktur Supabase sudah ada.
- **Minus:** butuh **anon/publishable key** di browser (aturan RLS wajib), kuota realtime, isu privasi & moderasi nama, tidak berguna di HP (tidak ada kursor).
- **Usaha:** ±4–6 sesi. **Risiko: menengah** (kuota & privasi).

---

### Ringkasan cepat

| Opsi | Kemiripan | Usaha | Risiko | Skala "wow" |
|---|---|---|---|---|
| A — Port penuh | 50–85% (konsep 90–95%) | 12–18 sesi | Tinggi | ★★★★★ |
| B — Ekstensi saja | 100% (hanya yang pasang) | <1 sesi | Nol | ★☆☆☆☆ |
| **C — Engine sendiri (Hero)** | **80–90% di hero** | **6–9 sesi** | **Rendah** | **★★★★☆** |
| D — Live cursor nyata | 0% (fitur beda) | 4–6 sesi | Menengah | ★★★☆☆ |

> **Saran saya tetap Opsi C:** dapat 80–90% "rasa"-nya dengan risiko terendah. Kalau setelah C lulus Mas masih mau versi seluruh halaman, jalurnya jelas: C+ → C++ (dan saat itu kita bisa pertimbangkan minta izin lisensi untuk meminjam idenya secara resmi).

---

## 9. Pertanyaan Mas: kalau pakai Opsi B, apakah pengunjung harus pasang ekstensi manual?

**Jawab: iya, 100% manual — dan website tidak pernah bisa memasang ekstensi secara otomatis.**

| Fakta | Keterangan |
|---|---|
| **Inline installation dihapus Google** | Dulu (Chrome 15, 2011) website bisa memasang ekstensi dengan satu klik lewat `chrome.webstore.install()`. Google **menghentikannya bertahap sepanjang 2018 dan menghapus API-nya sepenuhnya di Chrome 71** (Desember 2018) karena banyak disalahgunakan untuk menyebar ekstensi nakal. Sekarang satu-satunya yang bisa dilakukan website adalah **mengarahkan** pengunjung ke halaman Chrome Web Store |
| **Repo ini belum ada di Chrome Web Store** | README-nya sendiri bilang: *"It isn't on the Chrome Web Store yet, so load it unpacked"* → pengunjung harus mengunduh repo, membuka `chrome://extensions`, menyalakan **Developer mode**, lalu **Load unpacked**. Itu alur developer, bukan alur pengunjung |
| **HP tidak bisa** | Chrome/Android **tidak mendukung ekstensi** → pengunjung mobile dapat nol |
| **Firefox & Safari** | Butuh porting terpisah (Firefox AMO, Safari App Store) |
| **Perkiraan yang benar-benar memasang** | Untuk ekstensi yang wajib di-load unpacked: **mendekati 0%**. Kalau kelak sudah rilis resmi di Web Store pun, umumnya **<1–2%** pengunjung |

Jadi kalau tujuan Mas adalah **"pengunjung langsung melihat efeknya tanpa menginstal apa pun"**, maka **Opsi B tidak memenuhi tujuan itu** — justru itulah alasan Opsi A/C ada: menjalankan efeknya **langsung di dalam halaman**, tanpa ekstensi, tanpa instalasi.

### Nilai B yang tetap ada (sebagai bonus, bukan jalur utama)
- Cocok untuk **Mas sendiri**: merekam layar saat seluruh halaman dibangun ulang, lalu videonya dipajang di portofolio / README / postingan.
- Bisa ditaruh sebagai **catatan kecil** di footer atau halaman "Tentang": *"Punya ekstensi Swarm Rebuild? Tekan Alt+Shift+S di halaman ini."* — menyenangkan untuk segelintir pengunjung teknis, tanpa biaya apa pun.

---

## 10. Rekomendasi akhir saya

**C sebagai jalur utama + B sebagai bonus.**

1. ** Utama — Opsi C (engine sendiri, Hero dulu):** semua pengunjung langsung melihat efek kursor membangun ulang hero **tanpa menginstal apa-apa**, di desktop maupun HP versi ringan. Risiko lisensi nol, ringan, bisa dimatikan kapan saja.
2. **Bonus — Opsi B:** tambahkan satu baris catatan di footer untuk pemilik ekstensi (dan pakai sendiri untuk merekam demo). Biaya ≈ 15 menit, manfaat kecil tapi nyata.
3. **Nanti, kalau C sudah lulus:** naik bertahap C+ (satu section) → C++ (seluruh halaman + panel kontrol). Di titik itu baru worth-it mengurus izin lisensi kalau Mas mau mendekati versi aslinya.

**Alasan menolak A untuk sekarang:** kemiripan riil di situs Mas hanya 50–70% pada percobaan pertama, sementara biayanya paling besar (lisensi + 12–18 sesi + risiko bentrok dengan hero 3D & React).

**Alasan menolak D untuk sekarang:** itu fitur berbeda (kursor pengunjung sungguhan), bukan isi repo yang Mas tunjukkan; bisa dibahas terpisah nanti.

---

## 11. Keputusan yang sudah & masih dibutuhkan

**Sudah diputuskan**
- **Perangkat:** Desktop + **mobile versi ringan** (kursor lebih sedikit, durasi lebih pendek di HP).

**Ditunda sampai Mas memilih arah**
- Kapan efek tayang (intro sekali / tombol manual / keduanya).
- Suara (aturan PR #7 / tanpa suara / otomatis).

**Masih dibutuhkan**
- Pilihan arah: **A / B / C / D**.

Setelah Mas pilih, saya lanjut sesuai pola yang disepakati: **plan disetujui dulu, baru eksekusi** (tiap fase jadi PR terpisah supaya mudah dibatalkan).

---

## 12. Hasil Fase 1 (spike) — 3 November 2026

Spike **Opsi C** sudah jadi dan bisa dicoba. Semua kode **tidak menyentuh situs asli**:
situs hanya diukur, lalu kerangkanya digambar ulang di dalam **shadow root** terpisah.

### Cara mencoba

| Cara | Alamat |
|---|---|
| Live preview (dev) | `https://{port}-{sandbox}.e2b.app/?swarm=1` (atau `http://localhost:5173/?swarm=1`) |
| Nyalakan permanen di browser sendiri | buka konsol, lalu: `localStorage.setItem('nodata:swarm','1')` |

Tanpa flag itu, **pengunjung biasa tidak melihat apa-apa** dan tidak memuat satu byte pun
kode efek (lazy chunk terpisah).

### Yang terjadi

1. Menunggu intro selesai → menunggu data `/api/content` + font → menunggu animasi masuk hero berhenti.
2. Mengukur 14 selector hero (judul, deskripsi, tombol, chip `CURRENTLY EXPLORING`, tumpukan 3 foto, dan lain-lain)
   → **16 kotak blueprint** di desktop, **10** di mobile 390px.
3. **6 kursor** (desktop) / **4 kursor** (mobile) mengorbit, lalu terbang bergantian:
   menggambar kotak (lencana `W × H` di ujung crosshair), mengisinya, mengetik teksnya.
4. Selesai → layer memudar (0,42s) dan halaman asli tampil utuh.

**Durasi:** sekitar **5–6 detik** dari layer muncul sampai hilang.
Bisa dibatalkan kapan saja dengan tombol **Lewati** atau tombol **Esc**.

### Hasil uji otomatis

| Uji | Hasil |
|---|---|
| `uji-swarm.mjs` (layer, kursor, kunci guliran, Esc, mobile, tanpa flag) | **19/19 lulus** |
| `uji-fidelitas.mjs` (rect blueprint vs elemen asli, toleransi ±3px) | **16/16 cocok** |
| `regresi.mjs` (urutan section, chip, tumpukan, sertifikat, link, tanpa error konsol) | **17/17 lulus** |
| `tsc --noEmit` | bersih |
| `npm run build` | OK — chunk `SwarmLayer` **11,5 kB** (gzip **4,7 kB**), terpisah dari bundle utama |

### Dua jebakan yang ketemu (dan sudah dibereskan)

1. **Teks yang masih versi bawaan.** `/api/content` datang belakangan, jadi chip bisa tergambar
   dengan teks/ukuran yang belum final.
2. **3D diratakan saat opacity < 1.** Selama `.portrait-assembly` masih memudar, Chrome meratakan
   `preserve-3d`-nya sehingga `translateZ(58px)` chip belum mengembang → meleset ~10px.
   Ini yang paling licik karena transformnya terbaca identik; yang berubah justru hasil proyeksinya.

Penangkalnya: **ukur ulang sampai posisi stabil** (`ukurHeroStabil()`) setelah data, font, dan
animasi masuk dinyatakan selesai (`heroTenang()` memakai `document.getAnimations()`).

### File baru

| File | Isi |
|---|---|
| `src/swarm/types.ts` | tipe item/agen + 8 nama & warna agen |
| `src/swarm/snapshot.ts` | `ukurHero()`, `ukurHeroStabil()`, `warnaLatar()` |
| `src/swarm/engine.ts` | `mulaiSwarm()` — fase orbit → terbang → gambar → isi → ketik → selesai |
| `src/swarm/styles.ts` | CSS scoped di shadow root (termasuk penjagaan reduced-motion) |
| `src/swarm/swarm.css` | host z-index 90, tombol Lewati, kunci guliran |
| `src/swarm/SwarmLayer.tsx` | pembungkus React: shadow root, aman StrictMode, fail-open |
| `src/hooks/useSwarmIntro.ts` | gating flag, reduced-motion, save-Data, 1× per sesi |

**Bonus Opsi B** ikut masuk: satu baris catatan di footer untuk pemilik ekstensi Swarm Rebuild
(`Alt+Shift+S`), lengkap dengan gaya `.footer-swarm-note`.

### Yang belum (Fase 2 dan seterusnya)

- Kapan efek tayang + aturan suara — **masih ditunda sesuai permintaan Mas**.
- Pengaturan di `/admin` (kolom `swarm` di `shared/site-data.json`: `enabled, autoOnce, scope, speed, agents, sound`).
- Memperluas cakupan dari hero ke section lain.
- Demo video (pengganti yang tak sempat pasang ekstensi).
