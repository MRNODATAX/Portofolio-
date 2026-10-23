import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Menu, Braces, Cpu, Lock, Pause, Play, Sun, Moon, LoaderCircle } from 'lucide-react';
import { useSiteData } from './context/SiteDataContext';
import { Chapter, ExternalLink, Mark, Modal } from './components/Primitives';
import Scene from './components/Scene';
import ToolOrbit from './components/ToolOrbit';
import RelayMark from './components/RelayMark';
import Ratings from './components/Ratings';
import Archive from './components/Archive';
import Ecosystem from './components/Ecosystem';
import Journey from './components/Journey';
import SplashScreen from './components/SplashScreen';
import AiSandbox from './components/AiSandbox';
import Certificates from './components/Certificates';
import Personal from './components/Personal';
import { useMotion } from './hooks/useMotion';
import { useExperience } from './hooks/useExperience';
import { useTheme } from './hooks/useTheme';

const AdminStudio = lazy(() => import('./admin/AdminStudio'));

const links = [
  { id: 'home', name: 'Home' },
  { id: 'about', name: 'About' },
  { id: 'archive', name: 'Work' },
  { id: 'journey', name: 'Journey' },
  { id: 'ecosystem', name: 'Tools' },
  { id: 'universe', name: 'Waifu' },
  { id: 'lab', name: 'Relay' },
  { id: 'certificates', name: 'Sertifikat' },
  { id: 'ethos', name: 'Ethos' },
  { id: 'rating', name: 'Kesan' },
  { id: 'contact', name: 'Contact' },
];

function checkIsAdminRoute() {
  if (typeof window === 'undefined') return false;
  return window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/') || window.location.hash === '#admin';
}

export default function App() {
  const { siteData } = useSiteData();
  const { identity, about, archive, ecosystem, ethos, footer } = siteData;

  const [isAdmin, setIsAdmin] = useState(checkIsAdminRoute);
  const reduced = useMotion();
  const [motionPaused, setMotionPaused] = useState(false);
  const { theme, toggle } = useTheme();
  const [menu, setMenu] = useState(false);
  const [current, setCurrent] = useState('home');
  const still = reduced || motionPaused;

  useExperience(!still && !isAdmin);

  useEffect(() => {
    const syncRoute = () => setIsAdmin(checkIsAdminRoute());
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  function openAdmin(e?: React.MouseEvent) {
    e?.preventDefault();
    setMenu(false);
    document.documentElement.removeAttribute('data-intro');
    window.history.pushState(null, '', '/admin');
    setIsAdmin(true);
    window.scrollTo(0, 0);
  }

  function exitAdmin() {
    window.history.pushState(null, '', '/');
    setIsAdmin(false);
    window.scrollTo(0, 0);
  }

  useEffect(() => {
    if (isAdmin) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setCurrent(e.target.id);
            document.documentElement.dataset.chapter = e.target.id;
          }
        });
      },
      { rootMargin: '-15% 0px -60% 0px' }
    );
    document.querySelectorAll('main section[id],footer[id]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [isAdmin]);

  if (isAdmin) {
    return (
      <Suspense
        fallback={
          <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--bg)', color: 'var(--ink)' }}>
            <LoaderCircle size={28} className="spin" />
          </div>
        }
      >
        <AdminStudio onExit={exitAdmin} />
      </Suspense>
    );
  }

  const totalTools = ecosystem.groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <SplashScreen />
      <a className="skip-link" href="#main">
        Lewati ke konten
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a href="#home" className="brand" aria-label={`${identity.name}, kembali ke awal`}>
            <Mark />
            <span>{identity.name}</span>
          </a>
          <nav className="desktop-nav" aria-label="Navigasi utama">
            {links
              .filter((l) => ['home', 'about', 'archive', 'certificates', 'universe', 'contact'].includes(l.id))
              .map((l) => (
                <a
                  className={current === l.id ? 'nav-active' : ''}
                  href={`#${l.id}`}
                  key={l.id}
                  aria-current={current === l.id ? 'location' : undefined}
                >
                  {l.name}
                </a>
              ))}
          </nav>
          <div className="header-actions">
            <button
              className="theme-toggle"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Aktifkan light mode' : 'Aktifkan dark mode'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="global-motion"
              aria-label={motionPaused ? 'Aktifkan animasi halaman' : 'Jeda animasi halaman'}
              aria-pressed={motionPaused}
              onClick={() => setMotionPaused((x) => !x)}
            >
              {motionPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>
            <button
              className="menu-button"
              onClick={() => setMenu(true)}
              aria-label="Buka menu navigasi"
              aria-expanded={menu}
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      {menu && (
        <Modal label="Menu navigasi" onClose={() => setMenu(false)} className="navigation-modal">
          <p className="eyebrow">{identity.name.toUpperCase()} / EXPLORE THE ARCHIVE</p>
          <nav aria-label="Semua bagian">
            {links.map((l, i) => (
              <a key={l.id} href={`#${l.id}`} onClick={() => setMenu(false)}>
                <span>{String(i + 1).padStart(2, '0')}</span>
                {l.name}
                <ArrowUpRight size={22} />
              </a>
            ))}
            <a href="/admin" onClick={openAdmin}>
              <span>{String(links.length + 1).padStart(2, '0')}</span>
              Admin Studio
              <Lock size={18} />
            </a>
          </nav>
        </Modal>
      )}

      <main id="main">
        <div className="opening-sequence">
          <section className="hero" id="home" aria-labelledby="hero-title">
            <div className="hero-room" aria-hidden="true">
              <span className="hero-light-streak" />
              <span className="hero-light-streak streak-second" />
            </div>
            <div className="wrap hero-grid">
              <div className="hero-copy">
                <p className="hero-eyebrow">
                  <span className="tiny-square" aria-hidden="true" />
                  {identity.heroEyebrow}
                </p>
                <h1 id="hero-title">
                  {identity.heroTitleLine1}
                  <br />
                  <em>{identity.heroTitleItalic}</em>
                </h1>
                <p className="hero-description">{identity.heroDescription}</p>
                <div className="hero-cta">
                  <a className="button button-gold" href="#archive">
                    Jelajahi karya
                    <ArrowRight size={16} />
                  </a>
                  <a href="#journey" className="text-link">
                    Baca perjalanan
                    <ArrowRight size={16} />
                  </a>
                </div>
                <div className="hero-inventory" aria-label="Isi portofolio">
                  <a href="#archive">
                    <strong>{archive.projects.length}</strong>
                    <span>Karya &amp; eksperimen</span>
                  </a>
                  <a href="#ecosystem">
                    <strong>{totalTools}</strong>
                    <span>Tools yang dipakai</span>
                  </a>
                  <a href="#journey">
                    <strong aria-hidden="true">∞</strong>
                    <span>
                      Terus berkembang
                      <span className="sr-only">, perjalanan yang terus berlanjut</span>
                    </span>
                  </a>
                </div>
                <div className="hero-identity">
                  <span className="identity-line" />
                  <div>
                    <strong>{identity.heroIdentityHeading}</strong>
                    <span>{identity.heroIdentitySub}</span>
                  </div>
                </div>
              </div>
              <div className="hero-object">
                <Scene paused={still} />
              </div>
              <div className="hero-universe">
                <ToolOrbit compact paused={still} />
                <p className="hero-universe-note">
                  Different tools.
                  <br />
                  Same curiosity.
                </p>
              </div>
              <a className="scroll-note" href="#archive">
                <ArrowDown size={14} />
                <span>EXPLORE AT YOUR OWN PACE</span>
              </a>
              <span className="hero-corner">{identity.heroCorner}</span>
            </div>
          </section>
          <Archive />
        </div>

        <section className="about section-pad" id="about" aria-labelledby="about-title">
          <div className="wrap about-grid">
            <div>
              <Chapter number="02">{about.chapterTitle}</Chapter>
              <h2 id="about-title">
                {about.headingLine1}
                <br />
                <em>{about.headingItalic}</em>
              </h2>
              <span className="about-signature">{identity.signature}</span>
              <div className="about-values">
                <span>
                  <Cpu size={18} />
                  {about.values[0] || 'Hardware & OS roots'}
                </span>
                <span>
                  <Braces size={18} />
                  {about.values[1] || 'Research-first build'}
                </span>
                <span>
                  <RelayMark />
                  {about.values[2] || 'Human × AI'}
                </span>
              </div>
            </div>
            <div className="about-copy">
              <p className="lead">{about.lead}</p>
              <p>{about.motivation}</p>
              <p>{about.approach}</p>
            </div>
          </div>
        </section>

        <Journey />
        <Ecosystem paused={still} />
        <Personal />
        <AiSandbox />
        <Certificates />

        <section className="ethos section-pad" id="ethos" aria-labelledby="ethos-title">
          <div className="wrap">
            <Chapter number="08">{ethos.chapterTitle}</Chapter>
            <p className="eyebrow" id="ethos-title">
              {ethos.eyebrow}
            </p>
            <blockquote>
              “{ethos.quoteLine1}
              <br />
              {ethos.quotePrefix} <em>{ethos.quoteItalic}</em>”
            </blockquote>
            <div className="ethos-bottom">
              <span className="about-signature">{identity.signature}</span>
              <p>{ethos.body}</p>
            </div>
          </div>
        </section>

        <Ratings paused={still} />

        <footer className="footer section-pad" id="contact">
          <div className="wrap">
            <p className="eyebrow">{footer.eyebrow}</p>
            <div className="footer-heading">
              <h2>
                {footer.headingLine1}
                <br />
                <em>{footer.headingItalic}</em>
              </h2>
              <a
                href={footer.primaryContactUrl || footer.socials[0]?.url || '#contact'}
                className="contact-circle"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Hubungi ${identity.name}`}
              >
                <ArrowUpRight size={34} />
              </a>
            </div>
            <div className="footer-socials">
              {footer.socials.map((s) => (
                <ExternalLink href={s.url} key={s.name}>
                  <span>{s.name}</span>
                  <small>{s.handle}</small>
                </ExternalLink>
              ))}
            </div>
            <div className="footer-bottom">
              <a href="#home" className="brand">
                <Mark />
                <span>{identity.name}</span>
              </a>
              <p>
                © {new Date().getFullYear()} {footer.copyrightName}
                <br />
                {footer.copyrightNote}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <a href="/admin" onClick={openAdmin} className="footer-admin-link">
                  <Lock size={12} />
                  Admin
                </a>
                <a href="#home" className="back-top">
                  Kembali ke awal
                  <ArrowUpRight size={16} />
                </a>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
