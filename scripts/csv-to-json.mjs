#!/usr/bin/env node
/**
 * Convert details.csv → data/players.json
 *
 * Usage: node scripts/csv-to-json.mjs
 *
 * Reads data/details.csv (from fconline-player-search project),
 * maps FC Online season codes to our Season model, and outputs
 * a JSON array of Player objects consumed by player-store.ts.
 */

import fs from 'node:fs';
import path from 'node:path';

const CSV_PATH = path.resolve('data/details.csv');
const OUT_PATH = path.resolve('data/players.json');

// ---------------------------------------------------------------------------
// 1. Simple CSV parser (handles quoted fields with commas)
// ---------------------------------------------------------------------------

function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, ''); // BOM
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQuotes) {
      if (ch === '"' && raw[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field.trim());
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        current.push(field.trim());
        field = '';
        if (current.length > 1) rows.push(current);
        current = [];
        if (ch === '\r' && raw[i + 1] === '\n') i++;
      } else {
        field += ch;
      }
    }
  }
  // last field
  if (field) current.push(field.trim());
  if (current.length > 1) rows.push(current);

  return rows;
}

// ---------------------------------------------------------------------------
// 2. Season classification
// ---------------------------------------------------------------------------

/**
 * Map FC Online season codes to our CardType + display info.
 * Returns { cardType, name, nameEn, seasonYear }
 */
function classifySeason(code) {
  if (!code) return { cardType: 'BASE', name: code || 'Unknown', nameEn: code || 'Unknown', seasonYear: '' };

  const c = code.toUpperCase();

  // ICON variants
  if (c.startsWith('ICON') || c === 'MCICON') {
    return { cardType: 'ICON', name: `ICON (${code})`, nameEn: `ICON (${code})`, seasonYear: '' };
  }

  // LIVE
  if (c === 'LIVE') {
    return { cardType: 'LIVE', name: 'LIVE', nameEn: 'LIVE Form', seasonYear: '24/25' };
  }

  // TOTY / TOTS / TOTN
  if (c.includes('TOTY')) {
    return { cardType: 'SPECIAL', name: `TOTY (${code})`, nameEn: `Team of the Year (${code})`, seasonYear: extractYear(code) };
  }
  if (c.includes('TOTS')) {
    return { cardType: 'SPECIAL', name: `TOTS (${code})`, nameEn: `Team of the Season (${code})`, seasonYear: extractYear(code) };
  }
  if (c.includes('TOTN')) {
    return { cardType: 'SPECIAL', name: `TOTN (${code})`, nameEn: `Team of the Tournament (${code})`, seasonYear: extractYear(code) };
  }

  // UCL
  if (c.includes('UCL')) {
    return { cardType: 'SPECIAL', name: `UCL (${code})`, nameEn: `UCL (${code})`, seasonYear: extractYear(code) };
  }

  // HOT
  if (c === 'HOT') {
    return { cardType: 'SPECIAL', name: 'HOT', nameEn: 'Highlight of the Tournament', seasonYear: '24' };
  }

  // Base seasons (year only: 17, 18, 19, 20, 21, 22, 23, 24, 25)
  if (/^(17|18|19|20|21|22|23|24|25)$/.test(c)) {
    const y = `20${c}`;
    return { cardType: 'BASE', name: `베이스 (${y})`, nameEn: `Base (${y})`, seasonYear: c };
  }

  // K League base (24KL, 23KL, etc.)
  if (/\d{2}KL/.test(c)) {
    const y = c.replace('KL', '');
    return { cardType: 'BASE', name: `K리그 베이스 (20${y})`, nameEn: `K League Base (20${y})`, seasonYear: y };
  }

  // K League boost (24KLB, 23KLB)
  if (/\d{2}KLB/.test(c)) {
    const y = c.replace('KLB', '');
    return { cardType: 'SPECIAL', name: `K리그 부스트 (20${y})`, nameEn: `K League Boost (20${y})`, seasonYear: y };
  }

  // PLA (Premier League base: 24PLA, 23PLA)
  if (/\d{2}PLA/.test(c)) {
    const y = c.replace('PLA', '');
    return { cardType: 'BASE', name: `프리미어리그 (20${y})`, nameEn: `Premier League (20${y})`, seasonYear: y };
  }

  // PLS (La Liga base: 18PLS)
  if (/\d{2}PLS/.test(c)) {
    const y = c.replace('PLS', '');
    return { cardType: 'BASE', name: `라리가 (20${y})`, nameEn: `La Liga (20${y})`, seasonYear: y };
  }

  // Known special event codes
  const specials = {
    'BDO': 'Ballon d\'Or', 'BLD': 'Build Up', 'BTB': 'Back to Back',
    'BWC': 'Best World Cup', 'CAP': 'Captain', 'CC': 'Continental Cup',
    'CFA': 'Copa America', 'COC': 'Copa del Rey', 'CU': 'Continental',
    'DC': 'Derby Clash', 'EBS': 'EBS', 'EU24': 'EURO 2024',
    'FA': 'FA Cup', 'FCA': 'FCA', 'GR': 'Growth', 'GRU': 'Grudge',
    'HG': 'Heroic Glory', 'JNM': 'Jungle Movie', 'JVA': 'J-League',
    'KFA': 'KFA', 'LA': 'Liga America', 'LD': 'Legend',
    'LE': 'Legendary', 'LH': 'Loyal Heroes', 'LKI': 'LKI',
    'LN': 'Limitless', 'LOL': 'LOL', 'MC': 'Man City',
    'MDL': 'Medal', 'MOG': 'Master of Goals', 'NHD': 'National Hero Debut',
    'NO7': 'Number 7', 'NTG': 'NTG', 'OTW': 'One to Watch',
    'PLC': 'Players Choice', 'RMCF': 'Real Madrid', 'RTN': 'Return',
    'SPL': 'Special Player', 'TB': 'Tournament Best',
    'TC': 'Tournament Champions', 'TKI': 'Top Korean Icons',
    'TKL': 'Top K League', 'TT': 'Top Transfer', 'UP': 'Update',
    'UT': 'Ultimate', 'VTR': 'Veteran', 'WB': 'World Best',
    'WC22': 'World Cup 2022', 'BOE21': 'Best of Europe 21',
    'MCFC': 'Man City FC',
  };

  if (c.startsWith('20') || c.startsWith('19')) {
    // Year-prefixed codes (e.g., 2012KH, 2019KFA, 20NG, etc.)
    if (specials[c]) {
      return { cardType: 'SPECIAL', name: `${specials[c]}`, nameEn: `${specials[c]}`, seasonYear: c.substring(0, 2) };
    }
    // Generic year-prefixed
    return { cardType: 'SPECIAL', name: code, nameEn: code, seasonYear: c.substring(0, 2) };
  }

  if (specials[c]) {
    return { cardType: 'SPECIAL', name: specials[c], nameEn: specials[c], seasonYear: '' };
  }

  // Number-prefixed year codes (22HR, 23HW, 24EP, 25HR, etc.)
  if (/^\d{2}/.test(c)) {
    return { cardType: 'SPECIAL', name: code, nameEn: code, seasonYear: c.substring(0, 2) };
  }

  // Fallback
  return { cardType: 'SPECIAL', name: code, nameEn: code, seasonYear: '' };
}

function extractYear(code) {
  const match = code.match(/^(\d{2})/);
  return match ? match[1] : '';
}

// ---------------------------------------------------------------------------
// 3. Team name mapping (Korean → team info)
// ---------------------------------------------------------------------------

const TEAM_MAP = {
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

  // Serie A
  '인터 밀란': { id: 31, name: 'Inter Milan', nameEn: 'Inter Milan', leagueId: 2, leagueName: 'SERIEA' },
  '밀라노 FC': { id: 31, name: 'Inter Milan', nameEn: 'Inter Milan', leagueId: 2, leagueName: 'SERIEA' },
  'AC 밀란': { id: 32, name: 'AC Milan', nameEn: 'AC Milan', leagueId: 2, leagueName: 'SERIEA' },
  '유벤투스': { id: 33, name: 'Juventus', nameEn: 'Juventus', leagueId: 2, leagueName: 'SERIEA' },
  'SSC 나폴리': { id: 34, name: 'Napoli', nameEn: 'SSC Napoli', leagueId: 2, leagueName: 'SERIEA' },
  'AS 로마': { id: 35, name: 'AS Roma', nameEn: 'AS Roma', leagueId: 2, leagueName: 'SERIEA' },
  'SS 라치오': { id: 36, name: 'Lazio', nameEn: 'SS Lazio', leagueId: 2, leagueName: 'SERIEA' },
  '아탈란타 BC': { id: 37, name: 'Atalanta', nameEn: 'Atalanta', leagueId: 2, leagueName: 'SERIEA' },
  '베르가모 칼초': { id: 37, name: 'Atalanta', nameEn: 'Atalanta', leagueId: 2, leagueName: 'SERIEA' },
  'ACF 피오렌티나': { id: 38, name: 'Fiorentina', nameEn: 'ACF Fiorentina', leagueId: 2, leagueName: 'SERIEA' },
  '볼로냐 FC 1909': { id: 39, name: 'Bologna', nameEn: 'Bologna', leagueId: 2, leagueName: 'SERIEA' },

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
  'RCD 마요르카': { id: 30, name: 'Mallorca', nameEn: 'RCD Mallorca', leagueId: 1, leagueName: 'LALIGA' },

  // Saudi
  '알힐랄': { id: 121, name: 'Al Hilal', nameEn: 'Al Hilal', leagueId: 11, leagueName: 'SPL' },
  '알나스르': { id: 122, name: 'Al Nassr', nameEn: 'Al Nassr', leagueId: 11, leagueName: 'SPL' },
  '알 이티하드': { id: 123, name: 'Al Ittihad', nameEn: 'Al Ittihad', leagueId: 11, leagueName: 'SPL' },

  // MLS
  'LA 갤럭시': { id: 111, name: 'LA Galaxy', nameEn: 'LA Galaxy', leagueId: 10, leagueName: 'MLS' },
  '인터 마이애미': { id: 112, name: 'Inter Miami', nameEn: 'Inter Miami CF', leagueId: 10, leagueName: 'MLS' },
  'LAFC': { id: 113, name: 'LAFC', nameEn: 'LAFC', leagueId: 10, leagueName: 'MLS' },

  // Others
  '세르히오 아구에로': { id: 0, name: 'Free', nameEn: 'Free', leagueId: -1, leagueName: 'OTHER' },
};

function parseTeamColors(tcStr) {
  if (!tcStr || !tcStr.startsWith('[')) return null;
  try {
    const cleaned = tcStr.replace(/""/g, '"');
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function findTeam(teamColors) {
  if (!teamColors || teamColors.length < 2) {
    return { id: 0, name: 'Unknown', nameEn: 'Unknown', leagueId: -1, leagueName: 'OTHER' };
  }
  // teamColors[1] is the club name in Korean
  const clubName = teamColors[1];
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

// ---------------------------------------------------------------------------
// 4. Position validation
// ---------------------------------------------------------------------------

const VALID_POSITIONS = new Set([
  'ST', 'CF', 'LF', 'RF', 'LW', 'RW', 'CAM', 'CM',
  'CDM', 'LM', 'RM', 'LB', 'RB', 'CB', 'LWB', 'RWB', 'GK',
]);

// ---------------------------------------------------------------------------
// 5. Main conversion
// ---------------------------------------------------------------------------

function main() {
  console.log('Reading CSV...');
  const rows = parseCSV(CSV_PATH);
  console.log(`Parsed ${rows.length} rows`);

  const header = rows[0];
  const colIdx = {};
  header.forEach((h, i) => { colIdx[h] = i; });

  const players = [];
  let skipped = 0;
  let seasonIdCounter = 100; // Start from 100 for dynamic season IDs
  const seasonIdMap = new Map(); // season code → numeric ID

  // Pre-assign season IDs from our SEASONS const
  const SEASON_ID_OVERRIDES = {
    '24': 24, '23': 23, '60': 60, '67': 67, '68': 68, '69': 69, '70': 70, '71': 71, '72': 72, '73': 73,
  };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 47) { skipped++; continue; }

    const playerCode = parseInt(row[colIdx['player_code']], 10);
    const playerName = row[colIdx['player_name']];
    const salary = parseInt(row[colIdx['salary']], 10) || 0;
    const seasonCode = row[colIdx['season']];
    const position = row[colIdx['position']];
    const ovr = parseInt(row[colIdx['ovr']], 10) || 0;

    // Validate position
    if (!VALID_POSITIONS.has(position)) { skipped++; continue; }
    if (!playerCode || !playerName || !seasonCode) { skipped++; continue; }

    // Season info
    const seasonInfo = classifySeason(seasonCode);
    if (!seasonIdMap.has(seasonCode)) {
      seasonIdMap.set(seasonCode, seasonIdCounter++);
    }
    const seasonId = seasonIdMap.get(seasonCode);

    // Team info from team_colors
    const tcRaw = row[colIdx['team_colors']];
    const teamColors = parseTeamColors(tcRaw);
    const team = findTeam(teamColors);

    // Stats — Korean column names
    const spd = parseInt(row[colIdx['속력']], 10) || 0;
    const acc = parseInt(row[colIdx['가속력']], 10) || 0;
    const fin = parseInt(row[colIdx['골 결정력']], 10) || 0;
    const shp = parseInt(row[colIdx['슛 파워']], 10) || 0;
    const lon = parseInt(row[colIdx['중거리 슛']], 10) || 0;
    const pos = parseInt(row[colIdx['위치 선정']], 10) || 0;
    const vol = parseInt(row[colIdx['발리슛']], 10) || 0;
    const pen = parseInt(row[colIdx['페널티 킥']], 10) || 0;
    const pas = parseInt(row[colIdx['짧은 패스']], 10) || 0;
    const vis = parseInt(row[colIdx['시야']], 10) || 0;
    const cro = parseInt(row[colIdx['크로스']], 10) || 0;
    const lpas = parseInt(row[colIdx['긴 패스']], 10) || 0;
    const fk = parseInt(row[colIdx['프리킥']], 10) || 0;
    const cur = parseInt(row[colIdx['커브']], 10) || 0;
    const dri = parseInt(row[colIdx['드리블']], 10) || 0;
    const bal = parseInt(row[colIdx['볼 컨트롤']], 10) || 0;
    const agi = parseInt(row[colIdx['민첩성']], 10) || 0;
    const bal2 = parseInt(row[colIdx['밸런스']], 10) || 0;
    const react = parseInt(row[colIdx['반응 속도']], 10) || 0;
    const intc = parseInt(row[colIdx['대인 수비']], 10) || 0;
    const tac = parseInt(row[colIdx['태클']], 10) || 0;
    const intp = parseInt(row[colIdx['가로채기']], 10) || 0;
    const hed = parseInt(row[colIdx['헤더']], 10) || 0;
    const slid = parseInt(row[colIdx['슬라이딩 태클']], 10) || 0;
    const phy = parseInt(row[colIdx['몸싸움']], 10) || 0;
    const sta = parseInt(row[colIdx['스태미너']], 10) || 0;
    const aggr = parseInt(row[colIdx['적극성']], 10) || 0;
    const jmp = parseInt(row[colIdx['점프']], 10) || 0;
    const com = parseInt(row[colIdx['침착성']], 10) || 0;

    // GK stats
    const gkDiving = parseInt(row[colIdx['GK 다이빙']], 10) || 0;
    const gkHandling = parseInt(row[colIdx['GK 핸들링']], 10) || 0;
    const gkKicking = parseInt(row[colIdx['GK 킥']], 10) || 0;
    const gkReflexes = parseInt(row[colIdx['GK 반응속도']], 10) || 0;
    const gkPositioning = parseInt(row[colIdx['GK 위치 선정']], 10) || 0;

    // Compute composite stats
    const isGK = position === 'GK';
    const pace = isGK ? 0 : Math.round((spd + acc) / 2);
    const shooting = isGK ? 0 : Math.round((fin + shp + lon + pos + vol + pen) / 6);
    const passing = isGK ? 0 : Math.round((pas + vis + cro + lpas + fk + cur) / 6);
    const dribbling = isGK ? 0 : Math.round((dri + bal + agi + bal2 + react) / 5);
    const defending = isGK ? 0 : Math.round((intc + tac + intp + hed + slid) / 5);
    const physical = isGK ? 0 : Math.round((phy + sta + aggr + jmp + com) / 5);

    players.push({
      spid: playerCode,
      pid: Math.floor(playerCode / 10000), // Derive base pid from spid
      name: playerName,
      nameEn: playerName, // CSV only has Korean names; fallback to same
      seasonId,
      seasonName: seasonInfo.name,
      seasonSlug: seasonCode.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      cardType: seasonInfo.cardType,
      seasonYear: seasonInfo.seasonYear,
      releaseDate: '', // Not available in CSV
      position,
      teamId: team.id,
      teamName: team.nameEn,
      teamNameEn: team.nameEn,
      leagueId: team.leagueId,
      leagueName: team.leagueName,
      stats: {
        ovr,
        pace,
        shooting,
        passing,
        dribbling,
        defending,
        physical,
      },
      // Individual stats for detailed view (kept raw)
      raw: {
        속력: spd, 가속력: acc, '골 결정력': fin, '슛 파워': shp,
        '중거리 슛': lon, '위치 선정': pos, 발리슛: vol, '페널티 킥': pen,
        '짧은 패스': pas, 시야: vis, 크로스: cro, '긴 패스': lpas,
        프리킥: fk, 커브: cur, 드리블: dri, '볼 컨트롤': bal,
        민첩성: agi, 밸런스: bal2, '반응 속도': react, '대인 수비': intc,
        태클: tac, 가로채기: intp, 헤더: hed, '슬라이딩 태클': slid,
        몸싸움: phy, 스태미너: sta, 적극성: aggr, 점프: jmp, 침착성: com,
        'GK 다이빙': gkDiving, 'GK 핸들링': gkHandling, 'GK 킥': gkKicking,
        'GK 반응속도': gkReflexes, 'GK 위치 선정': gkPositioning,
      },
      price: salary > 0 ? salary * 100000 : 0, // Salary as proxy for price (BP)
      priceUpdatedAt: new Date().toISOString(),
    });
  }

  // Sort by OVR descending
  players.sort((a, b) => b.stats.ovr - a.stats.ovr);

  console.log(`Converted ${players.length} players (${skipped} skipped)`);
  console.log(`Seasons found: ${seasonIdMap.size}`);

  // Write JSON
  const json = JSON.stringify(players, null, 0);
  fs.writeFileSync(OUT_PATH, json, 'utf-8');
  const sizeMB = (Buffer.byteLength(json) / 1024 / 1024).toFixed(1);
  console.log(`Written to ${OUT_PATH} (${sizeMB} MB)`);
}

main();
