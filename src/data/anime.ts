import siteSeed from '../../shared/site-data.json';
import type { SiteData } from '../types';

const seed = siteSeed as unknown as SiteData;
export const ANIME = seed.personal.anime;
export const VIDEO = seed.personal.video;
