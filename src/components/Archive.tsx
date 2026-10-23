import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Search, X } from 'lucide-react';
import { categoryLabels, statusLabels } from '../data';
import { useSiteData } from '../context/SiteDataContext';
import type { Project } from '../types';
import { Chapter, ExternalLink, Modal } from './Primitives';
import { useWorkShelf } from '../hooks/useWorkShelf';

export function WorkCover({ work }: { work: Project }) {
  const [failed, setFailed] = useState(false);
  const src = work.image || `/components/works/${work.id}.svg`;
  const isSvg = src.endsWith('.svg') || src.startsWith('data:image/svg');

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed || !src) {
    return (
      <div className={`work-cover work-cover-generated cover-${work.id}`} data-spatial="project" data-project={work.id} role="img" aria-label={`Ilustrasi konsep ${work.name}`}>
        <div className="work-generated-blueprint">
          <span>{work.category}</span>
          <strong>{work.name}</strong>
          <small>{work.ecosystem.slice(0, 3).join(' · ') || 'Digital Archive'}</small>
        </div>
      </div>
    );
  }

  return (
    <div className={`work-cover cover-${work.id}`} data-spatial="project" data-project={work.id} role="img" aria-label={`Visual proyek ${work.name}`}>
      <img
        className={`spatial-fallback ${!isSvg && work.imageFit !== 'contain' ? 'work-cover-photo' : ''}`}
        src={src}
        width="820"
        height="500"
        style={!isSvg ? { objectFit: work.imageFit || 'cover', objectPosition: work.imageFocal || '50% 50%' } : undefined}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export default function Archive() {
  const { siteData } = useSiteData();
  const projects = siteData.archive.projects;

  const categories = useMemo(() => {
    const unique = Array.from(new Set(projects.map((p) => p.category).filter(Boolean)));
    return [{ id: 'all', name: 'Semua' }, ...unique.map((cat) => ({ id: cat, name: categoryLabels[cat] || cat }))];
  }, [projects]);

  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const { shelf, position, visiblePosition, move, moveBy, handlers } = useWorkShelf(`${filter}\u0000${query}\u0000${projects.length}`);
  const [active, setActive] = useState<Project | null>(null);

  useEffect(() => {
    if (filter !== 'all' && !categories.some((c) => c.id === filter)) {
      setFilter('all');
    }
  }, [categories, filter]);

  useEffect(() => {
    const sync = () => {
      if (location.hash.startsWith('#work-')) setActive(projects.find((p) => `#work-${p.id}` === location.hash) || null);
      else setActive(null);
    };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [projects]);

  const selection = projects.filter(
    (w) =>
      (filter === 'all' || w.category === filter) &&
      `${w.name} ${w.summary} ${w.description} ${w.ecosystem.join(' ')}`.toLowerCase().includes(query.toLowerCase())
  );
  const cursor = Math.max(0, Math.min(position, selection.length - 1));

  function open(work: Project) {
    const target = document.querySelector(`[data-project="${work.id}"]`)?.getBoundingClientRect();
    if (target) {
      document.documentElement.style.setProperty('--work-origin-x', `${target.left + target.width / 2 - innerWidth / 2}px`);
      document.documentElement.style.setProperty('--work-origin-y', `${target.top + target.height / 2 - innerHeight / 2}px`);
    }
    setActive(work);
    history.replaceState(null, '', `#work-${work.id}`);
  }
  function close() {
    setActive(null);
    history.replaceState(null, '', '#archive');
  }

  return (
    <section className="archive section-pad" id="archive" aria-labelledby="archive-title">
      <div className="wrap">
        <Chapter number="01">{siteData.archive.chapterTitle}</Chapter>
        <div className="section-heading">
          <h2 id="archive-title">
            {siteData.archive.headingLine1}
            <br />
            <em>{siteData.archive.headingItalic}</em>
          </h2>
          <div>
            <p>{siteData.archive.intro}</p>
            <span className="micro-note">{projects.length} ENTRIES / AN ONGOING EXPLORATION</span>
          </div>
        </div>
        <div className="archive-toolbar">
          <div className="filter-list" aria-label="Filter karya">
            {categories.map((c) => (
              <button key={c.id} onClick={() => setFilter(c.id)} aria-pressed={filter === c.id}>
                {c.name}
              </button>
            ))}
          </div>
          <label className="search-box">
            <Search size={16} />
            <span className="sr-only">Cari arsip</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari sebuah ide…" type="search" />
          </label>
        </div>
        <p className="sr-only" role="status">
          {selection.length} karya ditemukan
        </p>
        <div className="shelf-navigation">
          <span>DRAG / SWIPE TO EXPLORE</span>
          <div>
            <span aria-live="polite">
              {selection.length ? String(cursor + 1).padStart(2, '0') : '00'} <small>/ {String(selection.length).padStart(2, '0')}</small>
            </span>
            <button onClick={() => moveBy(-1)} disabled={cursor === 0} aria-label="Proyek sebelumnya">
              <ArrowLeft size={20} />
            </button>
            <button onClick={() => moveBy(1)} disabled={cursor >= selection.length - 1} aria-label="Proyek berikutnya">
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
        <div ref={shelf} className="works-shelf" {...handlers} tabIndex={0} role="region" aria-label={`Rak ${selection.length} proyek; geser atau gunakan tombol panah`}>
          {selection.map((work, i) => (
            <article className={`work-card ${visiblePosition === i ? 'shelf-current' : ''}`} key={work.id}>
              <button className="work-visual-button" onClick={() => open(work)} aria-label={`Baca cerita ${work.name}`}>
                <WorkCover work={work} />
                <span className="work-open">
                  <ArrowUpRight size={22} />
                </span>
              </button>
              <div className="work-meta">
                <span>
                  {String(i + 1).padStart(2, '0')} / {work.category}
                </span>
                <span>{statusLabels[work.status] || work.status}</span>
              </div>
              <button className="work-title" onClick={() => open(work)}>
                <h3>{work.name}</h3>
                <ArrowUpRight size={18} />
              </button>
              <p>{work.summary}</p>
            </article>
          ))}
        </div>
        {!selection.length && (
          <div className="empty-state">
            <Search size={30} />
            <h3>Belum ketemu.</h3>
            <p>Coba nama karya, teknologi, atau kata yang berbeda.</p>
            <button
              className="text-link"
              onClick={() => {
                setQuery('');
                setFilter('all');
              }}
            >
              Reset pencarian <X size={15} />
            </button>
          </div>
        )}
        {selection.length > 1 && (
          <div className="shelf-track">
            <input
              type="range"
              min="0"
              max={selection.length - 1}
              value={cursor}
              aria-label="Pilih posisi pada rak karya"
              aria-valuetext={`${selection[cursor]?.name}, ${cursor + 1} dari ${selection.length}`}
              onChange={(e) => move(Number(e.target.value), true)}
            />
            <span aria-hidden="true">{selection[cursor]?.name}</span>
          </div>
        )}
        <div className="archive-bottom">
          <span>Semua {projects.length} proyek tetap di arsip.</span>
          <span className="micro-note">BUKA COVER / DESKRIPSI &amp; STACK</span>
        </div>
        {active && (
          <Modal label={active.name} onClose={close} className="work-modal">
            <WorkCover work={active} />
            <p className="eyebrow">
              {active.category} · {statusLabels[active.status] || active.status}
            </p>
            <h2>{active.name}</h2>
            <p className="modal-summary">{active.description}</p>
            {(active.problem || active.exploration || active.outcome) && (
              <dl className="work-story">
                {active.problem && (
                  <div>
                    <dt>MASALAH &amp; KONTEKS</dt>
                    <dd>{active.problem}</dd>
                  </div>
                )}
                {active.exploration && (
                  <div>
                    <dt>PENDEKATAN &amp; EKSPLORASI</dt>
                    <dd>{active.exploration}</dd>
                  </div>
                )}
                {active.outcome && (
                  <div>
                    <dt>HASIL &amp; CATATAN</dt>
                    <dd>{active.outcome}</dd>
                  </div>
                )}
              </dl>
            )}
            <div className="tag-list" aria-label="Stack proyek">
              {active.ecosystem.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            {active.url && (
              <div className="work-modal-actions">
                <ExternalLink href={active.url} className="button button-gold">
                  Kunjungi proyek / repo
                </ExternalLink>
              </div>
            )}
          </Modal>
        )}
      </div>
    </section>
  );
}
