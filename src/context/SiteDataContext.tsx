import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import initialSeed from '../../shared/site-data.json';
import type { SiteData } from '../types';

interface SiteDataContextValue {
  siteData: SiteData;
  setSiteData: (next: SiteData) => void;
  refreshSiteData: () => Promise<void>;
  storageMode: string;
}

const DEFAULT_DATA = initialSeed as unknown as SiteData;

const SiteDataContext = createContext<SiteDataContextValue>({
  siteData: DEFAULT_DATA,
  setSiteData: () => {},
  refreshSiteData: async () => {},
  storageMode: 'filesystem',
});

export function SiteDataProvider({ children }: { children: ReactNode }) {
  const [siteData, setSiteData] = useState<SiteData>(DEFAULT_DATA);
  const [storageMode, setStorageMode] = useState<string>('filesystem');

  async function refreshSiteData() {
    // Penanda global: dipakai layer Swarm supaya ia mengukur halaman SETELAH
    // data (dan font) final, bukan saat teks masih versi bawaan.
    const tandaiSiap = () => document.documentElement.setAttribute('data-content', 'ready');
    try {
      const res = await fetch('/api/content', { cache: 'no-store' });
      if (!res.ok) return;
      const body = await res.json();
      if (body?.ok && body?.data) {
        const incoming = body.data as SiteData;
        if (!incoming.certificates || !Array.isArray(incoming.certificates.items)) {
          incoming.certificates = structuredClone(DEFAULT_DATA.certificates);
        }
        if (!Array.isArray(incoming.identity?.heroCards)) {
          incoming.identity.heroCards = structuredClone(DEFAULT_DATA.identity.heroCards);
        }
        if (!incoming.personal?.video) {
          incoming.personal.video = structuredClone(DEFAULT_DATA.personal.video);
        }
        // Data yang tersimpan sebelum Fase 2 belum punya blok `swarm`.
        if (!incoming.swarm || typeof incoming.swarm !== 'object') {
          incoming.swarm = structuredClone(DEFAULT_DATA.swarm);
        }
        setSiteData(incoming);
        if (body.storageMode) setStorageMode(body.storageMode);
        tandaiSiap();
      }
    } catch {
      // Keep bundled seed if offline
    } finally {
      tandaiSiap();
    }
  }

  useEffect(() => {
    void refreshSiteData();
  }, []);

  return (
    <SiteDataContext.Provider value={{ siteData, setSiteData, refreshSiteData, storageMode }}>
      {children}
    </SiteDataContext.Provider>
  );
}

export function useSiteData() {
  return useContext(SiteDataContext);
}

export const INITIAL_SITE_DATA = DEFAULT_DATA;
