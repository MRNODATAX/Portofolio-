import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Award,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  FolderKanban,
  Heart,
  KeyRound,
  Layers,
  Zap,
  LoaderCircle,
  Lock,
  LogOut,
  MessageSquare,
  Plus,
  RotateCcw,
  Save,
  Share2,
  Sparkles,
  Sun,
  Moon,
  Trash2,
  Upload,
  User,
  Waypoints,
} from 'lucide-react';
import './admin.css';
import { INITIAL_SITE_DATA, useSiteData } from '../context/SiteDataContext';
import { statusLabels } from '../data';
import { useTheme } from '../hooks/useTheme';
import type {
  AnimeCharacter,
  CertificateItem,
  HeroStackCard,
  JourneyStep,
  Project,
  SiteData,
  WorkStatus,
} from '../types';
import { WorkCover } from '../components/Archive';
import { Mark } from '../components/Primitives';
import ImageField from './ImageField';
import VideoField from './VideoField';

type AdminTab = 'identity' | 'projects' | 'about' | 'journey' | 'ecosystem' | 'personal' | 'certificates' | 'relay' | 'footer';

interface AdminReview {
  id: string;
  name: string;
  stars: number;
  comment: string;
  createdAt: string;
}

function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || `project-${Date.now()}`
  );
}

export default function AdminStudio({ onExit }: { onExit: () => void }) {
  const { siteData, setSiteData, storageMode: ctxStorage } = useSiteData();
  const { theme, toggle: toggleTheme } = useTheme();

  const [token, setToken] = useState<string>(() => {
    try {
      return sessionStorage.getItem('nodata-admin-token') || '';
    } catch {
      return '';
    }
  });
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [storageMode, setStorageMode] = useState(ctxStorage || 'filesystem');

  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [draft, setDraft] = useState<SiteData>(() => structuredClone(siteData));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; isError?: boolean } | null>(null);

  const [tab, setTab] = useState<AdminTab>('projects');
  const [selectedProjectIdx, setSelectedProjectIdx] = useState(0);
  const [projectSearch, setProjectSearch] = useState('');
  const [tagDraft, setTagDraft] = useState('');

  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [ratingStats, setRatingStats] = useState({ count: 0, average: 0 });
  const [aiProvider, setAiProvider] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [secret, setSecret] = useState<{ configured: boolean; source: string; masked: string; updatedAt: string } | null>(null);
  const [keyDraft, setKeyDraft] = useState('');
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [keyBusy, setKeyBusy] = useState<'save' | 'test' | 'delete' | ''>('');
  const [keyMsg, setKeyMsg] = useState('');
  const [keyErr, setKeyErr] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dirty) {
      setDraft(structuredClone(siteData));
    }
  }, [siteData]);

  useEffect(() => {
    let active = true;
    async function verify() {
      try {
        const res = await fetch('/api/admin', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store',
        });
        const body = await res.json().catch(() => ({}));
        if (!active) return;
        if (body.storageMode) setStorageMode(body.storageMode);
        if (token && body.authenticated) {
          setAuthenticated(true);
        } else {
          setAuthenticated(false);
        }
      } catch {
        if (active) setAuthenticated(false);
      } finally {
        if (active) setAuthChecked(true);
      }
    }
    void verify();
    return () => {
      active = false;
    };
  }, [token]);

  async function loadReviews() {
    try {
      const res = await fetch('/api/ratings', { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(body.reviews)) {
        setReviews(body.reviews);
        setRatingStats({ count: body.count || 0, average: body.average || 0 });
      }
    } catch {
      // Ignore
    }
  }

  useEffect(() => {
    if (authenticated && tab === 'footer') {
      void loadReviews();
    }
  }, [authenticated, tab]);

  // Menampilkan engine AI yang sedang aktif pada tab Relay (Gemini / LLM lain / pengetahuan lokal).
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    fetch('/api/health', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!active || !body) return;
        setAiProvider(typeof body.aiProvider === 'string' ? body.aiProvider : '');
        setAiModel(typeof body.aiModel === 'string' ? body.aiModel : '');
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [authenticated]);

  /* ── Brankas API key Gemini (dienkripsi, tidak pernah dikembalikan utuh) ── */
  async function loadSecret() {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'get-secret', name: 'geminiApiKey' }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body?.secret) {
        setSecret({
          configured: Boolean(body.secret.configured),
          source: String(body.secret.source || 'none'),
          masked: String(body.secret.masked || ''),
          updatedAt: String(body.secret.updatedAt || ''),
        });
      }
    } catch {
      // Diamkan — status akan tetap kosong bila gagal dimuat.
    }
  }

  useEffect(() => {
    if (authenticated) void loadSecret();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  async function secretRequest(action: 'put-secret' | 'delete-secret' | 'test-secret', value?: string) {
    setKeyBusy(action === 'put-secret' ? 'save' : action === 'delete-secret' ? 'delete' : 'test');
    setKeyErr('');
    setKeyMsg('');
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, name: 'geminiApiKey', ...(value !== undefined ? { value } : {}) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Permintaan gagal diproses.');
      if (action === 'test-secret') {
        const models = Array.isArray(body.models) ? body.models.slice(0, 6).join(', ') : '';
        setKeyMsg(`✅ Terhubung ke Gemini${models ? ` · model tersedia: ${models}` : ''}${body.source === 'env' ? ' (memakai Environment Variable)' : ''}`);
      } else if (action === 'delete-secret') {
        setKeyMsg('API key dihapus. Relay kembali ke mode pengetahuan lokal.');
        setKeyDraft('');
      } else {
        setKeyMsg(`API key tersimpan & terenkripsi (${body.persistedTo || 'tersimpan'}). Relay siap memakai Gemini.`);
        setKeyDraft('');
      }
      await loadSecret();
      setToast({ text: action === 'test-secret' ? 'Tes koneksi selesai.' : 'Pengaturan AI diperbarui.' });
    } catch (error) {
      setKeyErr(error instanceof Error ? error.message : 'Terjadi kesalahan.');
    } finally {
      setKeyBusy('');
    }
  }

  function updateDraft(updater: (prev: SiteData) => SiteData) {
    setDraft((prev) => {
      const next = updater(structuredClone(prev));
      return next;
    });
    setDirty(true);
  }

  /* ── CRUD kartu foto stack 3D di Hero ───────────────────────────────────── */
  const heroCards: HeroStackCard[] = Array.isArray(draft.identity.heroCards) ? draft.identity.heroCards : [];

  function defaultHeroCards(): HeroStackCard[] {
    return [
      {
        id: 'portrait',
        title: draft.identity.name || 'No_Data',
        caption: draft.identity.heroStack?.portraitCaption || 'Fresh Graduate · Web & App Dev',
        image: draft.identity.portraitImage || '/images/nodata-portrait.jpg',
        focal: draft.identity.portraitFocal || 'center 42%',
      },
      {
        id: 'work',
        title: draft.identity.heroStack?.workTitle || 'Selected Works',
        caption: 'Research. Build. Automate.',
        image: draft.identity.heroStack?.workImage || '/components/works/repo-flow.svg',
        focal: 'center',
      },
      {
        id: 'personal',
        title: draft.personal.anime[0]?.name || 'Alya Kujou',
        caption: draft.identity.heroStack?.personalCaption || 'A little more me.',
        image: draft.personal.anime[0]?.image || '/images/anime-v22/alya.jpg',
        focal: draft.personal.anime[0]?.focal || '50% 18%',
      },
    ];
  }

  function addHeroCard() {
    updateDraft((d) => {
      const cards = Array.isArray(d.identity.heroCards) ? [...d.identity.heroCards] : [];
      cards.push({
        id: `hero-card-${Date.now().toString(36)}`,
        title: 'Kartu Baru',
        caption: 'Caption kartu baru',
        image: '/images/nodata-portrait.jpg',
        focal: '50% 30%',
      });
      d.identity.heroCards = cards;
      return d;
    });
  }

  function updateHeroCard(id: string, patch: Partial<HeroStackCard>) {
    updateDraft((d) => {
      const cards = Array.isArray(d.identity.heroCards) ? [...d.identity.heroCards] : [];
      const idx = cards.findIndex((c) => c.id === id);
      if (idx === -1) return d;
      cards[idx] = { ...cards[idx], ...patch };
      d.identity.heroCards = cards;
      return d;
    });
  }

  function removeHeroCard(id: string) {
    updateDraft((d) => {
      const cards = Array.isArray(d.identity.heroCards) ? [...d.identity.heroCards] : [];
      if (cards.length <= 1) return d;
      d.identity.heroCards = cards.filter((c) => c.id !== id);
      return d;
    });
  }

  function moveHeroCard(id: string, direction: -1 | 1) {
    updateDraft((d) => {
      const cards = Array.isArray(d.identity.heroCards) ? [...d.identity.heroCards] : [];
      const idx = cards.findIndex((c) => c.id === id);
      const target = idx + direction;
      if (idx === -1 || target < 0 || target >= cards.length) return d;
      [cards[idx], cards[target]] = [cards[target], cards[idx]];
      d.identity.heroCards = cards;
      return d;
    });
  }

  function resetHeroCards() {
    updateDraft((d) => {
      d.identity.heroCards = defaultHeroCards();
      return d;
    });
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (!password.trim() || loginBusy) return;
    setLoginBusy(true);
    setLoginError('');
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.token) {
        throw new Error(body.error || 'Login gagal.');
      }
      try {
        sessionStorage.setItem('nodata-admin-token', body.token);
      } catch {}
      setToken(body.token);
      setAuthenticated(true);
      setPassword('');
      if (body.storageMode) setStorageMode(body.storageMode);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Gagal masuk ke panel admin.');
    } finally {
      setLoginBusy(false);
    }
  }

  function handleLogout() {
    try {
      sessionStorage.removeItem('nodata-admin-token');
    } catch {}
    setToken('');
    setAuthenticated(false);
  }

  async function saveAll(dataToSave: SiteData = draft) {
    if (saving) return;
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'save', data: dataToSave }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) {
        handleLogout();
        throw new Error('Sesi berakhir, silakan login ulang.');
      }
      if (!res.ok || !body.ok) {
        throw new Error(body.error || 'Gagal menyimpan perubahan.');
      }
      setSiteData(body.data as SiteData);
      setDraft(structuredClone(body.data as SiteData));
      setDirty(false);
      if (body.persistedTo) setStorageMode(body.persistedTo);
      setToast({
        text: `Perubahan berhasil disimpan (${
          body.persistedTo === 'filesystem'
            ? 'Tersimpan ke file JSON lokal'
            : body.persistedTo === 'upstash'
            ? 'Tersimpan ke Upstash Redis Cloud'
            : 'Tersimpan di memori aktif'
        }).`,
      });
    } catch (err) {
      setToast({ text: err instanceof Error ? err.message : 'Gagal menyimpan.', isError: true });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!authenticated) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveAll();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authenticated, draft, saving, token]);

  function exportJson() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nodata-site-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed?.identity || !Array.isArray(parsed?.archive?.projects)) {
          throw new Error('Format JSON backup tidak sesuai.');
        }
        setDraft(parsed as SiteData);
        setDirty(true);
        setToast({ text: 'File JSON berhasil dimuat ke editor. Klik "Simpan Perubahan" untuk menerapkan.' });
      } catch (err) {
        setToast({ text: err instanceof Error ? err.message : 'File JSON tidak valid.', isError: true });
      }
    };
    reader.readAsText(file);
  }

  async function deleteReview(id: string) {
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'delete-review', id }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        setReviews(body.reviews || []);
        setRatingStats({ count: body.count || 0, average: body.average || 0 });
        setToast({ text: 'Komentar pengunjung berhasil dihapus.' });
      }
    } catch {
      setToast({ text: 'Gagal menghapus komentar.', isError: true });
    }
  }

  const existingCategories = useMemo(
    () => Array.from(new Set(['AI Tools', 'Automation', 'Utilities', 'Productivity', 'Archive Experiments', ...draft.archive.projects.map((p) => p.category)])).filter(Boolean),
    [draft.archive.projects]
  );

  const filteredProjects = useMemo(() => {
    return draft.archive.projects
      .map((p, idx) => ({ project: p, idx }))
      .filter(({ project }) => `${project.name} ${project.category} ${project.ecosystem.join(' ')}`.toLowerCase().includes(projectSearch.toLowerCase()));
  }, [draft.archive.projects, projectSearch]);

  const activeProject = draft.archive.projects[selectedProjectIdx] || draft.archive.projects[0];

  function addNewProject() {
    const newProj: Project = {
      id: `proyek-baru-${Date.now().toString().slice(-4)}`,
      name: 'Proyek Baru',
      category: 'AI Tools',
      url: 'https://github.com/MRNODATAX',
      image: '/components/works/repo-flow.svg',
      imageFit: 'contain',
      imageFocal: '50% 50%',
      summary: 'Ringkasan singkat proyek yang tampil pada kartu rak 3D.',
      description: 'Penjelasan lengkap mengenai tujuan, fitur utama, dan arsitektur proyek ini.',
      problem: 'Latar belakang masalah yang ingin diselesaikan melalui proyek ini.',
      exploration: 'Pendekatan teknis, arsitektur sistem, atau eksperimen yang diterapkan.',
      outcome: 'Hasil akhir serta status pengembangan proyek saat ini.',
      ecosystem: ['React', 'TypeScript', 'AI'],
      status: 'LIVE_VERIFIED',
      type: 'work',
      visualType: 'illustrative',
    };
    updateDraft((d) => {
      d.archive.projects.unshift(newProj);
      return d;
    });
    setSelectedProjectIdx(0);
    setToast({ text: 'Proyek baru ditambahkan di urutan teratas. Silakan lengkapi detailnya lalu klik Simpan.' });
  }

  function duplicateProject(idx: number) {
    const src = draft.archive.projects[idx];
    if (!src) return;
    const copy: Project = {
      ...structuredClone(src),
      id: `${src.id}-copy-${Date.now().toString().slice(-3)}`,
      name: `${src.name} (Salinan)`,
    };
    updateDraft((d) => {
      d.archive.projects.splice(idx + 1, 0, copy);
      return d;
    });
    setSelectedProjectIdx(idx + 1);
  }

  function moveProject(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= draft.archive.projects.length) return;
    updateDraft((d) => {
      const [item] = d.archive.projects.splice(idx, 1);
      d.archive.projects.splice(target, 0, item);
      return d;
    });
    setSelectedProjectIdx(target);
  }

  function deleteProject(idx: number) {
    const target = draft.archive.projects[idx];
    if (!target) return;
    if (!window.confirm(`Hapus proyek "${target.name}" dari arsip?`)) return;
    updateDraft((d) => {
      d.archive.projects.splice(idx, 1);
      return d;
    });
    setSelectedProjectIdx((prev) => Math.max(0, Math.min(prev, draft.archive.projects.length - 2)));
  }

  function updateActiveProject(patch: Partial<Project>) {
    updateDraft((d) => {
      const target = d.archive.projects[selectedProjectIdx];
      if (target) Object.assign(target, patch);
      return d;
    });
  }

  if (!authChecked) {
    return (
      <div className="admin-login-wrap">
        <LoaderCircle size={28} className="spin" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="admin-shell">
        <div className="admin-login-wrap">
          <div className="admin-login-card">
            <div className="admin-login-brand">
              <Mark />
              <div>
                <strong>{siteData.identity.name} · Admin Studio</strong>
                <span>Content Management System</span>
              </div>
            </div>
            <h1>Masuk ke Ruang Admin</h1>
            <p>Kelola seluruh isi website portofolio, tambah/edit/hapus proyek, unggah gambar, kelola sertifikat, ubah daftar Waifu, dan moderasi kesan pengunjung.</p>

            <form onSubmit={handleLogin}>
              <div className="admin-field">
                <label htmlFor="admin-pw">Password Admin</label>
                <input
                  id="admin-pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password admin…"
                  autoFocus
                  required
                />
              </div>
              {loginError && <p style={{ color: '#f28b82', fontSize: 12, margin: '0 0 12px' }}>{loginError}</p>}
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 1 }} disabled={loginBusy}>
                  {loginBusy ? <LoaderCircle size={15} className="spin" /> : <Lock size={15} />}
                  {loginBusy ? 'Memverifikasi…' : 'Masuk Studio'}
                </button>
                <button type="button" className="admin-btn" onClick={onExit}>
                  Kembali ke Web
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <Mark />
          <div className="admin-topbar-title">
            <strong>{draft.identity.name} — Admin Studio</strong>
            <small>
              <span className={`admin-badge ${dirty ? 'dirty' : 'saved'}`}>
                {dirty ? '● Belum disimpan' : '✓ Tersinkronisasi'}
              </span>
              <span>
                Storage:{' '}
                {storageMode === 'supabase'
                  ? 'Supabase Cloud DB + Storage'
                  : storageMode === 'upstash'
                  ? 'Upstash Redis Cloud'
                  : storageMode === 'filesystem'
                  ? 'Local JSON + Uploads'
                  : 'Static Seed / Memory'}
              </span>
            </small>
          </div>
        </div>

        <div className="admin-topbar-actions">
          <button type="button" className="admin-btn" onClick={toggleTheme} title="Ganti Tema Gelap/Terang">
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          <input
            ref={importRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) importJson(f);
            }}
          />
          <button type="button" className="admin-btn" onClick={exportJson} title="Download Backup JSON">
            <Download size={14} />
            Export JSON
          </button>
          <button type="button" className="admin-btn" onClick={() => importRef.current?.click()} title="Muat dari Backup JSON">
            <Upload size={14} />
            Import
          </button>
          <button
            type="button"
            className="admin-btn"
            onClick={() => {
              if (window.confirm('Kembalikan seluruh isi editor ke data awal bawaan?')) {
                setDraft(structuredClone(INITIAL_SITE_DATA));
                setDirty(true);
              }
            }}
            title="Reset ke Data Default"
          >
            <RotateCcw size={14} />
            Reset
          </button>

          <button type="button" className="admin-btn admin-btn-primary" disabled={saving} onClick={() => void saveAll()}>
            {saving ? <LoaderCircle size={15} className="spin" /> : <Save size={15} />}
            {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
          </button>

          <button type="button" className="admin-btn" onClick={onExit}>
            Lihat Website
            <ArrowUpRight size={14} />
          </button>
          <button type="button" className="admin-icon-btn" onClick={handleLogout} title="Keluar dari Admin">
            <LogOut size={15} />
          </button>
        </div>
      </header>

      <div className="admin-body">
        <aside className="admin-sidebar" aria-label="Menu bagian CMS">
          <button className={`admin-nav-btn ${tab === 'projects' ? 'active' : ''}`} onClick={() => setTab('projects')}>
            <FolderKanban size={16} />
            Proyek &amp; Karya
            <small>{draft.archive.projects.length}</small>
          </button>
          <button className={`admin-nav-btn ${tab === 'identity' ? 'active' : ''}`} onClick={() => setTab('identity')}>
            <User size={16} />
            Hero &amp; Identitas
            <small>00</small>
          </button>
          <button className={`admin-nav-btn ${tab === 'about' ? 'active' : ''}`} onClick={() => setTab('about')}>
            <Sparkles size={16} />
            Beyond the Code
            <small>02</small>
          </button>
          <button className={`admin-nav-btn ${tab === 'journey' ? 'active' : ''}`} onClick={() => setTab('journey')}>
            <Waypoints size={16} />
            Bab Perjalanan
            <small>{draft.journey.steps.length}</small>
          </button>
          <button className={`admin-nav-btn ${tab === 'ecosystem' ? 'active' : ''}`} onClick={() => setTab('ecosystem')}>
            <Layers size={16} />
            Stack &amp; Tools
            <small>{draft.ecosystem.groups.reduce((n, g) => n + g.items.length, 0)}</small>
          </button>
          <button className={`admin-nav-btn ${tab === 'personal' ? 'active' : ''}`} onClick={() => setTab('personal')}>
            <Heart size={16} />
            Waifu &amp; Universe
            <small>{draft.personal.anime.length}</small>
          </button>
          <button className={`admin-nav-btn ${tab === 'certificates' ? 'active' : ''}`} onClick={() => setTab('certificates')}>
            <Award size={16} />
            Sertifikat
            <small>{draft.certificates?.items?.length || 0}</small>
          </button>
          <button className={`admin-nav-btn ${tab === 'relay' ? 'active' : ''}`} onClick={() => setTab('relay')}>
            <MessageSquare size={16} />
            Relay AI &amp; Ethos
            <small>06 &amp; 08</small>
          </button>
          <button className={`admin-nav-btn ${tab === 'footer' ? 'active' : ''}`} onClick={() => setTab('footer')}>
            <Share2 size={16} />
            Kontak &amp; Rating
            <small>{draft.footer.socials.length}</small>
          </button>
        </aside>

        <main className="admin-main">
          {toast && (
            <div className={`admin-toast ${toast.isError ? 'error' : ''}`} role="status">
              <span>{toast.text}</span>
              <button type="button" className="admin-btn admin-btn-sm" onClick={() => setToast(null)}>
                Tutup
              </button>
            </div>
          )}

          {/* TAB 1: PROJECTS CRUD */}
          {tab === 'projects' && (
            <>
              <div className="admin-section-head">
                <div>
                  <h2>Kelola Proyek &amp; Karya (01 — Digital Archive)</h2>
                  <p>Tambah proyek baru, unggah gambar cover/screenshot, pilih ilustrasi SVG, ubah urutan tampil, atau hapus proyek.</p>
                </div>
                <button type="button" className="admin-btn admin-btn-primary" onClick={addNewProject}>
                  <Plus size={15} />
                  Tambah Proyek Baru
                </button>
              </div>

              <div className="admin-card">
                <h3>Pengantar Seksi Arsip</h3>
                <div className="admin-grid-3">
                  <div className="admin-field">
                    <label>Judul Bab</label>
                    <input
                      value={draft.archive.chapterTitle}
                      onChange={(e) => updateDraft((d) => ({ ...d, archive: { ...d.archive, chapterTitle: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Heading Baris 1</label>
                    <input
                      value={draft.archive.headingLine1}
                      onChange={(e) => updateDraft((d) => ({ ...d, archive: { ...d.archive, headingLine1: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Heading Italic</label>
                    <input
                      value={draft.archive.headingItalic}
                      onChange={(e) => updateDraft((d) => ({ ...d, archive: { ...d.archive, headingItalic: e.target.value } }))}
                    />
                  </div>
                </div>
                <div className="admin-field" style={{ marginTop: 10 }}>
                  <label>Deskripsi Pengantar Arsip</label>
                  <textarea
                    rows={2}
                    value={draft.archive.intro}
                    onChange={(e) => updateDraft((d) => ({ ...d, archive: { ...d.archive, intro: e.target.value } }))}
                  />
                </div>
              </div>

              <div className="admin-split">
                <div className="admin-list-panel">
                  <div className="admin-list-search">
                    <input
                      type="search"
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      placeholder="Cari proyek di daftar…"
                    />
                  </div>
                  {filteredProjects.map(({ project, idx }) => (
                    <div
                      key={project.id}
                      className={`admin-list-item ${selectedProjectIdx === idx ? 'selected' : ''}`}
                      onClick={() => setSelectedProjectIdx(idx)}
                    >
                      <div className="admin-list-thumb">
                        <img src={project.image || `/components/works/${project.id}.svg`} alt="" onError={(e) => ((e.currentTarget.style.display = 'none'))} />
                      </div>
                      <div className="admin-list-meta">
                        <strong>
                          {String(idx + 1).padStart(2, '0')}. {project.name}
                        </strong>
                        <small>{project.category}</small>
                      </div>
                      <div className="admin-list-controls" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="admin-icon-btn" disabled={idx === 0} onClick={() => moveProject(idx, -1)} title="Geser Naik">
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          className="admin-icon-btn"
                          disabled={idx === draft.archive.projects.length - 1}
                          onClick={() => moveProject(idx, 1)}
                          title="Geser Turun"
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {activeProject ? (
                  <div>
                    <div className="admin-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0 }}>
                          Edit Proyek #{selectedProjectIdx + 1}: {activeProject.name}
                        </h3>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" className="admin-btn admin-btn-sm" onClick={() => duplicateProject(selectedProjectIdx)}>
                            <Copy size={13} />
                            Duplikat
                          </button>
                          <button
                            type="button"
                            className="admin-btn admin-btn-sm admin-btn-danger"
                            onClick={() => deleteProject(selectedProjectIdx)}
                          >
                            <Trash2 size={13} />
                            Hapus Proyek
                          </button>
                        </div>
                      </div>

                      <div className="admin-grid-2">
                        <div className="admin-field">
                          <label>Nama Proyek</label>
                          <input
                            value={activeProject.name}
                            onChange={(e) => {
                              const nextName = e.target.value;
                              const patch: Partial<Project> = { name: nextName };
                              if (activeProject.id.startsWith('proyek-baru-')) {
                                patch.id = slugify(nextName);
                              }
                              updateActiveProject(patch);
                            }}
                          />
                        </div>
                        <div className="admin-field">
                          <label>ID / Slug Unik</label>
                          <input value={activeProject.id} onChange={(e) => updateActiveProject({ id: slugify(e.target.value) })} />
                        </div>
                      </div>

                      <div className="admin-grid-3">
                        <div className="admin-field">
                          <label>Kategori (Pilih atau Ketik Baru)</label>
                          <input
                            list="project-category-options"
                            value={activeProject.category}
                            onChange={(e) => updateActiveProject({ category: e.target.value })}
                            placeholder="Misal: AI Tools / Automation"
                          />
                          <datalist id="project-category-options">
                            {existingCategories.map((cat) => (
                              <option key={cat} value={cat} />
                            ))}
                          </datalist>
                        </div>
                        <div className="admin-field">
                          <label>Status Proyek</label>
                          <select
                            value={activeProject.status}
                            onChange={(e) => updateActiveProject({ status: e.target.value as WorkStatus })}
                          >
                            {Object.entries(statusLabels).map(([key, label]) => (
                              <option key={key} value={key}>
                                {label} ({key})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="admin-field">
                          <label>Mode Tampilan Gambar</label>
                          <select
                            value={activeProject.imageFit || 'cover'}
                            onChange={(e) =>
                              updateActiveProject({
                                imageFit: e.target.value as 'cover' | 'contain',
                                visualType: e.target.value === 'cover' ? 'real' : 'illustrative',
                              })
                            }
                          >
                            <option value="cover">Penuh Kartu (Cover Foto/Screenshot)</option>
                            <option value="contain">Utuh Presisi (Ilustrasi / Diagram SVG)</option>
                          </select>
                        </div>
                      </div>

                      <div className="admin-field">
                        <label>URL Demo / Repositori GitHub (Kosongkan jika tidak ada tombol link)</label>
                        <input
                          type="url"
                          value={activeProject.url}
                          onChange={(e) => updateActiveProject({ url: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>

                      <ImageField
                        label="Gambar Cover Proyek (Upload Foto/Screenshot, URL, atau Pilih SVG Bawaan)"
                        value={activeProject.image || `/components/works/${activeProject.id}.svg`}
                        onChange={(url) =>
                          updateActiveProject({
                            image: url,
                            imageFit: url.endsWith('.svg') ? 'contain' : 'cover',
                            visualType: url.endsWith('.svg') ? 'illustrative' : 'real',
                          })
                        }
                        focal={activeProject.imageFocal || '50% 50%'}
                        onFocalChange={(focal) => updateActiveProject({ imageFocal: focal })}
                        token={token}
                        showWorkPresets
                      />

                      <div className="admin-field">
                        <label>Ringkasan Pendek (Tampil di Kartu Rak Depan)</label>
                        <textarea
                          rows={2}
                          value={activeProject.summary}
                          onChange={(e) => updateActiveProject({ summary: e.target.value })}
                        />
                      </div>

                      <div className="admin-field">
                        <label>Deskripsi Lengkap (Tampil saat Modal Proyek Dibuka)</label>
                        <textarea
                          rows={3}
                          value={activeProject.description}
                          onChange={(e) => updateActiveProject({ description: e.target.value })}
                        />
                      </div>

                      <div className="admin-grid-3">
                        <div className="admin-field">
                          <label>Masalah &amp; Konteks</label>
                          <textarea
                            rows={3}
                            value={activeProject.problem}
                            onChange={(e) => updateActiveProject({ problem: e.target.value })}
                          />
                        </div>
                        <div className="admin-field">
                          <label>Pendekatan &amp; Eksplorasi</label>
                          <textarea
                            rows={3}
                            value={activeProject.exploration}
                            onChange={(e) => updateActiveProject({ exploration: e.target.value })}
                          />
                        </div>
                        <div className="admin-field">
                          <label>Hasil &amp; Catatan</label>
                          <textarea
                            rows={3}
                            value={activeProject.outcome}
                            onChange={(e) => updateActiveProject({ outcome: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="admin-field">
                        <label>Stack / Tag Teknologi</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input
                            value={tagDraft}
                            onChange={(e) => setTagDraft(e.target.value)}
                            placeholder="Ketik teknologi (misal: Next.js, Gemini API) lalu tekan Enter…"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const clean = tagDraft.trim();
                                if (clean && !activeProject.ecosystem.includes(clean)) {
                                  updateActiveProject({ ecosystem: [...activeProject.ecosystem, clean] });
                                }
                                setTagDraft('');
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="admin-btn"
                            onClick={() => {
                              const clean = tagDraft.trim();
                              if (clean && !activeProject.ecosystem.includes(clean)) {
                                updateActiveProject({ ecosystem: [...activeProject.ecosystem, clean] });
                              }
                              setTagDraft('');
                            }}
                          >
                            + Tag
                          </button>
                        </div>
                        <div className="admin-tag-chips">
                          {activeProject.ecosystem.map((tag) => (
                            <span className="admin-tag-chip" key={tag}>
                              {tag}
                              <button
                                type="button"
                                onClick={() => updateActiveProject({ ecosystem: activeProject.ecosystem.filter((t) => t !== tag) })}
                                aria-label={`Hapus tag ${tag}`}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="admin-card">
                      <h3>Pratinjau Kartu Rak Langsung</h3>
                      <div style={{ maxWidth: 360 }}>
                        <article className="work-card" style={{ transform: 'none' }}>
                          <div className="work-visual-button">
                            <WorkCover work={activeProject} />
                          </div>
                          <div className="work-meta">
                            <span>
                              {String(selectedProjectIdx + 1).padStart(2, '0')} / {activeProject.category}
                            </span>
                            <span>{statusLabels[activeProject.status] || activeProject.status}</span>
                          </div>
                          <div className="work-title">
                            <h3>{activeProject.name}</h3>
                            <ArrowUpRight size={18} />
                          </div>
                          <p>{activeProject.summary}</p>
                        </article>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="admin-card">Belum ada proyek. Klik &ldquo;Tambah Proyek Baru&rdquo; untuk memulai.</div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: IDENTITY & HERO */}
          {tab === 'identity' && (
            <>
              <div className="admin-section-head">
                <div>
                  <h2>Hero &amp; Identitas Utama</h2>
                  <p>Ubah nama brand, foto utama di tumpukan kaca 3D, logo avatar, serta seluruh teks pembuka Hero.</p>
                </div>
              </div>

              <div className="admin-card">
                <h3>Profil &amp; Foto Identitas</h3>
                <div className="admin-grid-3">
                  <div className="admin-field">
                    <label>Nama Alias / Brand Pendek</label>
                    <input
                      value={draft.identity.name}
                      onChange={(e) => updateDraft((d) => ({ ...d, identity: { ...d.identity, name: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Nama Lengkap</label>
                    <input
                      value={draft.identity.fullName}
                      onChange={(e) => updateDraft((d) => ({ ...d, identity: { ...d.identity, fullName: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Nama Brand Resmi</label>
                    <input
                      value={draft.identity.brand}
                      onChange={(e) => updateDraft((d) => ({ ...d, identity: { ...d.identity, brand: e.target.value } }))}
                    />
                  </div>
                </div>

                <div className="admin-grid-3">
                  <div className="admin-field">
                    <label>Peran / Spesialisasi</label>
                    <input
                      value={draft.identity.role}
                      onChange={(e) => updateDraft((d) => ({ ...d, identity: { ...d.identity, role: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Pendidikan / Status</label>
                    <input
                      value={draft.identity.education}
                      onChange={(e) => updateDraft((d) => ({ ...d, identity: { ...d.identity, education: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Lokasi</label>
                    <input
                      value={draft.identity.location}
                      onChange={(e) => updateDraft((d) => ({ ...d, identity: { ...d.identity, location: e.target.value } }))}
                    />
                  </div>
                </div>

                <div className="admin-grid-2">
                  <ImageField
                    label="Logo / Emblem Brand (Header, Orbit & Intro)"
                    value={draft.identity.markImage}
                    onChange={(url) => updateDraft((d) => ({ ...d, identity: { ...d.identity, markImage: url } }))}
                    token={token}
                    previewAspect="square"
                  />
                  <ImageField
                    label="Foto Utama Hero (fallback bila daftar kartu di bawah kosong)"
                    value={draft.identity.portraitImage}
                    onChange={(url) => updateDraft((d) => ({ ...d, identity: { ...d.identity, portraitImage: url } }))}
                    focal={draft.identity.portraitFocal}
                    onFocalChange={(focal) => updateDraft((d) => ({ ...d, identity: { ...d.identity, portraitFocal: focal } }))}
                    token={token}
                    previewAspect="portrait"
                  />
                </div>
              </div>

              <div className="admin-card">
                <h3>Tipografi &amp; Narasi Hero</h3>
                <div className="admin-grid-3">
                  <div className="admin-field">
                    <label>Eyebrow Atas</label>
                    <input
                      value={draft.identity.heroEyebrow}
                      onChange={(e) => updateDraft((d) => ({ ...d, identity: { ...d.identity, heroEyebrow: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Judul Utama (Baris 1)</label>
                    <input
                      value={draft.identity.heroTitleLine1}
                      onChange={(e) => updateDraft((d) => ({ ...d, identity: { ...d.identity, heroTitleLine1: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Judul Utama (Baris Italic)</label>
                    <input
                      value={draft.identity.heroTitleItalic}
                      onChange={(e) => updateDraft((d) => ({ ...d, identity: { ...d.identity, heroTitleItalic: e.target.value } }))}
                    />
                  </div>
                </div>

                <div className="admin-field">
                  <label>Deskripsi Singkat Hero</label>
                  <textarea
                    rows={3}
                    value={draft.identity.heroDescription}
                    onChange={(e) => updateDraft((d) => ({ ...d, identity: { ...d.identity, heroDescription: e.target.value } }))}
                  />
                </div>

                <div className="admin-grid-3">
                  <div className="admin-field">
                    <label>Baris Identitas Tebal</label>
                    <input
                      value={draft.identity.heroIdentityHeading}
                      onChange={(e) => updateDraft((d) => ({ ...d, identity: { ...d.identity, heroIdentityHeading: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Sub-Identitas</label>
                    <input
                      value={draft.identity.heroIdentitySub}
                      onChange={(e) => updateDraft((d) => ({ ...d, identity: { ...d.identity, heroIdentitySub: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Teks Sudut Kanan Bawah &amp; Signature</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={draft.identity.heroCorner}
                        onChange={(e) => updateDraft((d) => ({ ...d, identity: { ...d.identity, heroCorner: e.target.value } }))}
                      />
                      <input
                        style={{ maxWidth: 120 }}
                        value={draft.identity.signature}
                        onChange={(e) => updateDraft((d) => ({ ...d, identity: { ...d.identity, signature: e.target.value } }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="admin-grid-2">
                  <div className="admin-field">
                    <label>Kartu Mengambang Kiri (Currently Exploring — pisahkan 2 baris)</label>
                    <textarea
                      rows={2}
                      value={draft.identity.heroExploringText}
                      onChange={(e) => updateDraft((d) => ({ ...d, identity: { ...d.identity, heroExploringText: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Kartu Lokasi Kanan &amp; Caption Potret</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <input
                        value={draft.identity.heroLocationLabel}
                        onChange={(e) => updateDraft((d) => ({ ...d, identity: { ...d.identity, heroLocationLabel: e.target.value } }))}
                        placeholder="JAKARTA, ID"
                      />
                      <input
                        value={draft.identity.heroLocationSub}
                        onChange={(e) => updateDraft((d) => ({ ...d, identity: { ...d.identity, heroLocationSub: e.target.value } }))}
                        placeholder="Research & build."
                      />
                    </div>
                    <input
                      style={{ marginTop: 8 }}
                      value={draft.identity.heroStack.portraitCaption}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          identity: { ...d.identity, heroStack: { ...d.identity.heroStack, portraitCaption: e.target.value } },
                        }))
                      }
                      placeholder="Caption Kartu 01 (default stack)"
                    />
                  </div>
                </div>
              </div>

              <div className="admin-card">
                <div className="admin-card-head" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <h3>Kartu Foto Stack 3D Hero ({heroCards.length} kartu)</h3>
                    <p style={{ color: 'var(--quiet)', fontSize: 11.5, margin: '4px 0 0', lineHeight: 1.6 }}>
                      Tambah, edit, urutkan, atau hapus foto di tumpukan kaca Hero. Kartu pertama adalah yang tampil
                      paling depan saat pengunjung membuka website.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="admin-btn admin-btn-sm" onClick={addHeroCard}>
                      <Plus size={14} />
                      Tambah Kartu
                    </button>
                    <button type="button" className="admin-btn admin-btn-sm" onClick={resetHeroCards}>
                      <RotateCcw size={13} />
                      Reset ke 3 Kartu Bawaan
                    </button>
                  </div>
                </div>

                {heroCards.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Belum ada kartu. Klik <strong>Tambah Kartu</strong> atau <strong>Reset ke 3 Kartu Bawaan</strong>.
                  </p>
                )}

                {heroCards.map((card, idx) => (
                  <div
                    key={card.id}
                    style={{
                      border: '1px solid var(--line)',
                      borderRadius: 8,
                      padding: 14,
                      marginTop: 12,
                      background: 'var(--surface-2)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <strong style={{ fontSize: 12, letterSpacing: 0.6 }}>
                        KARTU {String(idx + 1).padStart(2, '0')}
                        {idx === 0 ? ' — TAMPIL DI DEPAN' : ''}
                      </strong>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm"
                          disabled={idx === 0}
                          onClick={() => moveHeroCard(card.id, -1)}
                          aria-label={`Naikkan kartu ${idx + 1}`}
                        >
                          <ArrowUp size={13} />
                          Naik
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm"
                          disabled={idx === heroCards.length - 1}
                          onClick={() => moveHeroCard(card.id, 1)}
                          aria-label={`Turunkan kartu ${idx + 1}`}
                        >
                          <ArrowDown size={13} />
                          Turun
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-danger"
                          disabled={heroCards.length <= 1}
                          onClick={() => removeHeroCard(card.id)}
                          aria-label={`Hapus kartu ${idx + 1}`}
                        >
                          <Trash2 size={13} />
                          Hapus
                        </button>
                      </div>
                    </div>

                    <div className="admin-grid-2">
                      <div className="admin-field">
                        <label>Judul Kartu</label>
                        <input value={card.title} onChange={(e) => updateHeroCard(card.id, { title: e.target.value })} />
                      </div>
                      <div className="admin-field">
                        <label>Caption Kartu</label>
                        <input
                          value={card.caption}
                          onChange={(e) => updateHeroCard(card.id, { caption: e.target.value })}
                        />
                      </div>
                    </div>

                    <ImageField
                      label={`Foto Kartu ${String(idx + 1).padStart(2, '0')}`}
                      value={card.image}
                      onChange={(url) => updateHeroCard(card.id, { image: url })}
                      focal={card.focal || '50% 30%'}
                      onFocalChange={(focal) => updateHeroCard(card.id, { focal })}
                      token={token}
                      previewAspect="portrait"
                      showWorkPresets
                      fallbackSrc="/images/nodata-portrait.jpg"
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* TAB 3: ABOUT */}
          {tab === 'about' && (
            <>
              <div className="admin-section-head">
                <div>
                  <h2>02 — Beyond the Code (Cerita Awal &amp; Pendekatan)</h2>
                  <p>Ubah narasi latar belakang, motivasi fokus saat ini, dan cara kerja bersama AI.</p>
                </div>
              </div>

              <div className="admin-card">
                <div className="admin-grid-3">
                  <div className="admin-field">
                    <label>Judul Bab</label>
                    <input
                      value={draft.about.chapterTitle}
                      onChange={(e) => updateDraft((d) => ({ ...d, about: { ...d.about, chapterTitle: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Heading Baris 1</label>
                    <input
                      value={draft.about.headingLine1}
                      onChange={(e) => updateDraft((d) => ({ ...d, about: { ...d.about, headingLine1: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Heading Italic</label>
                    <input
                      value={draft.about.headingItalic}
                      onChange={(e) => updateDraft((d) => ({ ...d, about: { ...d.about, headingItalic: e.target.value } }))}
                    />
                  </div>
                </div>

                <div className="admin-grid-3" style={{ marginTop: 12 }}>
                  {[0, 1, 2].map((idx) => (
                    <div className="admin-field" key={idx}>
                      <label>Pilar Nilai #{idx + 1}</label>
                      <input
                        value={draft.about.values[idx] || ''}
                        onChange={(e) =>
                          updateDraft((d) => {
                            const vals = [...d.about.values];
                            vals[idx] = e.target.value;
                            return { ...d, about: { ...d.about, values: vals } };
                          })
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="admin-field" style={{ marginTop: 14 }}>
                  <label>Paragraf 1 — Cerita Awal (Lead)</label>
                  <textarea
                    rows={4}
                    value={draft.about.lead}
                    onChange={(e) => updateDraft((d) => ({ ...d, about: { ...d.about, lead: e.target.value } }))}
                  />
                </div>
                <div className="admin-field">
                  <label>Paragraf 2 — Fokus &amp; Eksplorasi Aktif</label>
                  <textarea
                    rows={4}
                    value={draft.about.motivation}
                    onChange={(e) => updateDraft((d) => ({ ...d, about: { ...d.about, motivation: e.target.value } }))}
                  />
                </div>
                <div className="admin-field">
                  <label>Paragraf 3 — Workflow &amp; Kolaborasi</label>
                  <textarea
                    rows={4}
                    value={draft.about.approach}
                    onChange={(e) => updateDraft((d) => ({ ...d, about: { ...d.about, approach: e.target.value } }))}
                  />
                </div>
              </div>
            </>
          )}

          {/* TAB 4: JOURNEY CHAPTERS */}
          {tab === 'journey' && (
            <>
              <div className="admin-section-head">
                <div>
                  <h2>03 — The Evolution (Bab Perjalanan)</h2>
                  <p>Tambah, urutkan, edit, atau hapus bab linimasa perjalanan belajar &amp; visi ke depan.</p>
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() =>
                    updateDraft((d) => {
                      const nextNum = String(d.journey.steps.length + 1).padStart(2, '0');
                      d.journey.steps.push({
                        phase: `Chapter ${nextNum} — Fase Baru`,
                        title: 'Judul Bab Baru',
                        subtitle: 'Subjudul fase perjalanan',
                        description: 'Tuliskan deskripsi perjalanan pada bab ini.',
                        techKeywords: ['Milestone', 'Web & AI'],
                      });
                      return d;
                    })
                  }
                >
                  <Plus size={15} />
                  Tambah Bab
                </button>
              </div>

              <div className="admin-card">
                <h3>Pengaturan Panggung 3D &amp; Heading</h3>
                <div className="admin-grid-3">
                  <div className="admin-field">
                    <label>Judul Bab</label>
                    <input
                      value={draft.journey.chapterTitle}
                      onChange={(e) => updateDraft((d) => ({ ...d, journey: { ...d.journey, chapterTitle: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Heading Baris 1</label>
                    <input
                      value={draft.journey.headingLine1}
                      onChange={(e) => updateDraft((d) => ({ ...d, journey: { ...d.journey, headingLine1: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Heading Italic</label>
                    <input
                      value={draft.journey.headingItalic}
                      onChange={(e) => updateDraft((d) => ({ ...d, journey: { ...d.journey, headingItalic: e.target.value } }))}
                    />
                  </div>
                </div>
                <div className="admin-grid-2" style={{ marginTop: 12 }}>
                  <div className="admin-field">
                    <label>Label Perangkat Bawah</label>
                    <input
                      value={draft.journey.deviceNote}
                      onChange={(e) => updateDraft((d) => ({ ...d, journey: { ...d.journey, deviceNote: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Kode Layar Terminal 3D (Satu baris per enter)</label>
                    <textarea
                      rows={3}
                      value={(draft.journey.terminalLines || []).join('\n')}
                      onChange={(e) =>
                        updateDraft((d) => ({ ...d, journey: { ...d.journey, terminalLines: e.target.value.split('\n') } }))
                      }
                    />
                  </div>
                </div>
              </div>

              {draft.journey.steps.map((step: JourneyStep, idx: number) => (
                <div className="admin-card" key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0 }}>
                      Bab {String(idx + 1).padStart(2, '0')} — {step.title}
                    </h3>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="admin-icon-btn"
                        disabled={idx === 0}
                        onClick={() =>
                          updateDraft((d) => {
                            const [item] = d.journey.steps.splice(idx, 1);
                            d.journey.steps.splice(idx - 1, 0, item);
                            return d;
                          })
                        }
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="admin-icon-btn"
                        disabled={idx === draft.journey.steps.length - 1}
                        onClick={() =>
                          updateDraft((d) => {
                            const [item] = d.journey.steps.splice(idx, 1);
                            d.journey.steps.splice(idx + 1, 0, item);
                            return d;
                          })
                        }
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        className="admin-icon-btn"
                        disabled={draft.journey.steps.length <= 1}
                        onClick={() => {
                          if (!window.confirm(`Hapus bab "${step.title}"?`)) return;
                          updateDraft((d) => {
                            d.journey.steps.splice(idx, 1);
                            return d;
                          });
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="admin-grid-3">
                    <div className="admin-field">
                      <label>Label Fase / Waktu</label>
                      <input
                        value={step.phase}
                        onChange={(e) =>
                          updateDraft((d) => {
                            d.journey.steps[idx].phase = e.target.value;
                            return d;
                          })
                        }
                      />
                    </div>
                    <div className="admin-field">
                      <label>Judul Bab</label>
                      <input
                        value={step.title}
                        onChange={(e) =>
                          updateDraft((d) => {
                            d.journey.steps[idx].title = e.target.value;
                            return d;
                          })
                        }
                      />
                    </div>
                    <div className="admin-field">
                      <label>Subjudul</label>
                      <input
                        value={step.subtitle}
                        onChange={(e) =>
                          updateDraft((d) => {
                            d.journey.steps[idx].subtitle = e.target.value;
                            return d;
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="admin-field">
                    <label>Deskripsi Cerita Bab</label>
                    <textarea
                      rows={3}
                      value={step.description}
                      onChange={(e) =>
                        updateDraft((d) => {
                          d.journey.steps[idx].description = e.target.value;
                          return d;
                        })
                      }
                    />
                  </div>
                  <div className="admin-field">
                    <label>Kata Kunci / Tags (Pisahkan dengan koma; tag pertama tampil di modul 3D)</label>
                    <input
                      value={step.techKeywords.join(', ')}
                      onChange={(e) =>
                        updateDraft((d) => {
                          d.journey.steps[idx].techKeywords = e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean);
                          return d;
                        })
                      }
                    />
                  </div>
                </div>
              ))}
            </>
          )}

          {/* TAB 5: ECOSYSTEM & TOOLS */}
          {tab === 'ecosystem' && (
            <>
              <div className="admin-section-head">
                <div>
                  <h2>04 — Under the Glass (Stack &amp; Orbit Tools)</h2>
                  <p>Kelola link GitHub pusat, arsitektur stack, serta kategori &amp; daftar tools yang berputar di Orbit 3D.</p>
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() =>
                    updateDraft((d) => {
                      d.ecosystem.groups.push({
                        category: 'Kategori Baru',
                        items: [{ name: 'Tool Baru', description: 'Deskripsi fungsi tool ini.', iconName: 'Code' }],
                      });
                      return d;
                    })
                  }
                >
                  <Plus size={15} />
                  Tambah Kategori Tool
                </button>
              </div>

              <div className="admin-card">
                <h3>GitHub Hub &amp; Pengantar</h3>
                <div className="admin-grid-2">
                  <div className="admin-field">
                    <label>URL GitHub Pusat</label>
                    <input
                      value={draft.ecosystem.githubUrl}
                      onChange={(e) => updateDraft((d) => ({ ...d, ecosystem: { ...d.ecosystem, githubUrl: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Label Hub Pusat</label>
                    <input
                      value={draft.ecosystem.githubLabel}
                      onChange={(e) => updateDraft((d) => ({ ...d, ecosystem: { ...d.ecosystem, githubLabel: e.target.value } }))}
                    />
                  </div>
                </div>
                <div className="admin-field" style={{ marginTop: 10 }}>
                  <label>Deskripsi Pengantar Seksi Tools</label>
                  <textarea
                    rows={2}
                    value={draft.ecosystem.intro}
                    onChange={(e) => updateDraft((d) => ({ ...d, ecosystem: { ...d.ecosystem, intro: e.target.value } }))}
                  />
                </div>
              </div>

              {draft.ecosystem.groups.map((grp, gIdx) => (
                <div className="admin-card" key={gIdx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        style={{ fontWeight: 600, fontSize: 15, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--line-strong)', background: 'var(--bg)', color: 'var(--ink)' }}
                        value={grp.category}
                        onChange={(e) =>
                          updateDraft((d) => {
                            d.ecosystem.groups[gIdx].category = e.target.value;
                            return d;
                          })
                        }
                      />
                      <span className="admin-badge">{grp.items.length} tools</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm"
                        onClick={() =>
                          updateDraft((d) => {
                            d.ecosystem.groups[gIdx].items.push({
                              name: 'Tool Baru',
                              description: 'Peran tool dalam alur kerja.',
                              iconName: 'Sparkles',
                            });
                            return d;
                          })
                        }
                      >
                        <Plus size={13} />
                        Tambah Tool
                      </button>
                      {draft.ecosystem.groups.length > 1 && (
                        <button
                          type="button"
                          className="admin-btn admin-btn-sm admin-btn-danger"
                          onClick={() => {
                            if (!window.confirm(`Hapus kategori "${grp.category}" beserta isinya?`)) return;
                            updateDraft((d) => {
                              d.ecosystem.groups.splice(gIdx, 1);
                              return d;
                            });
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {grp.items.map((tool, tIdx) => (
                    <div
                      key={tIdx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1.6fr 1.2fr auto',
                        gap: 10,
                        alignItems: 'center',
                        padding: '10px 0',
                        borderTop: '1px solid var(--line)',
                      }}
                    >
                      <input
                        value={tool.name}
                        placeholder="Nama Tool"
                        onChange={(e) =>
                          updateDraft((d) => {
                            d.ecosystem.groups[gIdx].items[tIdx].name = e.target.value;
                            return d;
                          })
                        }
                        style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line-strong)', background: 'var(--bg)', color: 'var(--ink)' }}
                      />
                      <input
                        value={tool.description}
                        placeholder="Deskripsi singkat"
                        onChange={(e) =>
                          updateDraft((d) => {
                            d.ecosystem.groups[gIdx].items[tIdx].description = e.target.value;
                            return d;
                          })
                        }
                        style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line-strong)', background: 'var(--bg)', color: 'var(--ink)' }}
                      />
                      <input
                        value={tool.iconUrl || ''}
                        placeholder="URL Ikon kustom (opsional)"
                        onChange={(e) =>
                          updateDraft((d) => {
                            d.ecosystem.groups[gIdx].items[tIdx].iconUrl = e.target.value;
                            return d;
                          })
                        }
                        style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--line-strong)', background: 'var(--bg)', color: 'var(--ink)' }}
                      />
                      <button
                        type="button"
                        className="admin-icon-btn"
                        onClick={() =>
                          updateDraft((d) => {
                            d.ecosystem.groups[gIdx].items.splice(tIdx, 1);
                            return d;
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}

          {/* TAB 6: WAIFU & PERSONAL UNIVERSE */}
          {tab === 'personal' && (
            <>
              <div className="admin-section-head">
                <div>
                  <h2>05 — The Personal Universe (Waifu, Video &amp; Kings/Queen)</h2>
                  <p>Kartu urutan #1 otomatis menjadi &ldquo;THE FAVORITE&rdquo; dan juga muncul pada Kartu ke-3 di Hero 3D Stack.</p>
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() =>
                    updateDraft((d) => {
                      const next: AnimeCharacter = {
                        id: `char-${Date.now().toString().slice(-4)}`,
                        name: 'Karakter Baru',
                        origin: 'Judul Anime',
                        label: 'Character Trait',
                        note: 'Catatan singkat tentang alasan menyukai karakter ini.',
                        image: '/images/anime-v22/alya.jpg',
                        focal: '50% 18%',
                      };
                      d.personal.anime.push(next);
                      return d;
                    })
                  }
                >
                  <Plus size={15} />
                  Tambah Karakter Waifu
                </button>
              </div>

              <div className="admin-card">
                <h3>Pengantar Seksi Personal Universe</h3>
                <div className="admin-grid-2">
                  <div className="admin-field">
                    <label>Heading Baris 1</label>
                    <input
                      value={draft.personal.headingLine1}
                      onChange={(e) => updateDraft((d) => ({ ...d, personal: { ...d.personal, headingLine1: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Heading Italic</label>
                    <input
                      value={draft.personal.headingItalic}
                      onChange={(e) => updateDraft((d) => ({ ...d, personal: { ...d.personal, headingItalic: e.target.value } }))}
                    />
                  </div>
                </div>
                <div className="admin-field" style={{ marginTop: 10 }}>
                  <label>Paragraf Pengantar</label>
                  <textarea
                    rows={2}
                    value={draft.personal.intro}
                    onChange={(e) => updateDraft((d) => ({ ...d, personal: { ...d.personal, intro: e.target.value } }))}
                  />
                </div>
              </div>

              {draft.personal.anime.map((char, idx) => (
                <div className="admin-card" key={char.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h3 style={{ margin: 0 }}>
                      Kartu #{idx + 1} {idx === 0 ? '(THE FAVORITE + Hero Card 03)' : ''} — {char.name}
                    </h3>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="admin-icon-btn"
                        disabled={idx === 0}
                        onClick={() =>
                          updateDraft((d) => {
                            const [item] = d.personal.anime.splice(idx, 1);
                            d.personal.anime.splice(idx - 1, 0, item);
                            return d;
                          })
                        }
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="admin-icon-btn"
                        disabled={idx === draft.personal.anime.length - 1}
                        onClick={() =>
                          updateDraft((d) => {
                            const [item] = d.personal.anime.splice(idx, 1);
                            d.personal.anime.splice(idx + 1, 0, item);
                            return d;
                          })
                        }
                      >
                        <ArrowDown size={14} />
                      </button>
                      {draft.personal.anime.length > 1 && (
                        <button
                          type="button"
                          className="admin-icon-btn"
                          onClick={() => {
                            if (!window.confirm(`Hapus karakter "${char.name}"?`)) return;
                            updateDraft((d) => {
                              d.personal.anime.splice(idx, 1);
                              return d;
                            });
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="admin-grid-3">
                    <div className="admin-field">
                      <label>Nama Karakter</label>
                      <input
                        value={char.name}
                        onChange={(e) =>
                          updateDraft((d) => {
                            d.personal.anime[idx].name = e.target.value;
                            return d;
                          })
                        }
                      />
                    </div>
                    <div className="admin-field">
                      <label>Asal Anime / Seri</label>
                      <input
                        value={char.origin}
                        onChange={(e) =>
                          updateDraft((d) => {
                            d.personal.anime[idx].origin = e.target.value;
                            return d;
                          })
                        }
                      />
                    </div>
                    <div className="admin-field">
                      <label>Label Karakter</label>
                      <input
                        value={char.label}
                        onChange={(e) =>
                          updateDraft((d) => {
                            d.personal.anime[idx].label = e.target.value;
                            return d;
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="admin-field">
                    <label>Deskripsi / Catatan Karakter</label>
                    <textarea
                      rows={2}
                      value={char.note}
                      onChange={(e) =>
                        updateDraft((d) => {
                          d.personal.anime[idx].note = e.target.value;
                          return d;
                        })
                      }
                    />
                  </div>

                  <ImageField
                    label={`Foto Potret ${char.name}`}
                    value={char.image}
                    onChange={(url) =>
                      updateDraft((d) => {
                        d.personal.anime[idx].image = url;
                        return d;
                      })
                    }
                    focal={char.focal || '50% 18%'}
                    onFocalChange={(focal) =>
                      updateDraft((d) => {
                        d.personal.anime[idx].focal = focal;
                        return d;
                      })
                    }
                    token={token}
                    previewAspect="portrait"
                  />
                </div>
              ))}

              <div className="admin-card">
                <h3>Video Banner &amp; Panel Kings &amp; Queen</h3>
                <div className="admin-grid-2">
                  <div className="admin-field">
                    <label>Judul Video</label>
                    <input
                      value={draft.personal.video.title}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          personal: { ...d.personal, video: { ...d.personal.video, title: e.target.value } },
                        }))
                      }
                    />
                  </div>
                  <div className="admin-field">
                    <label>Sumber Video MP4</label>
                    <input
                      value={draft.personal.video.url}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          personal: { ...d.personal, video: { ...d.personal.video, url: e.target.value } },
                        }))
                      }
                      placeholder="/images/uploads/video.mp4 atau https://.../video.mp4"
                    />
                  </div>
                </div>

                <VideoField
                  url={draft.personal.video.url}
                  poster={draft.personal.video.poster || '/posters/cote.webp'}
                  rotation={draft.personal.video.rotation ?? 0}
                  fit={draft.personal.video.fit === 'contain' ? 'contain' : 'cover'}
                  token={token}
                  onChange={(patch) =>
                    updateDraft((d) => ({
                      ...d,
                      personal: { ...d.personal, video: { ...d.personal.video, ...patch } },
                    }))
                  }
                />

                <ImageField
                  label="Poster / Thumbnail Video (tampil sebelum video play)"
                  value={draft.personal.video.poster || '/posters/cote.webp'}
                  onChange={(url) =>
                    updateDraft((d) => ({
                      ...d,
                      personal: { ...d.personal, video: { ...d.personal.video, poster: url } },
                    }))
                  }
                  token={token}
                  previewAspect="landscape"
                />
                <div className="admin-field" style={{ marginTop: 10 }}>
                  <label>Caption Kings &amp; Queen</label>
                  <textarea
                    rows={2}
                    value={draft.personal.royal.caption}
                    onChange={(e) =>
                      updateDraft((d) => ({
                        ...d,
                        personal: { ...d.personal, royal: { ...d.personal.royal, caption: e.target.value } },
                      }))
                    }
                  />
                </div>
                <ImageField
                  label="Gambar Panel Kings & Queen"
                  value={draft.personal.royal.image}
                  onChange={(url) =>
                    updateDraft((d) => ({
                      ...d,
                      personal: { ...d.personal, royal: { ...d.personal.royal, image: url } },
                    }))
                  }
                  token={token}
                />
              </div>
            </>
          )}

          {/* TAB 6B: CERTIFICATES & APPRECIATION */}
          {tab === 'certificates' && (
            <>
              <div className="admin-section-head">
                <div>
                  <h2>07 — Certificates &amp; Appreciation (Sertifikat &amp; Apresiasi)</h2>
                  <p>Tambah sertifikat baru, unggah gambar sertifikat dari perangkat, edit penerbit &amp; deskripsi, urutkan, atau hapus.</p>
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() =>
                    updateDraft((d) => {
                      const nextCert: CertificateItem = {
                        id: `cert-${Date.now().toString().slice(-4)}`,
                        title: 'Sertifikat Baru',
                        issuer: 'Nama Institusi / Penerbit',
                        date: '2026',
                        badge: 'Certification',
                        description: 'Deskripsi kompetensi atau apresiasi yang diraih pada sertifikat ini.',
                        image: '/images/certificates/cert-01.svg',
                        fallbackImage: '/images/certificates/cert-01.svg',
                        credentialUrl: '',
                      };
                      d.certificates.items.unshift(nextCert);
                      return d;
                    })
                  }
                >
                  <Plus size={15} />
                  Tambah Sertifikat Baru
                </button>
              </div>

              <div className="admin-card">
                <h3>Pengantar Seksi Sertifikat</h3>
                <div className="admin-grid-3">
                  <div className="admin-field">
                    <label>Judul Bab</label>
                    <input
                      value={draft.certificates.chapterTitle}
                      onChange={(e) =>
                        updateDraft((d) => ({ ...d, certificates: { ...d.certificates, chapterTitle: e.target.value } }))
                      }
                    />
                  </div>
                  <div className="admin-field">
                    <label>Heading Baris 1</label>
                    <input
                      value={draft.certificates.headingLine1}
                      onChange={(e) =>
                        updateDraft((d) => ({ ...d, certificates: { ...d.certificates, headingLine1: e.target.value } }))
                      }
                    />
                  </div>
                  <div className="admin-field">
                    <label>Heading Italic</label>
                    <input
                      value={draft.certificates.headingItalic}
                      onChange={(e) =>
                        updateDraft((d) => ({ ...d, certificates: { ...d.certificates, headingItalic: e.target.value } }))
                      }
                    />
                  </div>
                </div>
                <div className="admin-field" style={{ marginTop: 10 }}>
                  <label>Deskripsi Pengantar</label>
                  <textarea
                    rows={2}
                    value={draft.certificates.intro}
                    onChange={(e) =>
                      updateDraft((d) => ({ ...d, certificates: { ...d.certificates, intro: e.target.value } }))
                    }
                  />
                </div>
              </div>

              {draft.certificates.items.map((cert, idx) => (
                <div className="admin-card" key={cert.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0 }}>
                      Sertifikat #{String(idx + 1).padStart(2, '0')} — {cert.title}
                    </h3>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="admin-icon-btn"
                        disabled={idx === 0}
                        onClick={() =>
                          updateDraft((d) => {
                            const [item] = d.certificates.items.splice(idx, 1);
                            d.certificates.items.splice(idx - 1, 0, item);
                            return d;
                          })
                        }
                        title="Geser Naik"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="admin-icon-btn"
                        disabled={idx === draft.certificates.items.length - 1}
                        onClick={() =>
                          updateDraft((d) => {
                            const [item] = d.certificates.items.splice(idx, 1);
                            d.certificates.items.splice(idx + 1, 0, item);
                            return d;
                          })
                        }
                        title="Geser Turun"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        className="admin-icon-btn"
                        onClick={() => {
                          if (!window.confirm(`Hapus sertifikat "${cert.title}"?`)) return;
                          updateDraft((d) => {
                            d.certificates.items.splice(idx, 1);
                            return d;
                          });
                        }}
                        title="Hapus Sertifikat"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="admin-grid-2">
                    <div className="admin-field">
                      <label>Judul Sertifikat</label>
                      <input
                        value={cert.title}
                        onChange={(e) =>
                          updateDraft((d) => {
                            d.certificates.items[idx].title = e.target.value;
                            return d;
                          })
                        }
                      />
                    </div>
                    <div className="admin-field">
                      <label>Penerbit / Institusi</label>
                      <input
                        value={cert.issuer}
                        onChange={(e) =>
                          updateDraft((d) => {
                            d.certificates.items[idx].issuer = e.target.value;
                            return d;
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="admin-grid-3">
                    <div className="admin-field">
                      <label>Tanggal Terbit</label>
                      <input
                        value={cert.date}
                        onChange={(e) =>
                          updateDraft((d) => {
                            d.certificates.items[idx].date = e.target.value;
                            return d;
                          })
                        }
                      />
                    </div>
                    <div className="admin-field">
                      <label>Badge / Kategori</label>
                      <input
                        value={cert.badge}
                        onChange={(e) =>
                          updateDraft((d) => {
                            d.certificates.items[idx].badge = e.target.value;
                            return d;
                          })
                        }
                      />
                    </div>
                    <div className="admin-field">
                      <label>URL File / Kredensial Sertifikat</label>
                      <input
                        value={cert.credentialUrl || ''}
                        placeholder="https://..."
                        onChange={(e) =>
                          updateDraft((d) => {
                            d.certificates.items[idx].credentialUrl = e.target.value;
                            return d;
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="admin-field">
                    <label>Deskripsi Sertifikat</label>
                    <textarea
                      rows={3}
                      value={cert.description}
                      onChange={(e) =>
                        updateDraft((d) => {
                          d.certificates.items[idx].description = e.target.value;
                          return d;
                        })
                      }
                    />
                  </div>

                  <ImageField
                    label={`Gambar Sertifikat (${cert.title})`}
                    value={cert.image}
                    fallbackSrc={cert.fallbackImage || `/images/certificates/cert-0${(idx % 5) + 1}.svg`}
                    onChange={(url) =>
                      updateDraft((d) => {
                        d.certificates.items[idx].image = url;
                        if (!d.certificates.items[idx].credentialUrl) {
                          d.certificates.items[idx].credentialUrl = url;
                        }
                        return d;
                      })
                    }
                    token={token}
                  />
                </div>
              ))}
            </>
          )}

          {/* TAB 7: RELAY AI & ETHOS */}
          {tab === 'relay' && (
            <>
              <div className="admin-section-head">
                <div>
                  <h2>06 — Relay Personal AI &amp; 08 — The Ethos</h2>
                  <p>Seluruh perubahan pada proyek, sertifikat, perjalanan, dan profil otomatis dipelajari oleh Relay AI setelah disimpan.</p>
                </div>
              </div>

              <div className="admin-card">
                <h3>API Key Gemini (bisa langsung ditulis di sini)</h3>
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.75, marginBottom: 12 }}>
                  Tempel API key Google Gemini Anda di bawah ini — tanpa perlu menyentuh Vercel atau file{' '}
                  <code>.env</code>. Key <strong>langsung dienkripsi</strong> (AES-256-GCM + scrypt) sebelum
                  disimpan, disimpan <strong>terpisah dari data publik website</strong>, dan{' '}
                  <strong>tidak pernah dikembalikan ke browser</strong> — panel ini hanya menampilkan versi
                  tersensor.
                </p>

                <div className="admin-field">
                  <label>Status Key</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
                    <span className="admin-badge">
                      {secret?.configured
                        ? secret.source === 'env'
                          ? 'Aktif · dari Environment Variable'
                          : 'Aktif · tersimpan terenkripsi'
                        : 'Belum ada key'}
                    </span>
                    {secret?.masked && <code style={{ fontSize: 11.5 }}>{secret.masked}</code>}
                    {secret?.updatedAt && (
                      <small style={{ color: 'var(--quiet)', fontSize: 11 }}>
                        diperbarui {new Date(secret.updatedAt).toLocaleString('id-ID')}
                      </small>
                    )}
                  </div>
                </div>

                <div className="admin-field">
                  <label>GEMINI_API_KEY (diawali “AIza…”, kosongkan bila tidak diubah)</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type={keyRevealed ? 'text' : 'password'}
                      value={keyDraft}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={
                        secret?.configured
                          ? secret.source === 'env'
                            ? 'Sedang memakai Environment Variable — isi di sini untuk menggantinya'
                            : '•••••••• tersimpan — isi hanya untuk mengganti'
                          : 'AIza...'
                      }
                      onChange={(e) => setKeyDraft(e.target.value)}
                    />
                    <button
                      type="button"
                      className="admin-btn admin-btn-sm"
                      onClick={() => setKeyRevealed((v) => !v)}
                      aria-label={keyRevealed ? 'Sembunyikan key' : 'Tampilkan key'}
                    >
                      {keyRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="admin-field">
                  <label>Model Gemini</label>
                  <select
                    value={draft.relay.aiModel || 'gemini-2.5-flash'}
                    onChange={(e) => updateDraft((d) => ({ ...d, relay: { ...d.relay, aiModel: e.target.value } }))}
                    style={{ maxWidth: 320 }}
                  >
                    <option value="gemini-2.5-flash">gemini-2.5-flash (cepat & hemat — rekomendasi)</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro (paling pintar)</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash (cadangan)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary admin-btn-sm"
                    disabled={!keyDraft.trim() || keyBusy !== ''}
                    onClick={() => secretRequest('put-secret', keyDraft.trim())}
                  >
                    {keyBusy === 'save' ? <LoaderCircle size={14} className="spin" /> : <KeyRound size={14} />}
                    Simpan &amp; Enkripsi Key
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm"
                    disabled={keyBusy !== ''}
                    onClick={() => secretRequest('test-secret')}
                  >
                    {keyBusy === 'test' ? <LoaderCircle size={14} className="spin" /> : <Zap size={14} />}
                    Test Koneksi
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm admin-btn-danger"
                    disabled={!secret?.configured || secret.source === 'env' || keyBusy !== ''}
                    onClick={() => secretRequest('delete-secret')}
                  >
                    <Trash2 size={13} />
                    Hapus Key
                  </button>
                </div>

                {keyMsg && <p style={{ color: '#8fd694', fontSize: 11.5, marginTop: 8, lineHeight: 1.6 }}>{keyMsg}</p>}
                {keyErr && <p style={{ color: '#f28b82', fontSize: 11.5, marginTop: 8, lineHeight: 1.6 }}>{keyErr}</p>}

                <p style={{ fontSize: 11, color: 'var(--quiet)', lineHeight: 1.75, marginTop: 12 }}>
                  <strong>Catatan:</strong> Environment Variable <code>GEMINI_API_KEY</code> di Vercel (bila ada)
                  selalu dipakai lebih dulu daripada key di sini. Tanpa key pun Relay tetap menjawab lewat basis
                  pengetahuan portofolio, dan bila API gagal/kuota habis Relay otomatis kembali ke mode tersebut
                  tanpa menampilkan error ke pengunjung.
                </p>
              </div>

              <div className="admin-card">
                <h3>Gelembung Chat Relay (Floating Bubble)</h3>
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 12 }}>
                  Widget AI melayang di pojok layar seperti <strong>NODATA•AI</strong>. Percakapan berbentuk
                  gelembung, bisa dibuka/tutup kapan saja di seluruh halaman website (otomatis disembunyikan di
                  halaman <code>/admin</code>).
                </p>
                <div className="admin-grid-3">
                  <div className="admin-field">
                    <label>Tampilkan Gelembung</label>
                    <select
                      value={draft.relay.bubble?.enabled === false ? 'no' : 'yes'}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          relay: { ...d.relay, bubble: { ...(d.relay.bubble as any), enabled: e.target.value === 'yes' } },
                        }))
                      }
                    >
                      <option value="yes">Ya — tampilkan</option>
                      <option value="no">Tidak — sembunyikan</option>
                    </select>
                  </div>
                  <div className="admin-field">
                    <label>Posisi</label>
                    <select
                      value={draft.relay.bubble?.position || 'right'}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          relay: {
                            ...d.relay,
                            bubble: { ...(d.relay.bubble as any), position: e.target.value === 'left' ? 'left' : 'right' },
                          },
                        }))
                      }
                    >
                      <option value="right">Kanan bawah</option>
                      <option value="left">Kiri bawah</option>
                    </select>
                  </div>
                  <div className="admin-field">
                    <label>Buka otomatis setelah (ms, 0 = nonaktif)</label>
                    <input
                      type="number"
                      min={0}
                      max={60000}
                      value={draft.relay.bubble?.autoOpenDelayMs ?? 0}
                      onChange={(e) =>
                        updateDraft((d) => ({
                          ...d,
                          relay: {
                            ...d.relay,
                            bubble: {
                              ...(d.relay.bubble as any),
                              autoOpenDelayMs: Math.max(0, Math.min(60000, Number(e.target.value) || 0)),
                            },
                          },
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="admin-field">
                  <label>Label Tombol Gelembung</label>
                  <input
                    value={draft.relay.bubble?.launcherLabel || ''}
                    onChange={(e) =>
                      updateDraft((d) => ({
                        ...d,
                        relay: { ...d.relay, bubble: { ...(d.relay.bubble as any), launcherLabel: e.target.value } },
                      }))
                    }
                    placeholder="Tanya Relay AI"
                  />
                </div>
                <div className="admin-field">
                  <label>Sapaan Awal di Dalam Gelembung</label>
                  <textarea
                    rows={2}
                    value={draft.relay.bubble?.greeting || ''}
                    onChange={(e) =>
                      updateDraft((d) => ({
                        ...d,
                        relay: { ...d.relay, bubble: { ...(d.relay.bubble as any), greeting: e.target.value } },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="admin-card">
                <h3>Engine AI Relay (Google Gemini)</h3>
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 10 }}>
                  Status engine saat ini:{' '}
                  <strong style={{ color: 'var(--ink)' }}>
                    {aiProvider === 'gemini'
                      ? `Gemini aktif${aiModel ? ` · ${aiModel}` : ''}`
                      : aiProvider === 'upstream'
                        ? `Provider LLM eksternal${aiModel ? ` · ${aiModel}` : ''}`
                        : aiProvider === 'webhook'
                          ? 'Webhook AI eksternal'
                          : 'Mode pengetahuan lokal (tanpa API key)'}
                  </strong>
                </p>
                <p style={{ fontSize: 11.5, color: 'var(--quiet)', lineHeight: 1.75 }}>
                  Alternatif pemasangan lewat Environment Variable server (bila lebih suka tidak menulis key di
                  panel ini):
                  <br />
                  1. Ambil key gratis di <strong>aistudio.google.com/apikey</strong>.
                  <br />
                  2. Vercel: <strong>Project → Settings → Environment Variables</strong> → tambah{' '}
                  <code>GEMINI_API_KEY</code> (dan opsional <code>GEMINI_MODEL</code>) → <strong>Redeploy</strong>.
                  <br />
                  3. Lokal: salin <code>.env.example</code> → <code>.env</code>, isi variabel yang sama, lalu{' '}
                  <code>npm run dev</code>.
                </p>
              </div>

              <div className="admin-card">
                <h3>Pengaturan Relay AI</h3>
                <div className="admin-field">
                  <label>Pengantar Seksi Relay</label>
                  <textarea
                    rows={2}
                    value={draft.relay.intro}
                    onChange={(e) => updateDraft((d) => ({ ...d, relay: { ...d.relay, intro: e.target.value } }))}
                  />
                </div>
                <div className="admin-field">
                  <label>Daftar Pertanyaan Cepat / Starter Prompts (Satu pertanyaan per baris)</label>
                  <textarea
                    rows={3}
                    value={draft.relay.prompts.join('\n')}
                    onChange={(e) =>
                      updateDraft((d) => ({
                        ...d,
                        relay: { ...d.relay, prompts: e.target.value.split('\n').filter((x) => x.trim()) },
                      }))
                    }
                  />
                </div>
                <div className="admin-field">
                  <label>Catatan Pengetahuan Tambahan untuk Relay AI (Opsional)</label>
                  <textarea
                    rows={3}
                    value={draft.relay.customKnowledge}
                    onChange={(e) => updateDraft((d) => ({ ...d, relay: { ...d.relay, customKnowledge: e.target.value } }))}
                    placeholder="Tambahkan informasi ekstra yang ingin diketahui oleh asisten AI Relay (misal ketersediaan freelance, tarif, jadwal, dll.)…"
                  />
                </div>
              </div>

              <div className="admin-card">
                <h3>07 — The Ethos (Kutipan &amp; Prinsip Utama)</h3>
                <div className="admin-grid-3">
                  <div className="admin-field">
                    <label>Kutipan Baris 1</label>
                    <input
                      value={draft.ethos.quoteLine1}
                      onChange={(e) => updateDraft((d) => ({ ...d, ethos: { ...d.ethos, quoteLine1: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Awalan Baris 2</label>
                    <input
                      value={draft.ethos.quotePrefix}
                      onChange={(e) => updateDraft((d) => ({ ...d, ethos: { ...d.ethos, quotePrefix: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Kata Penekanan Italic</label>
                    <input
                      value={draft.ethos.quoteItalic}
                      onChange={(e) => updateDraft((d) => ({ ...d, ethos: { ...d.ethos, quoteItalic: e.target.value } }))}
                    />
                  </div>
                </div>
                <div className="admin-field" style={{ marginTop: 12 }}>
                  <label>Paragraf Penjelasan Ethos</label>
                  <textarea
                    rows={3}
                    value={draft.ethos.body}
                    onChange={(e) => updateDraft((d) => ({ ...d, ethos: { ...d.ethos, body: e.target.value } }))}
                  />
                </div>
              </div>
            </>
          )}

          {/* TAB 8: CONTACTS, FOOTER & RATINGS MODERATION */}
          {tab === 'footer' && (
            <>
              <div className="admin-section-head">
                <div>
                  <h2>Kontak Sosial, Footer &amp; Moderasi Kesan Pengunjung</h2>
                  <p>Atur kanal media sosial, tautan kontak utama, serta kelola komentar yang masuk pada papan rating pengunjung.</p>
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() =>
                    updateDraft((d) => {
                      d.footer.socials.push({ name: 'Platform Baru', handle: '@username', url: 'https://' });
                      return d;
                    })
                  }
                >
                  <Plus size={15} />
                  Tambah Kanal Kontak
                </button>
              </div>

              <div className="admin-card">
                <h3>Daftar Kontak &amp; Media Sosial</h3>
                {draft.footer.socials.map((soc, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1.6fr auto',
                      gap: 10,
                      alignItems: 'center',
                      marginBottom: 10,
                    }}
                  >
                    <input
                      value={soc.name}
                      placeholder="Nama (misal: WhatsApp)"
                      onChange={(e) =>
                        updateDraft((d) => {
                          d.footer.socials[idx].name = e.target.value;
                          return d;
                        })
                      }
                      style={{ padding: '9px 11px', borderRadius: 7, border: '1px solid var(--line-strong)', background: 'var(--bg)', color: 'var(--ink)' }}
                    />
                    <input
                      value={soc.handle}
                      placeholder="Handle / Nomor"
                      onChange={(e) =>
                        updateDraft((d) => {
                          d.footer.socials[idx].handle = e.target.value;
                          return d;
                        })
                      }
                      style={{ padding: '9px 11px', borderRadius: 7, border: '1px solid var(--line-strong)', background: 'var(--bg)', color: 'var(--ink)' }}
                    />
                    <input
                      value={soc.url}
                      placeholder="https://..."
                      onChange={(e) =>
                        updateDraft((d) => {
                          d.footer.socials[idx].url = e.target.value;
                          return d;
                        })
                      }
                      style={{ padding: '9px 11px', borderRadius: 7, border: '1px solid var(--line-strong)', background: 'var(--bg)', color: 'var(--ink)' }}
                    />
                    <button
                      type="button"
                      className="admin-icon-btn"
                      disabled={draft.footer.socials.length <= 1}
                      onClick={() =>
                        updateDraft((d) => {
                          d.footer.socials.splice(idx, 1);
                          return d;
                        })
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}

                <div className="admin-grid-3" style={{ marginTop: 16 }}>
                  <div className="admin-field">
                    <label>URL Tombol Lingkaran Kontak Utama</label>
                    <input
                      value={draft.footer.primaryContactUrl}
                      onChange={(e) => updateDraft((d) => ({ ...d, footer: { ...d.footer, primaryContactUrl: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Nama Copyright</label>
                    <input
                      value={draft.footer.copyrightName}
                      onChange={(e) => updateDraft((d) => ({ ...d, footer: { ...d.footer, copyrightName: e.target.value } }))}
                    />
                  </div>
                  <div className="admin-field">
                    <label>Catatan Footer</label>
                    <input
                      value={draft.footer.copyrightNote}
                      onChange={(e) => updateDraft((d) => ({ ...d, footer: { ...d.footer, copyrightNote: e.target.value } }))}
                    />
                  </div>
                </div>
              </div>

              <div className="admin-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ margin: 0 }}>
                    Moderasi Kesan Pengunjung ({ratingStats.count} rating · Rata-rata {ratingStats.average.toFixed(1)} ★)
                  </h3>
                  <button type="button" className="admin-btn admin-btn-sm" onClick={() => void loadReviews()}>
                    Muat Ulang
                  </button>
                </div>

                {reviews.length === 0 ? (
                  <p style={{ color: 'var(--muted)', fontSize: 12.5 }}>Belum ada komentar pengunjung yang tersimpan.</p>
                ) : (
                  reviews.map((rev) => (
                    <div className="admin-review-row" key={rev.id}>
                      <div>
                        <strong>{rev.name}</strong>
                        <small>
                          {'★'.repeat(rev.stars)} · {new Date(rev.createdAt).toLocaleDateString('id-ID')}
                        </small>
                        {rev.comment && <p>{rev.comment}</p>}
                      </div>
                      <button
                        type="button"
                        className="admin-btn admin-btn-sm admin-btn-danger"
                        onClick={() => {
                          if (window.confirm(`Hapus komentar dari "${rev.name}"?`)) {
                            void deleteReview(rev.id);
                          }
                        }}
                      >
                        <Trash2 size={13} />
                        Hapus
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
