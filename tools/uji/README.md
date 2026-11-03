# Pengujian otomatis

Rangkaian uji berbasis Puppeteer untuk situs NODATA. Disimpan di repo supaya
tidak hilang seperti versi lama yang ada di `/tmp`.

## Persiapan

```bash
# dev server harus hidup di port 5173
npm run dev -- --host 0.0.0.0 --port 5173

# dependensi pengujian (tidak disimpan ke package.json)
npm i --no-save puppeteer-core@23 @sparticuz/chromium
```

## Menjalankan

```bash
node tools/uji/regresi.mjs       # 16 pemeriksaan regresi situs
node tools/uji/uji-3a.mjs        # 11 pemeriksaan model gerak swarm (Fase 3A)
node tools/uji/uji-kinerja.mjs   # 3 pemeriksaan penjaga kinerja adaptif
```

Keluar dengan kode 1 bila ada yang gagal, jadi bisa dipakai di CI.

## Catatan

- `uji-3a.mjs` membaca kait dev `__jejakSwarm`, `__profilSwarm`, `__tugasSwarm`
  dan `__kinerjaSwarm` dari `src/swarm/engine.ts`. Kait ini hanya menyala saat
  `npm run dev` (`import.meta.env.DEV`) dan terbuang dari build produksi.
- Pengukuran memakai waktu internal engine, bukan waktu nyata: di headless
  (tanpa GPU) frame bisa melambat, jadi kecepatan px/detik tidak bisa dipakai.
  Metrik yang dipakai karena itu berbasis piksel & jumlah frame.
- `uji-kinerja.mjs` men-throttle CPU 20× lewat CDP supaya fps benar-benar
  anjlok dan penurunan otomatis jumlah kursor bisa diamati.
