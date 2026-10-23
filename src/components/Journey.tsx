import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowRight, Terminal } from 'lucide-react';
import { useSiteData } from '../context/SiteDataContext';
import { Chapter } from './Primitives';

export default function Journey() {
  const { siteData } = useSiteData();
  const { journey, identity } = siteData;
  const steps = journey.steps;
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (phase >= steps.length) setPhase(Math.max(0, steps.length - 1));
  }, [phase, steps.length]);

  const current = steps[phase] || steps[0];
  if (!current) return null;

  const introLines = (journey.intro || '').split('\n');
  const codeLines = journey.terminalLines?.length
    ? journey.terminalLines
    : ['const growth = true;', 'while (growth) {', '  research();', '  build();', '  automate();', '}'];

  return (
    <section className="journey section-pad" id="journey" aria-labelledby="journey-title">
      <div className="wrap">
        <Chapter number="03">{journey.chapterTitle || `THE EVOLUTION / ${steps.length} CHAPTERS`}</Chapter>
        <div className="section-heading">
          <h2 id="journey-title">
            {journey.headingLine1}
            <br />
            <em>{journey.headingItalic}</em>
          </h2>
          <p>
            {introLines.map((line, idx) => (
              <span key={idx}>
                {idx > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
        </div>
        <div className="journey-layout">
          <aside className="journey-art">
            <div className="journey-workspace" data-phase={phase % 6}>
              <div className="journey-platform" aria-hidden="true" />
              <div className="journey-phone">
                <div className="phone-edge" />
                <div className="phone-screen">
                  <div className="phone-status">
                    <span>{identity.name.toUpperCase()}</span>
                    <span>● ● ▰</span>
                  </div>
                  <div className="phone-camera" />
                  <div className="phone-terminal" key={phase}>
                    <Terminal size={23} />
                    <span className="phone-terminal-label">chapter / {String(phase + 1).padStart(2, '0')}</span>
                    <strong>{current.phase.split('—')[1]?.trim() || current.phase}</strong>
                    <div className="phone-code">
                      {codeLines.map((line, idx) =>
                        line.startsWith('  ') ? <b key={idx}>{line}</b> : <span key={idx}>{line}</span>
                      )}
                    </div>
                    <small>{current.techKeywords[0] || 'Milestone'}</small>
                  </div>
                  <span className="phone-home" />
                </div>
              </div>
              <div className="journey-modules" aria-label="Modul perjalanan interaktif">
                {steps.slice(0, 6).map((j, i) => (
                  <button
                    type="button"
                    onClick={() => setPhase(i)}
                    aria-label={`Buka fase ${i + 1}: ${j.title}`}
                    aria-pressed={phase === i}
                    key={`${j.phase}-${i}`}
                    className={`journey-module ${phase === i ? 'module-active' : ''}`}
                    style={{ '--module-index': i } as CSSProperties}
                  >
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <strong>{j.techKeywords[0] || `Chapter ${i + 1}`}</strong>
                    <i aria-hidden="true" />
                  </button>
                ))}
              </div>
              <div className="journey-signal" key={phase} aria-hidden="true" />
            </div>
            <div className="journey-route" aria-label="Pilih fase perjalanan">
              {steps.map((j, i) => (
                <button key={`${j.phase}-${i}`} onClick={() => setPhase(i)} aria-label={`Fase ${i + 1}: ${j.title}`} aria-pressed={phase === i}>
                  {String(i + 1).padStart(2, '0')}
                </button>
              ))}
            </div>
            <div className="journey-device-note">
              <span>{journey.deviceNote || 'LAPTOP & OS / AWAL 2025'}</span>
              <a className="text-link" href={phase < 3 ? '#ecosystem' : '#archive'}>
                {phase < 3 ? 'Jelajahi tools yang dipakai' : 'Lihat arsip karya'}
                <ArrowRight size={15} />
              </a>
            </div>
          </aside>
          <div className="journey-timeline">
            {steps.map((j, i) => (
              <details key={`${j.phase}-${i}`} className={`journey-step ${phase === i ? 'journey-selected' : ''}`} open={phase === i}>
                <summary
                  onClick={(e) => {
                    e.preventDefault();
                    setPhase(i);
                  }}
                >
                  <span className="phase-number">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <small>{j.phase.split('—')[1]?.trim() || j.phase}</small>
                    <h3>{j.title}</h3>
                  </span>
                  <span className="details-plus">+</span>
                </summary>
                <div className="journey-details">
                  <p className="journey-subtitle">{j.subtitle}</p>
                  <p>{j.description}</p>
                  <div className="tag-list">
                    {j.techKeywords.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  {j.environment && (
                    <p className="device-note">
                      Fondasi kerja: {j.environment.device}
                      {j.environment.learning ? ` · ${j.environment.learning}` : ''}
                    </p>
                  )}
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
