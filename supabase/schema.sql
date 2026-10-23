-- ============================================================================
-- Schema Opsional Supabase untuk Portofolio Rahman Zuhri (No_Data)
-- Jalankan 1x di Supabase Dashboard -> SQL Editor jika ingin menyimpan editan
-- /admin & komentar pengunjung secara permanen di cloud Supabase.
-- ============================================================================

-- 1. Tabel CMS Utama (menyimpan proyek, sertifikat, bio, waifu, dll.)
create table if not exists public.site_cms (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2. Tabel Rating & Kesan Pengunjung (Bab 09)
create table if not exists public.visitor_reviews (
  id uuid primary key,
  name text not null check (char_length(name) between 1 and 50),
  stars smallint not null check (stars between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 600),
  voter_hash text not null,
  created_at timestamptz not null default now()
);

-- 3. Brankas Rahasia Integrasi (API key Gemini yang diisi dari /admin)
-- Isinya SELALU terenkripsi (AES-256-GCM + scrypt) oleh server sebelum disimpan,
-- dan tidak pernah dikembalikan ke browser — UI hanya menerima versi tersensor.
create table if not exists public.site_secrets (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_visitor_reviews_created_at
  on public.visitor_reviews (created_at desc);

create index if not exists idx_visitor_reviews_voter_hash
  on public.visitor_reviews (voter_hash, created_at desc);

-- 3. Aktifkan Row Level Security (RLS) penuh:
-- Hanya backend serverless (/api/*) dengan SUPABASE_SERVICE_ROLE_KEY yang berhak
-- menulis data, sehingga tabel 100% aman dari manipulasi langsung dari browser.
alter table public.site_cms enable row level security;
alter table public.visitor_reviews enable row level security;
alter table public.site_secrets enable row level security;

-- 4. Bucket Storage publik untuk upload gambar proyek / sertifikat / waifu
insert into storage.buckets (id, name, public)
values ('portfolio-assets', 'portfolio-assets', true)
on conflict (id) do update set public = true;
