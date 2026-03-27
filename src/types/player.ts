/**
 * Card type classification in FC Online.
 * - BASE: Standard base card (e.g., default season card)
 * - SPECIAL: Promotional/event special cards (e.g., TOTNUCL, HOT, ROADTOFINAL)
 * - ICON: Legend/icon cards representing historical greats
 * - LIVE: Dynamic live cards that update based on real-world performance
 * - MOM: Man of the Match cards
 * - POTW: Player of the Week cards
 */
export type CardType = 'BASE' | 'SPECIAL' | 'ICON' | 'LIVE' | 'MOM' | 'POTW';

/**
 * Season metadata describing a specific card release/season in FC Online.
 * Each season represents a distinct card version available for players.
 */
export interface Season {
  /** Numeric season ID from Nexon API (e.g., 67, 68, 69) */
  id: number;
  /** URL-friendly slug for routing/UI (e.g., 'totnucl-2425', 'icon') */
  slug: string;
  /** Display name in Korean (e.g., 'TOTNUCL (24/25)') */
  name: string;
  /** Display name in English (e.g., 'Team of the Tournament NUCL 24/25') */
  nameEn: string;
  /** Card type classification */
  cardType: CardType;
  /** Season year/period string (e.g., '24/25', '23/24') */
  seasonYear: string;
  /** ISO date string for when this season was first released */
  releaseDate: string;
}

export interface Player {
  /** FC Online season-specific player ID (e.g., 101001101) — unique per card version */
  spid: number;
  /** Base player ID shared across all card versions (e.g., 101001) */
  pid: number;
  name: string;
  nameEn: string;
  /** Numeric season ID referencing the Season.id (e.g., 68=TOTNUCL 24/25) */
  seasonId: number;
  /** Season display name (e.g., 'TOTNUCL (24/25)') */
  seasonName: string;
  /** URL-friendly season slug (e.g., 'totnucl-2425') */
  seasonSlug: string;
  /** Card type classification (e.g., 'SPECIAL', 'ICON') */
  cardType: CardType;
  /** Season year/period (e.g., '24/25') */
  seasonYear: string;
  /** ISO date string for when this specific card version was released */
  releaseDate: string;
  position: Position;
  teamId: number;
  teamName: string;
  teamNameEn: string;
  leagueId: number;
  leagueName: string;
  stats: PlayerStats;
  /** Detailed raw stats from FC Online (Korean stat names). */
  raw?: PlayerRawStats;
  price: number;
  priceUpdatedAt: string;
}

export interface PlayerStats {
  ovr: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
}

/** Raw detailed stats from FC Online API (Korean key names). */
export interface PlayerRawStats {
  속력: number;
  가속력: number;
  '골 결정력': number;
  '슛 파워': number;
  '중거리 슛': number;
  '위치 선정': number;
  발리슛: number;
  '페널티 킥': number;
  '짧은 패스': number;
  시야: number;
  크로스: number;
  '긴 패스': number;
  프리킥: number;
  커브: number;
  드리블: number;
  '볼 컨트롤': number;
  민첩성: number;
  밸런스: number;
  '반응 속도': number;
  '대인 수비': number;
  태클: number;
  가로채기: number;
  헤더: number;
  '슬라이딩 태클': number;
  몸싸움: number;
  스태미너: number;
  적극성: number;
  점프: number;
  침착성: number;
  'GK 다이빙': number;
  'GK 핸들링': number;
  'GK 킥': number;
  'GK 반응속도': number;
  'GK 위치 선정': number;
}

export type Position =
  | 'ST' | 'CF' | 'LF' | 'RF' | 'LW' | 'RW' | 'CAM' | 'CM'
  | 'CDM' | 'LM' | 'RM' | 'LB' | 'RB' | 'CB' | 'LWB' | 'RWB'
  | 'GK';

export interface PlayerFilter {
  search: string;
  positions: Position[];
  teamId?: number;
  seasonId?: number;
  seasonSlug?: string;
  cardType?: CardType;
  seasonYear?: string;
  minOvr?: number;
  maxOvr?: number;
  minPrice?: number;
  maxPrice?: number;
  minPace?: number;
  maxPace?: number;
  minShooting?: number;
  maxShooting?: number;
  minPassing?: number;
  maxPassing?: number;
  minDribbling?: number;
  maxDribbling?: number;
  minDefending?: number;
  maxDefending?: number;
  minPhysical?: number;
  maxPhysical?: number;
}

export interface PlayerCompareItem {
  player: Player;
  statRadar: number[];
}

export const ALL_POSITIONS: Position[] = [
  'ST', 'CF', 'LF', 'RF', 'LW', 'RW', 'CAM', 'CM',
  'CDM', 'LM', 'RM', 'LB', 'RB', 'CB', 'LWB', 'RWB', 'GK',
];

export const POSITION_CATEGORIES: Record<string, Position[]> = {
  FW: ['ST', 'CF', 'LF', 'RF', 'LW', 'RW'],
  MF: ['CAM', 'CM', 'CDM', 'LM', 'RM'],
  DF: ['CB', 'LB', 'RB', 'LWB', 'RWB'],
  GK: ['GK'],
};

/**
 * Reference map of FC Online seasons by seasonId.
 * Used to look up season metadata and enrich player data.
 */
export const SEASONS: Record<number, Season> = {
  // Base season cards
  24: {
    id: 24,
    slug: 'base-24',
    name: '베이스 (2024)',
    nameEn: 'Base (2024)',
    cardType: 'BASE',
    seasonYear: '24',
    releaseDate: '2024-01-01',
  },
  23: {
    id: 23,
    slug: 'base-23',
    name: '베이스 (2023)',
    nameEn: 'Base (2023)',
    cardType: 'BASE',
    seasonYear: '23',
    releaseDate: '2023-01-01',
  },
  // Special promotional cards
  60: {
    id: 60,
    slug: 'hot',
    name: 'HOT',
    nameEn: 'HOT (Highlight of the Tournament)',
    cardType: 'SPECIAL',
    seasonYear: '24',
    releaseDate: '2024-09-15',
  },
  67: {
    id: 67,
    slug: 'totnucl-2324',
    name: 'TOTNUCL (23/24)',
    nameEn: 'Team of the Tournament NUCL 23/24',
    cardType: 'SPECIAL',
    seasonYear: '23/24',
    releaseDate: '2024-06-10',
  },
  68: {
    id: 68,
    slug: 'totnucl-2425',
    name: 'TOTNUCL (24/25)',
    nameEn: 'Team of the Tournament NUCL 24/25',
    cardType: 'SPECIAL',
    seasonYear: '24/25',
    releaseDate: '2025-06-10',
  },
  // Icon cards
  69: {
    id: 69,
    slug: 'icon',
    name: 'ICON',
    nameEn: 'ICON (Legend)',
    cardType: 'ICON',
    seasonYear: '',
    releaseDate: '2020-01-01',
  },
  // Live dynamic cards
  70: {
    id: 70,
    slug: 'live-2425',
    name: 'LIVE (24/25)',
    nameEn: 'LIVE Form (24/25)',
    cardType: 'LIVE',
    seasonYear: '24/25',
    releaseDate: '2024-08-15',
  },
  // Man of the Match
  71: {
    id: 71,
    slug: 'mom',
    name: 'MOM',
    nameEn: 'Man of the Match',
    cardType: 'MOM',
    seasonYear: '24',
    releaseDate: '2024-10-01',
  },
  // Player of the Week
  72: {
    id: 72,
    slug: 'potw',
    name: 'POTW',
    nameEn: 'Player of the Week',
    cardType: 'POTW',
    seasonYear: '24',
    releaseDate: '2024-09-01',
  },
  // Road to Final
  73: {
    id: 73,
    slug: 'road-to-final',
    name: 'ROAD TO FINAL',
    nameEn: 'Road to Final',
    cardType: 'SPECIAL',
    seasonYear: '24/25',
    releaseDate: '2025-02-15',
  },
};

/** All available card types for filtering/display */
export const CARD_TYPES: CardType[] = ['BASE', 'SPECIAL', 'ICON', 'LIVE', 'MOM', 'POTW'];

/** Card type display labels (Korean) */
export const CARD_TYPE_LABELS: Record<CardType, string> = {
  BASE: '베이스',
  SPECIAL: '스페셜',
  ICON: 'ICON',
  LIVE: 'LIVE',
  MOM: 'MOM',
  POTW: 'POTW',
};

/** Look up a Season by its ID. Returns undefined if not found. */
export function getSeasonById(seasonId: number): Season | undefined {
  return SEASONS[seasonId];
}

/** Get all seasons filtered by card type */
export function getSeasonsByCardType(cardType: CardType): Season[] {
  return Object.values(SEASONS).filter((s) => s.cardType === cardType);
}
