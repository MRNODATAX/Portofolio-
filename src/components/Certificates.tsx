import { useState } from 'react';
import { ArrowUpRight, Award, ShieldCheck } from 'lucide-react';
import { useSiteData } from '../context/SiteDataContext';
import type { CertificateItem } from '../types';
import { Chapter, ExternalLink, Modal } from './Primitives';

function CertificateArtwork({
  cert,
  index,
}: {
  cert: CertificateItem;
  index: number;
}) {
  const defaultFallback = `/images/certificates/cert-0${(index % 5) + 1}.svg`;
  const [failed, setFailed] = useState(false);
  const src = failed ? cert.fallbackImage || defaultFallback : cert.image || cert.fallbackImage || defaultFallback;

  return (
    <img
      src={src}
      alt={`Sertifikat ${cert.title} — ${cert.issuer}`}
      loading="lazy"
      width="800"
      height="520"
      onError={() => {
        if (!failed) setFailed(true);
      }}
    />
  );
}

export default function Certificates() {
  const { siteData } = useSiteData();
  const { certificates, identity } = siteData;
  const [active, setActive] = useState<{ item: CertificateItem; index: number } | null>(null);

  const items = certificates?.items || [];

  return (
    <section className="people certificates section-pad" id="certificates" aria-labelledby="certificates-title">
      <div className="wrap">
        <Chapter number="07">{certificates?.chapterTitle || 'CERTIFICATES & APPRECIATION'}</Chapter>
        <div className="section-heading">
          <h2 id="certificates-title">
            {certificates?.headingLine1 || 'Verified milestones.'}
            <br />
            <em>{certificates?.headingItalic || 'Sertifikat & apresiasi.'}</em>
          </h2>
          <p>
            {certificates?.intro ||
              'Koleksi sertifikat kompetensi dan apresiasi pelaporan keamanan etis (responsible disclosure) di bidang AI, cyber security, dan pengembangan aplikasi.'}
          </p>
        </div>

        <div
          className={`cert-gallery ${items.length === 5 ? 'cert-gallery-five' : ''}`}
          aria-label={`Daftar sertifikat dan apresiasi ${identity.name}`}
        >
          {items.map((cert, i) => (
            <button
              type="button"
              key={cert.id}
              className="cert-card"
              data-depth
              onClick={() => setActive({ item: cert, index: i })}
              aria-label={`Buka detail sertifikat ${cert.title}`}
            >
              <div className="cert-preview">
                <CertificateArtwork cert={cert} index={i} />
                <span className="cert-badge-pill">
                  {String(i + 1).padStart(2, '0')} / {cert.badge}
                </span>
                <span className="cert-open-icon" aria-hidden="true">
                  <ArrowUpRight size={16} />
                </span>
              </div>
              <div className="cert-card-body">
                <span className="cert-issuer">
                  {cert.issuer} • {cert.date}
                </span>
                <h3>
                  {cert.title}
                  <ArrowUpRight size={17} />
                </h3>
                <p>{cert.description}</p>
                <span className="cert-cta-label">
                  Lihat sertifikat
                  <ArrowUpRight size={14} />
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="community-heading">
          <h3>{certificates?.subHeading || 'Credential index.'}</h3>
          <span className="micro-note">
            {certificates?.subNote || 'AI • CYBER SECURITY (CSIRT) • ANDROID DEVELOPMENT'}
          </span>
        </div>

        <div className="communities">
          {items.map((cert, i) => {
            const isSecurity = /csirt|idor|sql|disclosure|vulnerability|report/i.test(`${cert.title} ${cert.badge}`);
            return (
              <details key={`${cert.id}-row`} className="community">
                <summary>
                  <span className="community-avatar cert-row-icon" aria-hidden="true">
                    {isSecurity ? <ShieldCheck size={20} /> : <Award size={20} />}
                  </span>
                  <span>
                    <strong>{cert.title}</strong>
                    <small>
                      {cert.issuer} • {cert.date}
                    </small>
                  </span>
                  <span className="details-plus">+</span>
                </summary>
                <div className="community-body">
                  <p>{cert.description}</p>
                  <div className="cert-row-actions">
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => setActive({ item: cert, index: i })}
                    >
                      Pratinjau sertifikat
                      <ArrowUpRight size={14} />
                    </button>
                    {(cert.credentialUrl || cert.image) && (
                      <ExternalLink href={cert.credentialUrl || cert.image} className="text-link">
                        Buka file sertifikat
                      </ExternalLink>
                    )}
                  </div>
                  <small>
                    Kategori: {cert.badge} • Diterbitkan untuk {identity.fullName} ({identity.name})
                  </small>
                </div>
              </details>
            );
          })}
        </div>

        {active && (
          <Modal
            label={`Sertifikat ${active.item.title}`}
            onClose={() => setActive(null)}
            className="certificate-modal"
          >
            <div className="cert-modal-frame">
              <CertificateArtwork cert={active.item} index={active.index} />
            </div>
            <p className="eyebrow">
              {String(active.index + 1).padStart(2, '0')} / {active.item.badge.toUpperCase()}
            </p>
            <h2>{active.item.title}</h2>
            <p className="cert-modal-issuer">
              {active.item.issuer} • <span>{active.item.date}</span>
            </p>
            <p className="cert-modal-desc">{active.item.description}</p>
            <div className="work-modal-actions">
              {(active.item.credentialUrl || active.item.image) && (
                <ExternalLink
                  href={active.item.credentialUrl || active.item.image}
                  className="button button-gold"
                >
                  Lihat Sertifikat Penuh
                </ExternalLink>
              )}
            </div>
          </Modal>
        )}
      </div>
    </section>
  );
}
