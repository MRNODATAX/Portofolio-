# Rahman Zuhri (`No_Data`) — Personal Digital Archive & Admin Studio

Website portofolio interaktif milik **Rahman Zuhri (`No_Data` / `NODATA • OFFICIAL`)** — Fresh Graduate, Web & App Developer, serta pengembang AI Agent & Bot Otomatisasi berbasis di Jakarta, Indonesia.

Dilengkapi dengan **Halaman Admin Studio (`/admin`)** penuh untuk menambah, mengedit, mengunggah gambar, mengurutkan, hingga menghapus proyek, sertifikat, maupun seluruh isi website secara langsung.

## Fitur Utama & Arsitektur Keamanan

- **Admin Studio (`/admin`) dengan Vault Kriptografi `Ed25519` + `AES-256-GCM` + `scrypt`**:
  - Password admin tidak pernah disimpan dalam bentuk *plaintext* di dalam kode sumber dan token sesi ditandatangani secara asimetris (`Ed25519`) sehingga kebal terhadap pemalsuan token (*token forgery*) pada repositori publik.
  - Dilindungi *rate-limiting* anti-*brute-force*, proteksi *Cross-Site Request* (`Sec-Fetch-Site` & `Origin`), sanitasi *prototype pollution*, sanitasi skema URL (`javascript:`/`data:text/html` diblokir), serta validasi *magic-bytes* biner pada unggahan gambar (menolak `.svg`/poliglot XSS).
- **Kelola Penuh Seluruh Bab**:
  - **Proyek (`01`)**, **Beyond the Code (`02`)**, **Perjalanan (`03`)**, **Stack & Orbit Tools (`04`)**, **Waifu & Personal Universe (`05`)**, **Relay AI (`06`)**, **Sertifikat & Apresiasi (`07`)**, **The Ethos (`08`)**, hingga **Moderasi Komentar Pengunjung (`09`)** & **Kontak Footer**.
- **Editor Kartu Foto Hero (Tab `Hero & Identitas`)**:
  - Tumpukan kaca 3D di Hero sepenuhnya dinamis: admin bisa **menambah**, **mengedit** (judul, caption, foto + titik fokus crop), **mengurutkan** (`Naik` / `Turun`), dan **menghapus** kartu, serta **Reset ke 3 Kartu Bawaan**. Kartu pertama selalu tampil paling depan.
- **Editor Video Banner (Tab `Waifu & Universe`)**:
  - **Ganti video** lewat upload langsung (MP4 / WebM, divalidasi *magic-bytes*-nya) atau tempel URL eksternal (Supabase Storage / Cloudinary / GitHub Raw).
  - **Kontrol orientasi**: dropdown rotasi `0°`, `-90°`, `+90°`, `180°` + tombol **Deteksi Orientasi Otomatis** (membaca `videoWidth`/`videoHeight` lalu menentukan sudut yang tepat) dan **Luruskan (0°)**, serta opsi **Isi penuh (cover)** / **Muat utuh (contain)** dan **Poster/Thumbnail**.
  - Catatan: batas *request body* Vercel adalah ~4.5 MB, jadi upload langsung dibatasi ±4 MB. Untuk video lebih besar, unggah ke Supabase Storage / Cloudinary lalu tempel URL-nya.
- **Fleksibel Tanpa DB atau Dengan Cloud DB (Supabase / Upstash)**:
  - **Tanpa DB (Zero-Config Deploy)**: Langsung tampil 100% di Vercel dari `shared/site-data.json`.
  - **Dengan Supabase (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)**: Menyimpan seluruh editan `/admin`, unggahan gambar ke Supabase Storage (`portfolio-assets`), dan komentar pengunjung secara permanen (lihat `supabase/schema.sql`).
  - **Dengan Upstash Redis (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`)**: Alternatif penyimpanan *serverless* instan.
- **Relay — Personal AI (Bab 06) dengan Dukungan Google Gemini**:
  - **Tanpa API key**: Relay tetap menjawab 100% memakai basis pengetahuan portofolio bawaan (`shared/knowledge.mjs`) — mengerti pertanyaan seputar sertifikat, kontak, perjalanan, karya, cara kerja, tools, dan anime favorit.
  - **Dengan `GEMINI_API_KEY`**: jawaban menjadi jauh lebih natural, kontekstual, dan bisa menangani pertanyaan bebas apa pun, tetap dibatasi oleh *system prompt* portofolio.
- **Gelembung Chat Relay (Floating Bubble)**: widget AI melayang di pojok kanan/kiri bawah (seperti NODATA•AI) — percakapan berbentuk gelembung, ada sapaan awal, chip pertanyaan cepat, indikator "sedang menulis…", badge notifikasi, tombol salin, dan penyimpanan riwayat per-sesi (`sessionStorage`). Bisa dinyalakan/dimatikan, diubah posisi, label, sapaan, dan jeda buka otomatis langsung dari `/admin → Relay AI & Ethos`. Otomatis disembunyikan di halaman `/admin`.

## Integrasi Gemini API Key (Opsional — Tidak Wajib)

**Apakah dibutuhkan?** Tidak. Website, `/admin`, dan Relay **sudah berfungsi penuh tanpa API key apa pun**. Gemini hanya membuat jawaban Relay lebih pintar & natural.

### Cara Tercepat: Tempel Key Langsung di `/admin`

1. Login `/admin` (password `@NODATA105`) → buka tab **Relay AI & Ethos**.
2. Pada kartu **API Key Gemini**, tempel key Anda (format `AIza...`) → klik **Simpan & Enkripsi Key**.
3. Klik **Test Koneksi** untuk memastikan key hidup (akan menampilkan daftar model Gemini yang tersedia).
4. Selesai — tidak perlu menyentuh Vercel maupun file `.env`.

Yang terjadi di balik layar:
- Key langsung **dienkripsi dengan `AES-256-GCM` + `scrypt`** sebelum disimpan.
- Disimpan **terpisah** dari data publik website (`shared/secrets.json` yang masuk `.gitignore`, atau tabel `site_secrets` bila memakai Supabase).
- **Tidak pernah dikembalikan ke browser** — panel hanya menampilkan versi tersensor (`AIza••••••••7f3a`).
- `GET /api/content` (endpoint publik) otomatis menyaring field rahasia.

### Alternatif: Environment Variable (server)

1. Buka **https://aistudio.google.com/apikey** → login akun Google → **Create API key** → salin key-nya (format `AIza...`).
2. **Di Vercel (production)**: **Project → Settings → Environment Variables** → tambah:
   - `GEMINI_API_KEY` = `AIza...` *(wajib)*
   - `GEMINI_MODEL` = `gemini-2.5-flash` *(opsional; alternatif: `gemini-2.5-pro`)*
   Lalu **Deployments → Redeploy** agar variabel terbaca.
3. **Di lokal**: salin `.env.example` menjadi `.env`, isi dua variabel di atas, lalu `npm run dev` (`vite.config.ts` sudah otomatis memuat env ber-prefix `GEMINI_`).
4. Cek statusnya: buka `/api/health` → akan mengembalikan `"aiProvider": "gemini"` (atau `"local"` bila belum dipasang). Badge engine juga tampil di header panel Relay.

**Urutan prioritas engine Relay:** Environment Variable `GEMINI_API_KEY` (di Vercel/`.env`) → API key terenkripsi dari `/admin` → `CHAT_API_KEY`/`CHAT_API_URL` (OpenAI-compatible: OpenAI, Groq, OpenRouter, Ollama) → webhook `CHAT_API_URL` → **basis pengetahuan lokal** (selalu ada sebagai jaring pengaman bila API gagal/timeout).

**Catatan keamanan & biaya:**
- Key **hanya dipakai di server** (`api/chat.js`), dikirim lewat header `x-goog-api-key` (bukan URL), dan **tidak pernah** ikut ter-bundel ke JS browser. Jangan tambahkan prefix `VITE_` pada variabel `GEMINI_*`.
- Kunci tetap mengikuti *rate limit* bawaan (`/api/chat` maks. 12 pesan/menit/IP) sehingga key aman dari penyalahgunaan publik.
- `gemini-2.5-flash` memiliki *free tier* yang cukup untuk traffic portofolio pribadi. Pantau pemakaian di Google AI Studio. Bila kuota habis/invalid, Relay otomatis kembali ke mode pengetahuan lokal (website tidak pernah error).

## Menjalankan Secara Lokal

```bash
npm install
npm run dev
```

Build produksi & pemeriksaan tipe TypeScript:

```bash
npm run build
```

## Deploy ke Vercel

1. Hubungkan repositori GitHub **`MRNODATAX/Portofolio-`** di **Vercel Dashboard → Add New Project**.
2. Klik **Deploy** (`vercel.json` sudah mengatur Vite, SPA rewrite `/admin`, Serverless Functions `/api/*`, dan HTTP Security Headers seperti CSP & HSTS secara otomatis).
3. *(Opsional)* Jika ingin editan via `/admin` di Vercel tersimpan permanen di Cloud, jalankan isi file `supabase/schema.sql` di Supabase SQL Editor lalu tambahkan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` pada **Vercel → Settings → Environment Variables**.

## Kontak Resmi

- **WhatsApp**: [0881-0805-93445](https://wa.me/62881080593445)
- **Instagram**: [@nodatanotdev](https://www.instagram.com/nodatanotdev)
- **GitHub**: [@MRNODATAX](https://github.com/MRNODATAX)
