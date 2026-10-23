import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useSiteData } from '../context/SiteDataContext';
import { Chapter } from './Primitives';
import ToolIcon from './ToolIcon';
import TechnologyStack from './TechnologyStack';

export default function Ecosystem({ paused }: { paused: boolean }) {
  const { siteData } = useSiteData();
  const groups = siteData.ecosystem.groups;
  const projects = siteData.archive.projects;

  const nodes = useMemo(
    () => groups.flatMap((g, groupIdx) => g.items.map((t) => ({ ...t, group: groupIdx }))),
    [groups]
  );

  const [group, setGroup] = useState(0);
  const [selected, select] = useState<string | null>(null);

  useEffect(() => {
    if (group >= groups.length) setGroup(0);
  }, [group, groups.length]);

  const tool = nodes.find((n) => n.name === selected);
  const related = tool ? projects.filter((p) => p.ecosystem.some((t) => t.toLowerCase() === tool.name.toLowerCase())) : [];
  const choose = (name: string, index: number) => {
    select((current) => (current === name ? null : name));
    setGroup(index);
  };

  if (!groups.length) return null;
  const activeGroup = groups[group] || groups[0];

  return (
    <section className="ecosystem section-pad" id="ecosystem" aria-labelledby="ecosystem-title">
      <div className="wrap">
        <Chapter number="04">{siteData.ecosystem.chapterTitle}</Chapter>
        <div className="section-heading">
          <h2 id="ecosystem-title">
            {siteData.ecosystem.headingLine1}
            <br />
            <em>{siteData.ecosystem.headingItalic}</em>
          </h2>
          <p>{siteData.ecosystem.intro}</p>
        </div>
        <div className="ecosystem-layout">
          <TechnologyStack paused={paused} />
          <div className="ecosystem-panel">
            <div className="ecosystem-tabs" role="tablist" aria-label="Kelompok teknologi">
              {groups.map((g, i) => (
                <button
                  key={`${g.category}-${i}`}
                  id={`group-tab-${i}`}
                  role="tab"
                  aria-selected={group === i}
                  aria-controls="tool-panel"
                  tabIndex={group === i ? 0 : -1}
                  onClick={() => {
                    setGroup(i);
                    select(null);
                  }}
                  onKeyDown={(e) => {
                    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                      e.preventDefault();
                      const len = groups.length;
                      const n = e.key === 'Home' ? 0 : e.key === 'End' ? len - 1 : (i + (e.key === 'ArrowLeft' ? len - 1 : 1)) % len;
                      setGroup(n);
                      select(null);
                      document.getElementById(`group-tab-${n}`)?.focus();
                    }
                  }}
                >
                  {g.category}
                </button>
              ))}
            </div>
            {tool && groups[tool.group] && (
              <div className="tool-focus" key={tool.name} aria-live="polite">
                <ToolIcon name={tool.name} iconUrl={tool.iconUrl} />
                <div>
                  <span className="eyebrow">SELECTED / {groups[tool.group].category}</span>
                  <h3>{tool.name}</h3>
                  <p>{tool.description}</p>
                  {related.length > 0 && (
                    <div className="tool-projects">
                      <small>TERCATAT DI ARSIP</small>
                      {related.map((p) => (
                        <a key={p.id} href={`#work-${p.id}`}>
                          {p.name}
                          <ArrowUpRight size={12} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="tool-list" id="tool-panel" role="tabpanel" aria-labelledby={`group-tab-${group}`}>
              {activeGroup.items.map((t) => (
                <button
                  className={`tool-row ${selected === t.name ? 'tool-row-selected' : ''}`}
                  key={t.name}
                  onClick={() => choose(t.name, group)}
                >
                  <span className="tool-glyph">
                    <ToolIcon name={t.name} iconUrl={t.iconUrl} />
                  </span>
                  <span>
                    <h3>{t.name}</h3>
                    <p>{t.description}</p>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
            <p className="ecosystem-caption">
              {groups.length} kategori · {nodes.length} tools. Pilih ikon untuk melihat perannya.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
