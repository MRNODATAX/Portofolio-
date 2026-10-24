export type WorkStatus = 'LIVE_VERIFIED' | 'ONLINE_UNVERIFIED' | 'ARCHIVED' | 'CONCEPT' | 'RECOVERED';

export interface Project {
  id: string;
  name: string;
  category: string;
  url: string;
  image?: string;
  imageFit?: 'cover' | 'contain';
  imageFocal?: string;
  description: string;
  summary: string;
  problem: string;
  exploration: string;
  outcome: string;
  ecosystem: string[];
  status: WorkStatus;
  type: 'work' | 'experiment' | 'prototype';
  visualType: 'real' | 'illustrative' | 'placeholder';
}

export interface JourneyStep {
  phase: string;
  title: string;
  subtitle: string;
  description: string;
  techKeywords: string[];
  environment?: {
    device?: string;
    laptop?: string;
    learning?: string;
  };
}

export interface EcosystemItem {
  name: string;
  description: string;
  iconName: string;
  iconUrl?: string;
}

export interface EcosystemGroup {
  category: string;
  items: EcosystemItem[];
}

export interface TechStackNode {
  name: string;
  icon: string | null;
  role: string;
  detail: string;
}

export interface AnimeCharacter {
  id: string;
  name: string;
  origin: string;
  label: string;
  note: string;
  image: string;
  focal?: string;
  source?: string;
  color?: string;
}

export interface SocialLink {
  name: string;
  handle: string;
  url: string;
}

export interface CertificateItem {
  id: string;
  title: string;
  issuer: string;
  date: string;
  badge: string;
  description: string;
  image: string;
  fallbackImage?: string;
  credentialUrl?: string;
}

export interface HeroStackCard {
  id: string;
  title: string;
  caption: string;
  image: string;
  focal: string;
}

export interface SiteData {
  identity: {
    name: string;
    fullName: string;
    brand: string;
    role: string;
    education: string;
    location: string;
    markImage: string;
    portraitImage: string;
    portraitFocal: string;
    heroEyebrow: string;
    heroTitleLine1: string;
    heroTitleItalic: string;
    heroDescription: string;
    heroIdentityHeading: string;
    heroIdentitySub: string;
    heroCorner: string;
    heroExploringLabel: string;
    heroExploringText: string;
    heroLocationLabel: string;
    heroLocationSub: string;
    signature: string;
    heroStack: {
      portraitCaption: string;
      workTitle: string;
      workCaption: string;
      workImage: string;
      personalCaption: string;
    };
    heroCards: HeroStackCard[];
  };
  about: {
    chapterTitle: string;
    headingLine1: string;
    headingItalic: string;
    values: string[];
    lead: string;
    motivation: string;
    approach: string;
  };
  archive: {
    chapterTitle: string;
    headingLine1: string;
    headingItalic: string;
    intro: string;
    projects: Project[];
  };
  journey: {
    chapterTitle: string;
    headingLine1: string;
    headingItalic: string;
    intro: string;
    deviceNote: string;
    terminalLines: string[];
    steps: JourneyStep[];
  };
  ecosystem: {
    chapterTitle: string;
    headingLine1: string;
    headingItalic: string;
    intro: string;
    githubUrl: string;
    githubLabel: string;
    stack: TechStackNode[];
    groups: EcosystemGroup[];
  };
  personal: {
    chapterTitle: string;
    headingLine1: string;
    headingItalic: string;
    intro: string;
    anime: AnimeCharacter[];
    video: {
      url: string;
      poster: string;
      rotation: number;
      fit?: 'cover' | 'contain';
      title: string;
    };
    royal: {
      eyebrow: string;
      titleFirst: string;
      titleAmp: string;
      titleSecond: string;
      caption: string;
      image: string;
    };
  };
  sound: {
    enabled: boolean;
    url: string;
    title: string;
    label: string;
    volume: number;
    autoStart: boolean;
    pauseVideo: boolean;
  };
  relay: {
    chapterTitle: string;
    headingLine1: string;
    headingItalic: string;
    intro: string;
    welcomeTitle: string;
    welcomeSub: string;
    prompts: string[];
    customKnowledge: string;
    aiModel?: string;
    bubble?: {
      enabled: boolean;
      position: 'left' | 'right';
      launcherLabel: string;
      greeting: string;
      autoOpenDelayMs: number;
    };
  };
  certificates: {
    chapterTitle: string;
    headingLine1: string;
    headingItalic: string;
    intro: string;
    subHeading?: string;
    subNote?: string;
    items: CertificateItem[];
  };
  ethos: {
    chapterTitle: string;
    eyebrow: string;
    quoteLine1: string;
    quotePrefix: string;
    quoteItalic: string;
    body: string;
  };
  footer: {
    eyebrow: string;
    headingLine1: string;
    headingItalic: string;
    primaryContactUrl: string;
    copyrightName: string;
    copyrightNote: string;
    socials: SocialLink[];
  };
}
