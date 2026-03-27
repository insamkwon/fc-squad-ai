/**
 * Team color presets for popular FC Online teams.
 * Colors represent the primary/secondary kit colors of each team.
 *
 * These are used by the TeamColorPicker component to offer quick-select
 * preset colors instead of requiring manual color picking.
 */
export interface TeamColorPreset {
  id: string;
  name: string;
  nameKo: string;
  primary: string;   // Main kit color (hex)
  secondary: string; // Accent/secondary kit color (hex)
  league: string;
}

/**
 * Curated list of popular teams with their kit colors.
 * Sorted by popularity/league for the preset grid.
 */
export const TEAM_COLOR_PRESETS: TeamColorPreset[] = [
  // Premier League
  { id: '1', name: 'Manchester City', nameKo: '맨시티', primary: '#6CABDD', secondary: '#1C2C5B', league: 'EPL' },
  { id: '2', name: 'Arsenal', nameKo: '아스널', primary: '#EF0107', secondary: '#FFFFFF', league: 'EPL' },
  { id: '3', name: 'Liverpool', nameKo: '리버풀', primary: '#C8102E', secondary: '#00B2A9', league: 'EPL' },
  { id: '4', name: 'Chelsea', nameKo: '첼시', primary: '#034694', secondary: '#FFFFFF', league: 'EPL' },
  { id: '5', name: 'Manchester United', nameKo: '맨유', primary: '#DA291C', secondary: '#FBE122', league: 'EPL' },
  { id: '6', name: 'Tottenham Hotspur', nameKo: '토트넘', primary: '#132257', secondary: '#FFFFFF', league: 'EPL' },
  { id: '7', name: 'Newcastle United', nameKo: '뉴캐슬', primary: '#241F20', secondary: '#FFFFFF', league: 'EPL' },
  { id: '8', name: 'Aston Villa', nameKo: '애스턴빌라', primary: '#670E36', secondary: '#95BFE5', league: 'EPL' },

  // La Liga
  { id: '21', name: 'Real Madrid', nameKo: '레알마드리드', primary: '#FEBE10', secondary: '#FFFFFF', league: 'LALIGA' },
  { id: '22', name: 'FC Barcelona', nameKo: '바르셀로나', primary: '#A50044', secondary: '#004D98', league: 'LALIGA' },
  { id: '23', name: 'Atlético Madrid', nameKo: '아틀레티코', primary: '#CE3524', secondary: '#27509B', league: 'LALIGA' },
  { id: '29', name: 'Valencia', nameKo: '발렌시아', primary: '#FFFFFF', secondary: '#FF6600', league: 'LALIGA' },

  // Serie A
  { id: '31', name: 'Inter Milan', nameKo: '인터밀란', primary: '#0068A8', secondary: '#000000', league: 'SERIEA' },
  { id: '32', name: 'AC Milan', nameKo: 'AC밀란', primary: '#FB090B', secondary: '#000000', league: 'SERIEA' },
  { id: '33', name: 'Juventus', nameKo: '유벤투스', primary: '#000000', secondary: '#FFFFFF', league: 'SERIEA' },
  { id: '34', name: 'SSC Napoli', nameKo: '나폴리', primary: '#12A0D7', secondary: '#FFFFFF', league: 'SERIEA' },

  // Bundesliga
  { id: '41', name: 'Bayern Munich', nameKo: '바이에른', primary: '#DC052D', secondary: '#FFFFFF', league: 'BUNDESLIGA' },
  { id: '42', name: 'Borussia Dortmund', nameKo: '도르트문트', primary: '#FDE100', secondary: '#000000', league: 'BUNDESLIGA' },
  { id: '43', name: 'Bayer Leverkusen', nameKo: '레버쿠젠', primary: '#E32221', secondary: '#000000', league: 'BUNDESLIGA' },

  // Ligue 1
  { id: '51', name: 'Paris Saint-Germain', nameKo: '파리생제르맹', primary: '#004170', secondary: '#DA291C', league: 'LIGUE1' },
  { id: '52', name: 'Olympique Marseille', nameKo: '마르세유', primary: '#2FAEE0', secondary: '#FFFFFF', league: 'LIGUE1' },

  // K League
  { id: '61', name: 'Jeonbuk Hyundai Motors', nameKo: '전북현대', primary: '#1D6F42', secondary: '#FFFFFF', league: 'KLEAGUE' },
  { id: '62', name: 'FC Seoul', nameKo: 'FC서울', primary: '#C8102E', secondary: '#000000', league: 'KLEAGUE' },
  { id: '65', name: 'Ulsan HD FC', nameKo: '울산현대', primary: '#00469E', secondary: '#E4002B', league: 'KLEAGUE' },
  { id: '63', name: 'Suwon Samsung Bluewings', nameKo: '수원삼성', primary: '#0066B3', secondary: '#FFFFFF', league: 'KLEAGUE' },

  // Eredivisie
  { id: '71', name: 'Ajax', nameKo: '아약스', primary: '#D2122E', secondary: '#FFFFFF', league: 'EREDIVISIE' },

  // Primeira Liga
  { id: '81', name: 'SL Benfica', nameKo: '벤피카', primary: '#FF0000', secondary: '#FFFFFF', league: 'PRIMEIRALIGA' },
  { id: '82', name: 'Sporting CP', nameKo: '스포르팅', primary: '#00843D', secondary: '#FFFFFF', league: 'PRIMEIRALIGA' },
  { id: '83', name: 'FC Porto', nameKo: '포르투', primary: '#003893', secondary: '#FFFFFF', league: 'PRIMEIRALIGA' },

  // Turkish Süper Lig
  { id: '91', name: 'Galatasaray', nameKo: '갈라타사라이', primary: '#FDB913', secondary: '#A9191B', league: 'SUPERLIG' },
  { id: '92', name: 'Fenerbahçe', nameKo: '페네르바흐체', primary: '#FFED00', secondary: '#00205B', league: 'SUPERLIG' },

  // MLS
  { id: '112', name: 'Inter Miami CF', nameKo: '인터마이애미', primary: '#F7B5CD', secondary: '#000000', league: 'MLS' },
];

/**
 * Get team color presets grouped by league.
 */
export function getTeamColorPresetsByLeague(): Record<string, TeamColorPreset[]> {
  const grouped: Record<string, TeamColorPreset[]> = {};
  for (const preset of TEAM_COLOR_PRESETS) {
    if (!grouped[preset.league]) {
      grouped[preset.league] = [];
    }
    grouped[preset.league].push(preset);
  }
  return grouped;
}

/**
 * Find a team color preset by team ID.
 */
export function getTeamColorPresetById(teamId: string): TeamColorPreset | undefined {
  return TEAM_COLOR_PRESETS.find((p) => p.id === teamId);
}

/**
 * Search team color presets by name (Korean or English).
 */
export function searchTeamColorPresets(query: string): TeamColorPreset[] {
  const q = query.toLowerCase().trim();
  if (!q) return TEAM_COLOR_PRESETS;
  return TEAM_COLOR_PRESETS.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.nameKo.includes(q) ||
      p.league.toLowerCase().includes(q),
  );
}

/** League display info for color presets */
export const TEAM_COLOR_LEAGUES = [
  { id: 'EPL', nameKo: 'EPL' },
  { id: 'LALIGA', nameKo: '라리가' },
  { id: 'SERIEA', nameKo: '세리에A' },
  { id: 'BUNDESLIGA', nameKo: '분데스리가' },
  { id: 'LIGUE1', nameKo: '리그1' },
  { id: 'KLEAGUE', nameKo: 'K리그' },
  { id: 'EREDIVISIE', nameKo: '에레디비지에' },
  { id: 'PRIMEIRALIGA', nameKo: '프리메이라리가' },
  { id: 'SUPERLIG', nameKo: '쉬페르리그' },
  { id: 'MLS', nameKo: 'MLS' },
] as const;
