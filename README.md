# Rahman Zuhri (`No_Data`) — Personal Digital Archive & Admin Studio

Website portofolio interaktif milik **Rahman Zuhri (`No_Data` / `NODATA • OFFICIAL`)** — Fresh Graduate, Web & App Developer, serta pengembang AI Agent & Bot Otomatisasi berbasis di Jakarta, Indonesia.

Dilengkapi dengan **Halaman Admin Studio (`/admin`)** penuh untuk menambah, mengedit, mengunggah gambar, mengurutkan, hingga menghapus proyek, sertifikat, maupun seluruh isi website secara langsung.

## Fitur Utama & Arsitektur Keamanan

- **Admin Studio (`/admin`) dengan Vault Kriptografi `Ed25519` + `AES-256-GCM` + `scrypt`**:
  - Password admin tidak pernah disimpan dalam bentuk *plaintext* di dalam kode sumber dan token sesi ditandatangani secara asimetris (`Ed25519`) sehingga kebal terhadap pemalsuan token (*token forgery*) pada repositori publik.
  - Dilindungi *rate-limiting* anti-*brute-force*, proteksi *Cross-Site Request* (`Sec-Fetch-Site` & `Origin`), sanitasi *prototype pollution*, sanitasi skema URL (`javascript:`/`data:text/html` diblokir), serta validasi *magic-bytes* biner pada unggahan gambar (menolak `.svg`/poliglot XSS).
- **Kelola Penuh Seluruh Bab**:
  - **Proyek (`01`)**, **Beyond the Code (`02`)**, **Perjalanan (`03`)**, **Stack & Orbit Tools (`04`)**, **Waifu & Personal Universe (`05`)**, **Relay AI (`06`)**, **Sertifikat & Apresiasi (`07`)**, **The Ethos (`08`)**, hingga **Moderasi Komentar Pengunjung (`09`)** & **Kontak Footer**.
- **Fleksibel Tanpa DB atau Dengan Cloud DB (Supabase / Upstash)**:
  - **Tanpa DB (Zero-Config Deploy)**: Langsung tampil 100% di Vercel dari `shared/site-data.json`.
  - **Dengan Supabase (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)**: Menyimpan seluruh editan `/admin`, unggahan gambar ke Supabase Storage (`portfolio-assets`), dan komentar pengunjung secara permanen (lihat `supabase/schema.sql`).
  - **Dengan Upstash Redis (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`)**: Alternatif penyimpanan *serverless* instan.

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
