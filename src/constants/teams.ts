import { TeamInfo } from "@/types/filters";

/**
 * FC Online teams grouped by league.
 * Team IDs are derived from Nexon API team identifiers (sprint id based).
 */
export const TEAMS: TeamInfo[] = [
  // Premier League
  { id: "1", name: "Manchester City", nameKo: "맨시티", league: "EPL" },
  { id: "2", name: "Arsenal", nameKo: "아스널", league: "EPL" },
  { id: "3", name: "Liverpool", nameKo: "리버풀", league: "EPL" },
  { id: "4", name: "Chelsea", nameKo: "첼시", league: "EPL" },
  { id: "5", name: "Manchester United", nameKo: "맨유", league: "EPL" },
  { id: "6", name: "Tottenham Hotspur", nameKo: "토트넘", league: "EPL" },
  { id: "7", name: "Newcastle United", nameKo: "뉴캐슬", league: "EPL" },
  { id: "8", name: "Aston Villa", nameKo: "애스턴빌라", league: "EPL" },
  { id: "9", name: "Brighton", nameKo: "브라이턴", league: "EPL" },
  { id: "10", name: "West Ham United", nameKo: "웨스트햄", league: "EPL" },
  { id: "11", name: "Crystal Palace", nameKo: "크리스탈팰리스", league: "EPL" },
  { id: "12", name: "Fulham", nameKo: "풀럼", league: "EPL" },
  { id: "13", name: "Wolverhampton", nameKo: "울버햄튼", league: "EPL" },
  { id: "14", name: "Everton", nameKo: "에버턴", league: "EPL" },
  { id: "15", name: "Brentford", nameKo: "브렌트포드", league: "EPL" },
  { id: "16", name: "Nottingham Forest", nameKo: "노팅엄", league: "EPL" },
  { id: "17", name: "Bournemouth", nameKo: "본머스", league: "EPL" },
  { id: "18", name: "Leicester City", nameKo: "레스터", league: "EPL" },
  { id: "19", name: "Ipswich Town", nameKo: "입스위치", league: "EPL" },
  { id: "20", name: "Southampton", nameKo: "사우스햄튼", league: "EPL" },

  // La Liga
  { id: "21", name: "Real Madrid", nameKo: "레알마드리드", league: "LALIGA" },
  { id: "22", name: "FC Barcelona", nameKo: "바르셀로나", league: "LALIGA" },
  { id: "23", name: "Atlético Madrid", nameKo: "아틀레티코", league: "LALIGA" },
  { id: "24", name: "Real Sociedad", nameKo: "레알소시에다드", league: "LALIGA" },
  { id: "25", name: "Athletic Bilbao", nameKo: "아틀레틱빌바오", league: "LALIGA" },
  { id: "26", name: "Real Betis", nameKo: "베티스", league: "LALIGA" },
  { id: "27", name: "Villarreal", nameKo: "비야레알", league: "LALIGA" },
  { id: "28", name: "Sevilla", nameKo: "세비야", league: "LALIGA" },
  { id: "29", name: "Valencia", nameKo: "발렌시아", league: "LALIGA" },
  { id: "30", name: "Girona", nameKo: "지로나", league: "LALIGA" },

  // Serie A
  { id: "31", name: "Inter Milan", nameKo: "인터밀란", league: "SERIEA" },
  { id: "32", name: "AC Milan", nameKo: "AC밀란", league: "SERIEA" },
  { id: "33", name: "Juventus", nameKo: "유벤투스", league: "SERIEA" },
  { id: "34", name: "SSC Napoli", nameKo: "나폴리", league: "SERIEA" },
  { id: "35", name: "AS Roma", nameKo: "로마", league: "SERIEA" },
  { id: "36", name: "SS Lazio", nameKo: "라치오", league: "SERIEA" },
  { id: "37", name: "Atalanta", nameKo: "아탈란타", league: "SERIEA" },
  { id: "38", name: "ACF Fiorentina", nameKo: "피오렌티나", league: "SERIEA" },
  { id: "39", name: "Bologna", nameKo: "볼로냐", league: "SERIEA" },

  // Bundesliga
  { id: "41", name: "Bayern Munich", nameKo: "바이에른", league: "BUNDESLIGA" },
  { id: "42", name: "Borussia Dortmund", nameKo: "도르트문트", league: "BUNDESLIGA" },
  { id: "43", name: "Bayer Leverkusen", nameKo: "레버쿠젠", league: "BUNDESLIGA" },
  { id: "44", name: "RB Leipzig", nameKo: "라이프치히", league: "BUNDESLIGA" },
  { id: "45", name: "VfB Stuttgart", nameKo: "슈투트가르트", league: "BUNDESLIGA" },
  { id: "46", name: "Eintracht Frankfurt", nameKo: "프랑크푸르트", league: "BUNDESLIGA" },
  { id: "47", name: "SC Freiburg", nameKo: "프라이부르크", league: "BUNDESLIGA" },
  { id: "48", name: "Wolfsburg", nameKo: "볼프스부르크", league: "BUNDESLIGA" },

  // Ligue 1
  { id: "51", name: "Paris Saint-Germain", nameKo: "파리생제르맹", league: "LIGUE1" },
  { id: "52", name: "Olympique Marseille", nameKo: "마르세유", league: "LIGUE1" },
  { id: "53", name: "AS Monaco", nameKo: "모나코", league: "LIGUE1" },
  { id: "54", name: "LOSC Lille", nameKo: "릴", league: "LIGUE1" },
  { id: "55", name: "Olympique Lyon", nameKo: "리옹", league: "LIGUE1" },
  { id: "56", name: "OGC Nice", nameKo: "니스", league: "LIGUE1" },

  // K League
  { id: "61", name: "Jeonbuk Hyundai Motors", nameKo: "전북현대", league: "KLEAGUE" },
  { id: "62", name: "FC Seoul", nameKo: "FC서울", league: "KLEAGUE" },
  { id: "63", name: "Suwon Samsung Bluewings", nameKo: "수원삼성", league: "KLEAGUE" },
  { id: "64", name: "Incheon United", nameKo: "인천유나이티드", league: "KLEAGUE" },
  { id: "65", name: "Ulsan HD FC", nameKo: "울산현대", league: "KLEAGUE" },
  { id: "66", name: "Pohang Steelers", nameKo: "포항스틸러스", league: "KLEAGUE" },
  { id: "67", name: "Daegu FC", nameKo: "대구FC", league: "KLEAGUE" },
  { id: "68", name: "Jeju United", nameKo: "제주유나이티드", league: "KLEAGUE" },
  { id: "69", name: "Gangwon FC", nameKo: "강원FC", league: "KLEAGUE" },
  { id: "70", name: "Daejeon Hana Citizen", nameKo: "대전하나", league: "KLEAGUE" },

  // Eredivisie
  { id: "71", name: "Ajax", nameKo: "아약스", league: "EREDIVISIE" },
  { id: "72", name: "PSV Eindhoven", nameKo: "PSV", league: "EREDIVISIE" },
  { id: "73", name: "Feyenoord", nameKo: "페예노르드", league: "EREDIVISIE" },

  // Primeira Liga
  { id: "81", name: "SL Benfica", nameKo: "벤피카", league: "PRIMEIRALIGA" },
  { id: "82", name: "Sporting CP", nameKo: "스포르팅", league: "PRIMEIRALIGA" },
  { id: "83", name: "FC Porto", nameKo: "포르투", league: "PRIMEIRALIGA" },

  // Turkish Süper Lig
  { id: "91", name: "Galatasaray", nameKo: "갈라타사라이", league: "SUPERLIG" },
  { id: "92", name: "Fenerbahçe", nameKo: "페네르바흐체", league: "SUPERLIG" },
  { id: "93", name: "Beşiktaş", nameKo: "베식타스", league: "SUPERLIG" },

  // Scottish Premiership
  { id: "101", name: "Celtic", nameKo: "셀틱", league: "SCOTPREM" },
  { id: "102", name: "Rangers", nameKo: "레인저스", league: "SCOTPREM" },

  // MLS
  { id: "111", name: "LA Galaxy", nameKo: "LA갤럭시", league: "MLS" },
  { id: "112", name: "Inter Miami CF", nameKo: "인터마이애미", league: "MLS" },
  { id: "113", name: "LAFC", nameKo: "LAFC", league: "MLS" },

  // Saudi Pro League
  { id: "121", name: "Al Hilal", nameKo: "알힐랄", league: "SPL" },
  { id: "122", name: "Al Nassr", nameKo: "알나스르", league: "SPL" },
  { id: "123", name: "Al Ittihad", nameKo: "알이티하드", league: "SPL" },
];

/** Leagues with display info */
export const LEAGUES = [
  { id: "EPL", name: "Premier League", nameKo: "프리미어리그" },
  { id: "LALIGA", name: "La Liga", nameKo: "라리가" },
  { id: "SERIEA", name: "Serie A", nameKo: "세리에A" },
  { id: "BUNDESLIGA", name: "Bundesliga", nameKo: "분데스리가" },
  { id: "LIGUE1", name: "Ligue 1", nameKo: "리그1" },
  { id: "KLEAGUE", name: "K League", nameKo: "K리그" },
  { id: "EREDIVISIE", name: "Eredivisie", nameKo: "에레디비지에" },
  { id: "PRIMEIRALIGA", name: "Primeira Liga", nameKo: "프리메이라리가" },
  { id: "SUPERLIG", name: "Süper Lig", nameKo: "쉬페르리그" },
  { id: "SCOTPREM", name: "Scottish Premiership", nameKo: "스코티시프리미어" },
  { id: "MLS", name: "MLS", nameKo: "MLS" },
  { id: "SPL", name: "Saudi Pro League", nameKo: "사우디리그" },
] as const;

/** Get teams grouped by league */
export function getTeamsByLeague(): Record<string, TeamInfo[]> {
  const grouped: Record<string, TeamInfo[]> = {};
  for (const team of TEAMS) {
    if (!grouped[team.league]) {
      grouped[team.league] = [];
    }
    grouped[team.league].push(team);
  }
  return grouped;
}

/** Search teams by name (supports Korean and English) */
export function searchTeams(query: string): TeamInfo[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return TEAMS.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.nameKo.includes(q) ||
      t.league.toLowerCase().includes(q)
  );
}
