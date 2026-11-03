# Rencana replika 100% efek Swarm — analisis REA

**Tanggal:** 3 November 2026 · **Target:** `DhvanilPatel/swarm-cursors` v1.1.0
**Status:** menunggu persetujuan Mas. Belum ada kode yang diubah untuk rencana ini.

---

## 1. Metode (REA — Reverse Engineer Anything)

REA bekerja dengan urutan: **tentukan artefak → jalankan → ukur → simpulkan**.
Yang saya lakukan:

| Langkah | Yang dikerjakan | Hasil |
|---|---|---|
| 1. Artefak | Klon repo, baca `swarm.js` (3.826 baris) + `media/demo.gif` (130 frame) | Spesifikasi lengkap terbaca |
| 2. Runtime | **Menjalankan `swarm.js` asli di situs kita** lewat Puppeteer (script ini tidak butuh API Chrome — hanya satu `chrome.runtime.sendMessage` opsional di akhir) | **Berhasil**: 18 → 27 → 8 kursor, HUD, badge `W × H` |
| 3. Ukur | Ekstrak 130 frame demo + 37 frame hasil eksekusi, hitung warna/blob/waktu | Timeline & geometri terukur |
| 4. Simpulkan | Bandingkan dengan implementasi kita sekarang | 14 gap besar (§4) |

Bukti mentah ada di:
- `/home/user/ref-berjalan/r_*.png` — **referensi asli berjalan di situs Mas** (37 frame)
- `/tmp/ref-frames/f_*.png` — 130 frame `demo.gif` bawaan repo
- `/tmp/shot-tool/jalankan-referensi.mjs` — harness untuk menjalankan ulang kapan saja

> **Catatan jujur soal status bukti.** Yang bertanda **[FAKTA]** dibaca langsung dari
> kode/demo. Yang bertanda **[UKUR]** diukur dari frame. Yang bertanda **[KIRA]** adalah
> kesimpulan saya yang belum terbukti — dan akan saya buktikan di fase uji.

---

## 2. Bukti runtime: referensi berjalan di situs kita

```
t=2.3s   18 kursor, HUD muncul, 0 badge      ← intro, halaman mulai dikosongkan
t=16s    halaman tampak utuh kembali (beda antar frame tinggal 0,3)  ← hero selesai
t=29s    27 kursor, 4 badge                  ← masih membangun bagian bawah
t=50s    8 kursor, 0 badge                   ← flocking (tugas habis)
```

Yang paling penting dari sini: **referensi membangun SELURUH halaman, bukan cuma hero**,
dan terus menggulir turun (mode *Tour*) sambil bekerja. Di headless tanpa GPU butuh
~45 detik; di browser sungguhan jauh lebih cepat (demo bawaan repo = 13 detik).

Dari `demo.gif` (130 frame @ 100 ms = **13 detik**):

| Waktu | Yang terjadi | Bukti |
|---|---|---|
| 0,0–0,5 s | Halaman asli tampil, kursor masuk dari kiri/kanan | blob warna 23 → 1 |
| ~0,7 s | Halaman dikosongkan (97 % jadi latar) | % latar 62 → 97 |
| 1,0–3,5 s | Kursor mengorbit, kanvas masih kosong | 5 blob, 97 % latar |
| ~4,0 s | **Penggaris muncul** (pita gelap atas & kiri) | tepi #202020 setebal 11 px pada rekaman 720 px → 20 px asli |
| 4,5–10 s | Halaman dibangun berangsur | blob 18 → 42 |
| 10,5–12,5 s | Kursor menghilang, halaman utuh | blob 42 → 8 |

---

## 3. Spesifikasi referensi (dari source)

### 3.1 Konstanta [FAKTA]

| Konstanta | Nilai |
|---|---|
| `NAMES` | 32 nama (Ada, Linus, Grace, Alan, Margaret, Ken, Barbara, Dennis, Radia, Guido, …) |
| `COLORS` | 12 warna: `#F24E1E #A259FF #1ABCFE #0ACF83 #FF7262 #FFC700 #9747FF #E8467C #14AE5C #0D99FF #FF8A00 #00B5CE` |
| `BLUE` / `RED` | `#0D99FF` / `#F24822` |
| `RULER` | 20 px |
| `MIN_AGENTS` / `MAX_AGENTS` / `FLOCK_AGENTS` / `INTRO_AGENTS` | **8 / 48 / 36 / 18** |
| `MAX_ITEMS` / `MAX_WORLD_H` | 4000 / 40000 px |

### 3.2 Gerakan kursor [FAKTA]

```
speed  : 25 % agen cepat  rand(1000,1500) px/s · sisanya rand(300,750) px/s
force  : rand(3500,6000)  · rand(700,1800)
spin   : rand(2.2,3.4)    · rand(0.8,1.8)
curl   : rand(-1,1)       orbit: rand(70,170)
tempo  : clamp(2.1 + vel/900 + (tugas/agen)*0.5, 2.1, 4.5) × speed
```

Perpindahan (`moveTo`) **tidak lurus**:

```
durasi = clamp(0.12 + √jarak × 0.021, 0.14, 0.90) / speed      // detik
bend   = ±rand(0.04,0.14) × min(jarak, 600)                    // lengkungan
off    = sin(π × e) × bend   → digeser tegak lurus arah gerak
easing = easeInOut(k) kalau sedang drag atau k<0.15, selainnya easeOut(k)
```

Jadi kursor **melengkung** dan melambat di ujung — ini yang bikin gerakannya terasa hidup.

### 3.3 Mengetik [FAKTA]

```
k = clamp(70 / jumlah_karakter, 0.06, 1)
tiap karakter: rand(0.012, 0.04) s
  spasi  + rand(0, 0.03)
  baris  + 0.10
  2,5 %  + rand(0.08, 0.20)   ← ragu sebentar, seperti orang sungguhan
```

### 3.4 Tugas yang dikerjakan [FAKTA]

`rect` · `image` · `text` · `line` · `guide` · `dup` (duplikat ⌥-drag) · `edit` · `restyle` ·
`grow` (judul besar diketik kecil lalu **membesar** ke ukuran aslinya).

Urutan kerja: kursor mengambil tugas **terdekat** yang sudah terbuka dependensinya
(`pick()`), bukan sekadar urut dari atas.

### 3.5 Tampilan [FAKTA]

| Elemen | Spesifikasi |
|---|---|
| Kursor | SVG 24×24; bentuk **arrow / crosshair / I-beam / pen / dup**; `drop-shadow(0 1px 1.5px rgba(0,0,0,.28))` |
| Badge ukuran | `padding:1px 4px; radius:2px; font:600 11px/16px Inter; color:#fff; background:<warna agen>`, **di bawah** kotak (`top: y+h+8`), `translate(-50%)` |
| Seleksi | kotak biru `rgba(13,153,255,.28)` + 8 handle + garis ke penggaris + underline untuk teks |
| Penggaris | `.ruler-top` tinggi 20 px, `.ruler-left` lebar 20 px, `#2c2c2c`, border `#3a3a3a`, sudut 20×20; angka `500 9px Inter #8c8c8c`; angka terpilih `#0d99ff` |
| Placeholder kotak | `--ph: #D9D9D9` (halaman terang) / `#3B3D42` (halaman gelap — **ini kasus kita**) → transisi ke warna asli `.35s` |
| Gambar | placeholder ikon 22 px → media di-**wipe** `clip-path: inset(0 0 100% 0) → inset(0)` selama `.6s cubic-bezier(.2,.75,.2,1)` |
| Caret | lebar 1,5 px, tinggi 1.1em, `animation: blink 1s steps(1) infinite` |
| HUD | pil bawah tengah: `rgba(30,30,30,.94)` + blur 12, radius 12; dots agen (18 px, tumpang tindih −5 px); status teks; bar progres 64×3 `#0D99FF`; tombol **Tour / 1× / suara / Go live / Replay / ✕** |
| Kartu intro | logo 60×60 `grayscale(1) opacity .42` radius 14, fade+scale `.35s/.45s`, di tengah |
| Latar | warna/gambar latar halaman, fade in `.5s` |
| Struktur | `<swarm-rebuild>` fixed `z-index:2147483647` `contain:strict`, shadow root berisi: `bg · layer.under · port>world · layer.over · intro · svg.ov · badges · cursors · rulers · hud` |
| Suara | kelas `Sound`: BPM 104, compressor, **reverb convolved** (impulse generated 3,2 s), piano kaca + klik keyboard per agen |

---

## 4. Gap analysis: punya kita vs referensi

Inilah jawaban untuk "animasinya jelek" — semuanya terukur:

| # | Aspek | Referensi | Punya kita sekarang | Gap |
|---|---|---|---|---|
| 1 | Jumlah kursor | **18** saat intro, naik ke **36**, minimum 8 | **6** (desktop) / **4** (HP) | 🔴 terbesar |
| 2 | Model gerak | steering (kecepatan+force+curl+orbit) + **lengkungan** | tween `easeInOut` lurus | 🔴 terbesar |
| 3 | Cakupan | **seluruh halaman** + gulir otomatis (Tour) | cuma hero (16 kotak) | 🔴 terbesar |
| 4 | Bentuk kursor | arrow, **crosshair, I-beam, pen, dup** | 1 bentuk panah | 🟠 |
| 5 | Kotak | placeholder `#3B3D42` → warna asli (transisi .35 s) | langsung warna asli | 🟠 |
| 6 | Mengetik | per karakter + ragu acak + caret kedip 1 s | per karakter polos | 🟡 |
| 7 | Seleksi | kotak + **8 handle** + garis penggaris + underline | badge saja | 🟠 |
| 8 | Penggaris | 20 px `#2c2c2c` + angka + guide magnet | tidak ada | 🟠 |
| 9 | Gambar | placeholder → **wipe** .6 s | tidak digambar | 🟠 |
| 10 | HUD | dots + status + bar + 6 tombol | tombol "Lewati" | 🟠 |
| 11 | Kartu intro | logo 60 px grayscale fade+scale | tidak ada | 🟡 |
| 12 | Duplikasi/ubah | ⌥-drag duplikat, edit, restyle | tidak ada | 🟡 |
| 13 | Suara | piano + klik + reverb, BPM 104 | 3 bunyi sederhana | 🟡 |
| 14 | Durasi | 13 s (demo) / 45 s di situs kita | 5–6 s | 🟠 |

---

## 5. Yang bisa 100 % dan yang memang beda

**Bisa 100 %** — semua yang berbasis DOM/CSS/JS: gerakan, jumlah agen, bentuk kursor,
placeholder→isi, ketikan, seleksi+handle+badge+penggaris+guide, HUD, kartu intro, wipe gambar.

**Tidak perlu dipakai (dan hasil kita malah lebih baik)** — referensi memotret layar
(`chrome.tabs.captureVisibleTab`) untuk menangkap WebGL/canvas/video/cross-origin. Di situs
Mas semua gambar **satu origin**, jadi bisa diklon langsung dari DOM: lebih tajam, dan tidak
perlu izin ekstensi.

**Tidak mungkin identik, tapi tidak terlihat** — ekstensi membekukan halaman dengan
menyembunyikan `body`. Kita tetap menjalankan React di belakang layar; secara visual sama
karena yang tampil cuma layer swarm.

---

## 6. Rencana fase

Setiap fase = satu PR, bisa dibatalkan sendiri-sendiri.

| Fase | Isi | Keluaran yang diuji |
|---|---|---|
| **3A** | **Engine baru**: steering + tempo + lengkungan + tugas (ganti engine tween kita) | 18 kursor bergerak melengkung, mengambil tugas terdekat; tanpa menggambar apa pun |
| **3B** | **Snapshot seluruh halaman** (ganti `ukurHero`): world layer + layer lengket (navbar/header) + batas 4000 item | Blueprint seluruh halaman terbentuk; item diam (belum dianimasikan) |
| **3C** | **Tampilan Figma**: placeholder→isi, seleksi + 8 handle + underline, badge `W × H`, penggaris 20 px + angka + guide magnet | Kotak & teks tampil persis seperti referensi |
| **3D** | **Kursor lengkap**: arrow/crosshair/I-beam/pen/dup + warna 12 + 32 nama | Bentuk kursor sama persis |
| **3E** | **Gambar & media**: placeholder → wipe .6 s + kartu intro logo | Foto hero & gambar lain ikut dibangun |
| **3F** | **HUD + Tour**: dots agen, status, bar progres, tombol Tour/1×/suara/Go live/Replay/✕; gulir otomatis mengikuti pekerjaan | Seluruh halaman terbangun sambil menggulir |
| **3G** | **Suara piano** (reverb + klik per agen) tetap menuruti aturan PR #7 | Bunyi hanya saat backsound menyala |
| **3H** | **Performa & HP**: agen lebih sedikit, batas item lebih kecil, matikan efek berat di HP | 60 fps di laptop, lancar di HP |
| **3I** | **Pengaturan /admin** diperluas: agen, tempo, tour, cakupan, suara | Semua bisa diubah tanpa deploy |

---

## 7. Cara membuktikan "100 % mirip"

Bukan perasaan — saya akan ukur:

1. **Dual-run**: jalankan `swarm.js` asli di situs (harness sudah ada), tangkap frame tiap
   0,5 s. Jalankan engine kita, tangkap frame pada detik yang sama.
2. **Bandingkan metrik terukur**: jumlah kursor aktif per detik, 12 warna kursor, jumlah
   badge `W × H` per detik, waktu munculnya tiap item (timeline), durasi total, histogram
   warna per frame, tebal & warna penggaris, ukuran/posisi badge.
3. **Uji buta**: saya tampilkan dua set frame ke Mas tanpa bilang mana yang mana, Mas pilih
   mana yang terasa "lebih mirip repo".
4. **Regresi** wajib tetap hijau (section, chip, tumpukan, sertifikat, link, konsol, HP).

Target angka: **≥ 95 % kotak cocok ±3 px** (seperti sekarang) **dan selisih timeline
kemunculan item < 0,5 detik** terhadap referensi.

---

## 8. Risiko yang harus Mas tahu

| Risiko | Penjelasan | Penangkal |
|---|---|---|
| **Lisensi** | Repo referensi **tidak punya lisensi**. Menyalin kodenya mentah-mentah = kode turunan tanpa izin. | **Disarankan:** tulis ulang dari spesifikasi ( perilaku sama, kode sendiri). Kalau Mas mau izin, saya bisa siapkan draf pertanyaannya ke DhvanilPatel. |
| **Durasi** | Membangun seluruh halaman memakan 20–45 detik. Diputar setiap refresh, ini lama. | HUD + tombol Go live/Replay + opsi "cuma hero" supaya cepat; `Tour` bisa dimatikan. |
| **Performa** | 18–36 kursor + ratusan item + 3D & backdrop-filter situs kita, bisa turun fps. | Fase 3H: agen otomatis dikurangi, `contain:strict`, matikan efek berat di HP. |
| **Ukuran berkas** | Engine jadi ~40–60 kB (gzip ~15 kB). | Tetap lazy-chunk terpisah seperti sekarang. |

---

## 9. Keputusan yang saya butuhkan dari Mas

1. **Kode**: tulis ulang dari spesifikasi (aman soal lisensi, perilaku sama) atau salin
   mentah-mentah lalu minta izin?
2. **Cakupan**: seluruh halaman (paling mirip, 20–45 detik) atau hero saja (5–8 detik,
   tetap dengan kursor & detail Figma lengkap)?
3. **Durasi vs kepatuhan**: kalau seluruh halaman terasa lama, apakah efek boleh
   menggulir sendiri (Tour) atau harus tetap di posisi pengunjung?
4. **HP**: agen tetap banyak (paling mirip, risiko panas/ngedrop) atau dikurangi dengan
   efek berat dimatikan?

---

## 10. Keputusan Mas (3 November 2026)

| Pertanyaan | Keputusan |
|---|---|
| Kode | **Tulis ulang dari spesifikasi** — aman soal lisensi, perilaku sama, kode sendiri |
| Cakupan | **Seluruh halaman** — bukan cuma hero |
| Durasi | **Biarkan penuh, tidak dipotong** — tiap bagian dibangun dengan kecepatan wajar |
| HP | **Mulai penuh seperti desktop, lalu adaptif** (diputuskan Mas 2026-11-03: kalau fps < 40 selama 1,2 detik, jumlah kursor otomatis diturunkan; lantai 4 kursor) |

Konsekuensi yang harus dijaga:
- Efek bakal berjalan **puluhan detik** dan membangun seluruh halaman. Karena itu
  **HUD wajib** hadir sejak Fase 3F: pengunjung harus bisa lihat progres dan punya tombol
  **Go live** (langsung ke halaman asli) kapan saja.
- Tombol **Lewati** dan **Esc** tetap harus selalu siap sejak detik pertama (sudah ada).
- Penurunan otomatis (keputusan Mas) **sudah terpasang di Fase 3A**: engine
  mengukur fps tiap frame; bila di bawah 40 fps selama 1,2 detik (diukur setelah
  pembukaan lewat), kursor dikurangi ke setengahnya — lantai 4 kursor. Satu arah
  (tidak dikembalikan) supaya tidak berfluktuasi. Terbukti di
  `tools/uji/uji-kinerja.mjs`: CPU di-throttle 20× → fps 23 → 18 kursor turun
  ke 4, dan efek tetap selesai.

---

## 11. Detail Fase 3A — engine gerak baru (yang pertama dikerjakan)

Fase ini **belum menggambar ulang apa pun**: tujuannya mengganti cara kursor bergerak,
karena gerakan adalah gap terbesar kedua setelah jumlah kursor. Item masih digambar
dengan cara lama; Fase 3B–3D yang mengganti sisanya.

### 11.1 Yang dibangun

1. **Masuk panggung**: 18 kursor (`INTRO_AGENTS`) datang dari luar layar kiri/kanan
   pada posisi vertikal acak (`rand(0.05,0.95) × tinggi`), lalu mengorbit di tengah.
2. **Sifat kursor** (diacak per kursor, persis seperti referensi):
   - 25 % "cepat": `speed rand(1000,1500)`, `force rand(3500,6000)`, `spin rand(2.2,3.4)`
   - 75 % "normal": `speed rand(300,750)`, `force rand(700,1800)`, `spin rand(0.8,1.8)`
   - `curl rand(-1,1)`, `orbit rand(70,170)`
3. **Steering**, bukan tween: posisi digerakkan oleh kecepatan yang dikejar secara
   bertahap menuju target dengan batas `force`, ditambah lengkungan `curl` dan
   gerakan mengitari target (orbit) saat menunggu giliran.
4. **Perpindahan melengkung** (`moveTo`): durasi `clamp(0.12 + √jarak × 0.021, 0.14, 0.9)`,
   lengkungan `±rand(0.04,0.14) × min(jarak,600)` yang digeser tegak lurus arah gerak
   dengan `sin(π × e)`; easing `easeInOut` saat drag, `easeOut` selainnya.
5. **Tempo global**: `clamp(2.1 + kecepatanGulir/900 + (tugas/agen) × 0.5, 2.1, 4.5)`.
6. **Pemilihan tugas terdekat**: kursor mengambil tugas yang terbuka dependensinya dan
   paling dekat dengan posisinya (bukan urut dari atas seperti sekarang).
7. **Nama & warna**: 32 nama (`NAMES`) dan 12 warna (`COLORS`) persis seperti referensi.

### 11.2 Yang belum disentuh di fase ini

Bentuk kursor masih panah; seleksi/handle/penggaris/HUD/intro/wipe gambar menyusul
di Fase 3C–3G.

### 11.3 Kriteria selesai Fase 3A

| Kriteria | Cara ukur |
|---|---|
| 18 kursor tampil saat intro | hitung elemen `.kursor > *` di shadow root |
| Gerakan melengkung, tidak lurus | rekam lintasan kursor: simpangan maksimal dari garis lurus > 3 px |
| Kecepatan antar kursor berbeda | sebaran kecepatan terukur ≥ 2 kelompok (cepat vs normal) |
| Tugas diambil yang terdekat | bandingkan jarak yang diambil vs jarak rata-rata; harus di bawah |
| Efek tidak pernah macet > 15 detik | watchdog tetap aktif |
| Regresi situs tetap hijau | `regresi.mjs` 15/15 |

### 11.4 Hasil verifikasi Fase 3A (terukur, 2026-11-03)

Sumber angka: kait dev `__jejakSwarm` / `__profilSwarm` / `__tugasSwarm` di
`src/swarm/engine.ts` — hanya menyala saat `npm run dev`, terbuang dari build
produksi (sudah dicek: 0 kemunculan di `dist/`).

| Kriteria (11.3) | Hasil |
|---|---|
| 18 kursor tampil saat intro | ✅ 18 kursor |
| Masuk dari luar layar kiri & kanan | ✅ 9 dari kiri, 9 dari kanan, semua lahir di luar viewport |
| Gerakan melengkung | ✅ simpangan dari garis lurus: median 9,8 px, maks 292 px |
| 25% kursor "cepat" | ✅ 4/18 cepat; speed 1029–1497 vs 313–710, force 4330–5948 vs 926–1660 |
| Tugas diambil yang terdekat | ✅ 15/15 di bawah jarak rata-rata (499 px vs 673 px) |
| Kursor berlebih pensiun | ✅ 18 → 15 (menuju 8 bila tugas lebih lama) |
| Efek selesai & menyingkir | ✅ 4,4 detik (hero saja; akan memanjang di Fase 3B) |
| Regresi situs | ✅ 16/16 (`regresi.mjs`) |

Catatan penting:

- **Durasi 4,4 detik baru untuk hero** (15 item). Spesifikasi "durasi penuh
  20–45 detik" baru tercapai di Fase 3B saat seluruh halaman + auto-scroll Tour
  ikut direplikasi. Jangan dipotong, biarkan memanjang.
- **Kursor "cepat" tidak tampak saat terbang masuk** (1300–2077 px/s untuk semua
  kursor) karena yang membatasi adalah gaya radial `clamp((rr-d)×4, -2600, 1400)`
  — sama persis dengan rumus referensi. Bedanya baru terasa saat mengitar
  (spin) dan saat mengetik.

---

## 12. Fase 3B — seluruh halaman + Tour (selesai 2026-11-03)

### 12.1 Yang dikerjakan

| Bagian | Perubahan |
|---|---|
| `snapshot.ts` | Pemindai baru `ukurHalaman()`: menelusuri seluruh DOM (bukan 16 kotak hero yang ditentukan), mengumpulkan `box` / `image` / `text` / `pill` dalam **koordinat dokumen** (`rect + scrollY`), dibatasi 700 item & tinggi dunia 40.000 px. Pemindai hero lama tetap dipakai sebagai cadangan bila hasilnya kosong. |
| `engine.ts` | Layer `dunia` setinggi dokumen digeser berlawanan guliran; orbit, lahir & keluar kursor kini memakai koordinat dokumen. **Tour**: layar mengikuti tugas teratas yang belum dikerjakan, digulir mulus dengan batas 1.600 px/s. Pengawas waktu absolut (dulu 20 detik tetap) diganti pengawas kemajuan (6 detik tanpa ada kursor bekerja) + batas waktu engine 240 detik + jaring absolut yang menyesuaikan jumlah item. |
| `styles.ts` | **Perbaikan besar**: aturan `.kotak.muncul` selama ini TIDAK ADA — kotak yang sudah selesai ditarik tetap `opacity: 0`, jadi halaman tak pernah benar-benar tampak terbangun. Ini biang utama keluhan "animasinya jelek". Kini ada transisi muncul 0,22 s dan sapuan `clip-path` 0,6 s untuk gambar. |
| `swarm.css` | Kunci guliran dibuka (`overflow:hidden` dihapus) — guliran justru diperlukan Tour; pengunjung tetap boleh menggulir manual. |
| `SwarmLayer.tsx` | Memakai `ukurHalaman()`; posisi gulir & `scroll-behavior` dikembalikan seperti sediakala saat efek usai atau dilewati. |

### 12.2 Hasil terukur

- **608 item** terbangun (65 box, 423 teks, 119 pill, 1 gambar) dari dokumen setinggi **11.038 px**.
- Efek berjalan **~39 detik** dan menggulir dari 0 ke **9.954 px** dengan sendirinya — masuk target 20–45 detik yang Mas setujui, tidak dipotong.
- Kursor tetap 15–18 selama pembangunan.

| Pengujian | Hasil |
|---|---|
| `tools/uji/uji-3a.mjs` | **11/11 lulus** |
| `tools/uji/uji-kinerja.mjs` | **4/4 lulus** (fps 21 → 18 kursor menyusut ke 4, pembangunan tetap jalan) |
| `tools/uji/regresi.mjs` | **16/16 lulus** (desktop & HP) |
| `tsc --noEmit` / `npm run build` | bersih / ok |

### 12.3 Catatan & pekerjaan rumah

- Hanya **1 gambar** yang terdeteksi: sebagian besar gambar situs dipasang sebagai `background-image` pada elemen lain atau berukuran < 1.600 px². Perlu penyetelan pemindai (atau menunggu Fase 3D/3G yang memakai sapuan gambar sungguhan).
- Di HP (layar 390 px) halaman lebih tinggi, jumlah item bisa melewati batas 700 → bagian paling bawah belum tergambar. Perlu dipertimbangkan menaikkan batas atau memotong item kecil.
- **HUD belum ada** (Fase 3F): pengunjung baru punya tombol *Lewati* dan Esc. Dengan durasi ~39 detik, progres & tombol *Go live* jadi penting.
