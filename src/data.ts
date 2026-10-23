import siteSeed from '../shared/site-data.json';
import type { Project, JourneyStep, EcosystemGroup, SiteData } from './types';

const seed = siteSeed as unknown as SiteData;

export const PROJECTS: Project[] = seed.archive.projects;
export const JOURNEY_STEPS: JourneyStep[] = seed.journey.steps;
export const ECOSYSTEM: EcosystemGroup[] = seed.ecosystem.groups;

export const statusLabels: Record<string, string> = {
  LIVE_VERIFIED: 'Demo terverifikasi',
  ONLINE_UNVERIFIED: 'Tautan proyek',
  ARCHIVED: 'Arsip',
  CONCEPT: 'Konsep',
  RECOVERED: 'Ditemukan kembali',
};

export const categoryLabels: Record<string, string> = {
  all: 'Semua',
  'AI Tools': 'AI & eksplorasi',
  Automation: 'Otomasi & Bot',
  Utilities: 'Tools',
  Productivity: 'Produktivitas',
  'Archive Experiments': 'Eksperimen',
};

export const PRESET_WORK_COVERS = [
  'repo-flow',
  'veritas',
  'finora-journey',
  'am-proaktif',
  'tierlist-maker',
  'anime-quote',
  'analisis-tanaman',
  'hd-upscale',
  'fake-loby-ml',
  'tugasku-pro',
  'tugasku-lite',
  'screenshot-web',
  'cek-kartu',
  'indosawit-news',
  'image-to-prompt',
  'quickfake',
  'soundify',
  'web-anime',
];
