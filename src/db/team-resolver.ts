/**
 * Team name resolver for FC Online player data.
 *
 * Maps Korean team names (from details.csv team_colors field) to
 * structured team info with IDs, English names, and league assignments.
 */

export interface TeamInfo {
  id: number;
  name: string;
  nameEn: string;
  leagueId: number;
  leagueName: string;
}

const TEAM_MAP: Record<string, TeamInfo> = {
  // EPL
  '맨체스터 시티': { id: 1, name: 'Manchester City', nameEn: 'Manchester City', leagueId: 0, leagueName: 'EPL' },
  '아스널': { id: 2, name: 'Arsenal', nameEn: 'Arsenal', leagueId: 0, leagueName: 'EPL' },
  '리버풀': { id: 3, name: 'Liverpool', nameEn: 'Liverpool', leagueId: 0, leagueName: 'EPL' },
  '첼시': { id: 4, name: 'Chelsea', nameEn: 'Chelsea', leagueId: 0, leagueName: 'EPL' },
  '맨체스터 유나이티드': { id: 5, name: 'Manchester United', nameEn: 'Manchester United', leagueId: 0, leagueName: 'EPL' },
  '토트넘 홋스퍼': { id: 6, name: 'Tottenham', nameEn: 'Tottenham Hotspur', leagueId: 0, leagueName: 'EPL' },
  '뉴캐슬 유나이티드': { id: 7, name: 'Newcastle', nameEn: 'Newcastle United', leagueId: 0, leagueName: 'EPL' },
  '애스턴 빌라': { id: 8, name: 'Aston Villa', nameEn: 'Aston Villa', leagueId: 0, leagueName: 'EPL' },
  '브라이턴': { id: 9, name: 'Brighton', nameEn: 'Brighton', leagueId: 0, leagueName: 'EPL' },
  '웨스트햄': { id: 10, name: 'West Ham', nameEn: 'West Ham United', leagueId: 0, leagueName: 'EPL' },
  '크리스탈 팰리스': { id: 11, name: 'Crystal Palace', nameEn: 'Crystal Palace', leagueId: 0, leagueName: 'EPL' },
  '풀럼': { id: 12, name: 'Fulham', nameEn: 'Fulham', leagueId: 0, leagueName: 'EPL' },
  '울버햄튼': { id: 13, name: 'Wolverhampton', nameEn: 'Wolverhampton', leagueId: 0, leagueName: 'EPL' },
  '에버턴': { id: 14, name: 'Everton', nameEn: 'Everton', leagueId: 0, leagueName: 'EPL' },
  '브렌트포드': { id: 15, name: 'Brentford', nameEn: 'Brentford', leagueId: 0, leagueName: 'EPL' },
  '노팅엄 포레스트': { id: 16, name: 'Nottingham Forest', nameEn: 'Nottingham Forest', leagueId: 0, leagueName: 'EPL' },
  '본머스': { id: 17, name: 'Bournemouth', nameEn: 'Bournemouth', leagueId: 0, leagueName: 'EPL' },
  '레스터 시티': { id: 18, name: 'Leicester', nameEn: 'Leicester City', leagueId: 0, leagueName: 'EPL' },
  '입스위치 타운': { id: 19, name: 'Ipswich', nameEn: 'Ipswich Town', leagueId: 0, leagueName: 'EPL' },
  '사우스햄튼': { id: 20, name: 'Southampton', nameEn: 'Southampton', leagueId: 0, leagueName: 'EPL' },

  // La Liga
  '레알 마드리드': { id: 21, name: 'Real Madrid', nameEn: 'Real Madrid', leagueId: 1, leagueName: 'LALIGA' },
  'FC 바르셀로나': { id: 22, name: 'FC Barcelona', nameEn: 'FC Barcelona', leagueId: 1, leagueName: 'LALIGA' },
  '아틀레티코 마드리드': { id: 23, name: 'Atletico Madrid', nameEn: 'Atletico Madrid', leagueId: 1, leagueName: 'LALIGA' },
  '레알 소시에다드': { id: 24, name: 'Real Sociedad', nameEn: 'Real Sociedad', leagueId: 1, leagueName: 'LALIGA' },
  '아틀레틱 빌바오': { id: 25, name: 'Athletic Bilbao', nameEn: 'Athletic Bilbao', leagueId: 1, leagueName: 'LALIGA' },
  '레알 베티스': { id: 26, name: 'Real Betis', nameEn: 'Real Betis', leagueId: 1, leagueName: 'LALIGA' },
  '비야레알 CF': { id: 27, name: 'Villarreal', nameEn: 'Villarreal', leagueId: 1, leagueName: 'LALIGA' },
  '세비야 FC': { id: 28, name: 'Sevilla', nameEn: 'Sevilla', leagueId: 1, leagueName: 'LALIGA' },
  '발렌시아 CF': { id: 29, name: 'Valencia', nameEn: 'Valencia', leagueId: 1, leagueName: 'LALIGA' },
  '지로나 FC': { id: 30, name: 'Girona', nameEn: 'Girona', leagueId: 1, leagueName: 'LALIGA' },
  'RCD 마요르카': { id: 31, name: 'Mallorca', nameEn: 'RCD Mallorca', leagueId: 1, leagueName: 'LALIGA' },

  // Serie A
  '인터 밀란': { id: 32, name: 'Inter Milan', nameEn: 'Inter Milan', leagueId: 2, leagueName: 'SERIEA' },
  '밀라노 FC': { id: 32, name: 'Inter Milan', nameEn: 'Inter Milan', leagueId: 2, leagueName: 'SERIEA' },
  'AC 밀란': { id: 33, name: 'AC Milan', nameEn: 'AC Milan', leagueId: 2, leagueName: 'SERIEA' },
  '유벤투스': { id: 34, name: 'Juventus', nameEn: 'Juventus', leagueId: 2, leagueName: 'SERIEA' },
  'SSC 나폴리': { id: 35, name: 'Napoli', nameEn: 'SSC Napoli', leagueId: 2, leagueName: 'SERIEA' },
  'AS 로마': { id: 36, name: 'AS Roma', nameEn: 'AS Roma', leagueId: 2, leagueName: 'SERIEA' },
  'SS 라치오': { id: 37, name: 'Lazio', nameEn: 'SS Lazio', leagueId: 2, leagueName: 'SERIEA' },
  '아탈란타 BC': { id: 38, name: 'Atalanta', nameEn: 'Atalanta', leagueId: 2, leagueName: 'SERIEA' },
  '베르가모 칼초': { id: 38, name: 'Atalanta', nameEn: 'Atalanta', leagueId: 2, leagueName: 'SERIEA' },
  'ACF 피오렌티나': { id: 39, name: 'Fiorentina', nameEn: 'ACF Fiorentina', leagueId: 2, leagueName: 'SERIEA' },
  '볼로냐 FC 1909': { id: 40, name: 'Bologna', nameEn: 'Bologna', leagueId: 2, leagueName: 'SERIEA' },

  // Bundesliga
  'FC 바이에른 뮌헨': { id: 41, name: 'Bayern Munich', nameEn: 'Bayern Munich', leagueId: 3, leagueName: 'BUNDESLIGA' },
  '바이에른 뮌헨': { id: 41, name: 'Bayern Munich', nameEn: 'Bayern Munich', leagueId: 3, leagueName: 'BUNDESLIGA' },
  '보루시아 도르트문트': { id: 42, name: 'Dortmund', nameEn: 'Borussia Dortmund', leagueId: 3, leagueName: 'BUNDESLIGA' },
  '바이엘 04 레버쿠젠': { id: 43, name: 'Leverkusen', nameEn: 'Bayer Leverkusen', leagueId: 3, leagueName: 'BUNDESLIGA' },
  'RB 라이프치히': { id: 44, name: 'RB Leipzig', nameEn: 'RB Leipzig', leagueId: 3, leagueName: 'BUNDESLIGA' },
  'VfB 슈투트가르트': { id: 45, name: 'Stuttgart', nameEn: 'VfB Stuttgart', leagueId: 3, leagueName: 'BUNDESLIGA' },
  '아인트라흐트 프랑크푸르트': { id: 46, name: 'Frankfurt', nameEn: 'Eintracht Frankfurt', leagueId: 3, leagueName: 'BUNDESLIGA' },

  // Ligue 1
  '파리 생제르맹': { id: 51, name: 'PSG', nameEn: 'Paris Saint-Germain', leagueId: 4, leagueName: 'LIGUE1' },
  '올랭피크 드 마르세유': { id: 52, name: 'Marseille', nameEn: 'Olympique Marseille', leagueId: 4, leagueName: 'LIGUE1' },
  'AS 모나코': { id: 53, name: 'Monaco', nameEn: 'AS Monaco', leagueId: 4, leagueName: 'LIGUE1' },
  'LOSC 릴': { id: 54, name: 'Lille', nameEn: 'LOSC Lille', leagueId: 4, leagueName: 'LIGUE1' },
  '올랭피크 리옹': { id: 55, name: 'Lyon', nameEn: 'Olympique Lyon', leagueId: 4, leagueName: 'LIGUE1' },
  'OGC 니스': { id: 56, name: 'Nice', nameEn: 'OGC Nice', leagueId: 4, leagueName: 'LIGUE1' },

  // K League
  '전북 현대 모터스': { id: 61, name: 'Jeonbuk', nameEn: 'Jeonbuk Hyundai Motors', leagueId: 5, leagueName: 'KLEAGUE' },
  'FC 서울': { id: 62, name: 'FC Seoul', nameEn: 'FC Seoul', leagueId: 5, leagueName: 'KLEAGUE' },
  '수원 삼성 블루윙즈': { id: 63, name: 'Suwon', nameEn: 'Suwon Samsung Bluewings', leagueId: 5, leagueName: 'KLEAGUE' },
  '인천 유나이티드': { id: 64, name: 'Incheon', nameEn: 'Incheon United', leagueId: 5, leagueName: 'KLEAGUE' },
  '울산 현대': { id: 65, name: 'Ulsan', nameEn: 'Ulsan HD FC', leagueId: 5, leagueName: 'KLEAGUE' },
  '울산 HD FC': { id: 65, name: 'Ulsan', nameEn: 'Ulsan HD FC', leagueId: 5, leagueName: 'KLEAGUE' },
  '포항 스틸러스': { id: 66, name: 'Pohang', nameEn: 'Pohang Steelers', leagueId: 5, leagueName: 'KLEAGUE' },
  '대구 FC': { id: 67, name: 'Daegu', nameEn: 'Daegu FC', leagueId: 5, leagueName: 'KLEAGUE' },
  '제주 유나이티드': { id: 68, name: 'Jeju', nameEn: 'Jeju United', leagueId: 5, leagueName: 'KLEAGUE' },
  '강원 FC': { id: 69, name: 'Gangwon', nameEn: 'Gangwon FC', leagueId: 5, leagueName: 'KLEAGUE' },
  '대전 하나 시티즌': { id: 70, name: 'Daejeon', nameEn: 'Daejeon Hana Citizen', leagueId: 5, leagueName: 'KLEAGUE' },

  // Eredivisie
  '아약스': { id: 71, name: 'Ajax', nameEn: 'Ajax', leagueId: 6, leagueName: 'EREDIVISIE' },
  'PSV': { id: 72, name: 'PSV', nameEn: 'PSV Eindhoven', leagueId: 6, leagueName: 'EREDIVISIE' },
  '페예노르드': { id: 73, name: 'Feyenoord', nameEn: 'Feyenoord', leagueId: 6, leagueName: 'EREDIVISIE' },

  // Primeira Liga
  'SL 벤피카': { id: 81, name: 'Benfica', nameEn: 'SL Benfica', leagueId: 7, leagueName: 'PRIMEIRALIGA' },
  '스포르팅 CP': { id: 82, name: 'Sporting', nameEn: 'Sporting CP', leagueId: 7, leagueName: 'PRIMEIRALIGA' },
  'FC 포르투': { id: 83, name: 'Porto', nameEn: 'FC Porto', leagueId: 7, leagueName: 'PRIMEIRALIGA' },

  // Turkish
  '갈라타사라이': { id: 91, name: 'Galatasaray', nameEn: 'Galatasaray', leagueId: 8, leagueName: 'SUPERLIG' },
  '페네르바흐체': { id: 92, name: 'Fenerbahce', nameEn: 'Fenerbahce', leagueId: 8, leagueName: 'SUPERLIG' },

  // Scottish
  '셀틱': { id: 101, name: 'Celtic', nameEn: 'Celtic', leagueId: 9, leagueName: 'SCOTPREM' },
  '레인저스': { id: 102, name: 'Rangers', nameEn: 'Rangers', leagueId: 9, leagueName: 'SCOTPREM' },

  // Saudi
  '알힐랄': { id: 121, name: 'Al Hilal', nameEn: 'Al Hilal', leagueId: 11, leagueName: 'SPL' },
  '알나스르': { id: 122, name: 'Al Nassr', nameEn: 'Al Nassr', leagueId: 11, leagueName: 'SPL' },
  '알 이티하드': { id: 123, name: 'Al Ittihad', nameEn: 'Al Ittihad', leagueId: 11, leagueName: 'SPL' },

  // MLS
  'LA 갤럭시': { id: 111, name: 'LA Galaxy', nameEn: 'LA Galaxy', leagueId: 10, leagueName: 'MLS' },
  '인터 마이애미': { id: 112, name: 'Inter Miami', nameEn: 'Inter Miami CF', leagueId: 10, leagueName: 'MLS' },
  'LAFC': { id: 113, name: 'LAFC', nameEn: 'LAFC', leagueId: 10, leagueName: 'MLS' },

  // Others / Free
  '세르히오 아구에로': { id: 0, name: 'Free', nameEn: 'Free', leagueId: -1, leagueName: 'OTHER' },
};

const UNKNOWN_TEAM: TeamInfo = { id: 0, name: 'Unknown', nameEn: 'Unknown', leagueId: -1, leagueName: 'OTHER' };

/**
 * Parse the team_colors JSON string from a CSV row.
 * Returns the parsed array of strings or null on failure.
 */
export function parseTeamColors(tcStr: string): string[] | null {
  if (!tcStr || !tcStr.startsWith('[')) return null;
  try {
    const cleaned = tcStr.replace(/""/g, '"');
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * Resolve a team from the team_colors array.
 *
 * The team_colors array typically has:
 * - [0]: nationality (Korean)
 * - [1]: club name (Korean)
 * - [2]: club name (English)
 */
export function findTeam(teamColors: string[] | null): TeamInfo {
  if (!teamColors || teamColors.length < 2) {
    return UNKNOWN_TEAM;
  }

  // teamColors[1] is the club name in Korean
  const clubName = teamColors[1];

  // Exact match
  if (TEAM_MAP[clubName]) return TEAM_MAP[clubName];

  // Partial match
  for (const [key, info] of Object.entries(TEAM_MAP)) {
    if (clubName.includes(key) || key.includes(clubName)) return info;
  }

  // Check English names too
  if (teamColors.length >= 3) {
    const clubEn = teamColors[2];
    for (const [, info] of Object.entries(TEAM_MAP)) {
      if (info.nameEn && clubEn.includes(info.nameEn)) return info;
    }
  }

  return { id: 0, name: clubName, nameEn: clubName, leagueId: -1, leagueName: 'OTHER' };
}
