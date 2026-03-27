/**
 * Season code classifier for FC Online season codes.
 *
 * Maps FC Online season codes (e.g., '24KL', 'LIVE', 'TOTY24') to
 * our internal CardType + display info.
 */

export interface SeasonInfo {
  cardType: 'BASE' | 'SPECIAL' | 'ICON' | 'LIVE' | 'MOM' | 'POTW';
  name: string;
  nameEn: string;
  seasonYear: string;
}

/**
 * Map FC Online season codes to our CardType + display info.
 */
export function classifySeason(code: string): SeasonInfo {
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

  // K League boost (24KLB, 23KLB) — must check before base KL
  if (/\d{2}KLB/.test(c)) {
    const y = c.replace('KLB', '');
    return { cardType: 'SPECIAL', name: `K리그 부스트 (20${y})`, nameEn: `K League Boost (20${y})`, seasonYear: y };
  }

  // K League base (24KL, 23KL, etc.)
  if (/\d{2}KL$/.test(c)) {
    const y = c.replace('KL', '');
    return { cardType: 'BASE', name: `K리그 베이스 (20${y})`, nameEn: `K League Base (20${y})`, seasonYear: y };
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
  const specials: Record<string, string> = {
    'BDO': "Ballon d'Or", 'BLD': 'Build Up', 'BTB': 'Back to Back',
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
    if (specials[c]) {
      return { cardType: 'SPECIAL', name: specials[c], nameEn: specials[c], seasonYear: c.substring(0, 2) };
    }
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

function extractYear(code: string): string {
  const match = code.match(/^(\d{2})/);
  return match ? match[1] : '';
}
