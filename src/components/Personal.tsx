import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useSiteData } from '../context/SiteDataContext';
import type { AnimeCharacter } from '../types';
import { Chapter, Modal } from './Primitives';
import VideoPlayer from './VideoPlayer';

export default function Personal() {
  const { siteData } = useSiteData();
  const { personal, identity } = siteData;
  const [active, setActive] = useState<AnimeCharacter | null>(null);
  const royalLines = (personal.royal?.caption || '').split('\n');

  return (
    <section className="personal section-pad" id="universe" aria-labelledby="universe-title">
      <div className="wrap">
        <Chapter number="05">{personal.chapterTitle}</Chapter>
        <div className="section-heading">
          <h2 id="universe-title">
            {personal.headingLine1}
            <br />
            <em>{personal.headingItalic}</em>
          </h2>
          <p>{personal.intro}</p>
        </div>
        <div className="anime-gallery" aria-label={`Karakter favorit ${identity.name}`}>
          {personal.anime.map((a, i) => (
            <button
              className={`anime-card anime-${a.id}`}
              data-depth
              key={a.id}
              onClick={() => setActive(a)}
              aria-label={`Tentang ${a.name}`}
            >
              <div className="anime-portrait">
                <img
                  src={a.image}
                  alt={a.name}
                  loading="lazy"
                  width="600"
                  height="900"
                  style={{ objectPosition: a.focal || '50% 20%' }}
                />
                <span className="anime-number">
                  {String(i + 1).padStart(2, '0')} / {i === 0 ? 'THE FAVORITE' : a.label}
                </span>
              </div>
              <div className="anime-label">
                <span>{a.label}</span>
                <h3>
                  {a.name}
                  <ArrowUpRight size={18} />
                </h3>
                <p>{a.note}</p>
              </div>
            </button>
          ))}
        </div>
        <VideoPlayer />
        {personal.royal?.image && (
          <figure className="royal-scene">
            <div className="royal-art">
              <img
                src={personal.royal.image}
                alt={`${personal.royal.titleFirst} ${personal.royal.titleAmp} ${personal.royal.titleSecond}`}
                width="736"
                height="981"
                loading="lazy"
              />
            </div>
            <figcaption>
              <span className="eyebrow">{personal.royal.eyebrow}</span>
              <h3>
                {personal.royal.titleFirst} <em>{personal.royal.titleAmp}</em> {personal.royal.titleSecond}
              </h3>
              <p>
                {royalLines.map((line, idx) => (
                  <span key={idx}>
                    {idx > 0 && <br />}
                    {line}
                  </span>
                ))}
              </p>
            </figcaption>
            <span className="royal-frame" aria-hidden="true" />
          </figure>
        )}
        {active && (
          <Modal label={active.name} onClose={() => setActive(null)} className="anime-modal">
            <img src={active.image} alt={active.name} width="600" height="900" />
            <div>
              <p className="eyebrow">{active.origin}</p>
              <h2>{active.name}</h2>
              <p>{active.note}</p>
            </div>
          </Modal>
        )}
      </div>
    </section>
  );
}
