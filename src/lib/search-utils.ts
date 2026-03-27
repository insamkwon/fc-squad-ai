/**
 * Search utilities for bilingual (Korean + English) player name matching.
 *
 * Provides text normalization, tokenization, relevance scoring, and
 * Korean romanization support for robust search across both languages.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult<T> {
  item: T;
  score: number;
}

export interface SearchIndexEntry {
  /** Lowercase player name (Korean) */
  name: string;
  /** Lowercase player name (English) */
  nameEn: string;
  /** Lowercase team name (Korean) */
  teamName: string;
  /** Lowercase team name (English) */
  teamNameEn: string;
  /** Tokenized English name parts (e.g., ["heungmin", "son"]) */
  nameEnTokens: string[];
  /** Romanized Korean name (e.g., "son heungmin" for "손흥민") */
  nameRomanized: string;
  /** Tokenized romanized name parts */
  nameRomanizedTokens: string[];
  /** Combined search text for simple full-text matching */
  searchText: string;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  results: T[];
  total: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Korean → Latin Romanization Mapping
// ---------------------------------------------------------------------------

/**
 * Basic Korean Hangul syllable to romanization mapping.
 * Covers common Korean football player name syllables.
 * Not exhaustive — handles the most frequent patterns in FC Online.
 */
const HANGUL_ROMANIZATION: Record<string, string> = {
  // Common family names
  '김': 'gim', '이': 'i', '박': 'bag', '최': 'choe', '정': 'jeong',
  '강': 'gang', '조': 'jo', '윤': 'yun', '장': 'jang', '임': 'im',
  '한': 'han', '오': 'o', '서': 'seo', '신': 'sin', '권': 'gwon',
  '황': 'hwang', '안': 'an', '송': 'song', '류': 'ryu', '홍': 'hong',
  '전': 'jeon', '유': 'yu', '고': 'go', '문': 'mun', '양': 'yang',
  '백': 'baek', '손': 'son',
  // Common given name syllables
  '민': 'min', '재': 'jae', '성': 'seong', '우': 'woo', '영': 'yeong',
  '찬': 'chan', '승': 'seung', '호': 'ho', '진': 'jin', '태': 'tae',
  '현': 'hyeon', '기': 'gi', '동': 'dong', '석': 'seok', '헌': 'heon',
  '중': 'jung', '대': 'dae', '혁': 'hyeok', '상': 'sang',
  '범': 'beom', '준': 'jun', '용': 'yong', '수': 'su',
  '빈': 'bin', '국': 'guk', '환': 'hwan', '연': 'yeon', '인': 'in',
  '희': 'hui', '라': 'ra', '은': 'eun', '아': 'a',
  '철': 'cheol', '복': 'bok',
  // Multi-syllable compound matches (common Korean given name pairs)
  '강인': 'kangin', '흥민': 'heungmin',
  '민재': 'minjae', '승호': 'seungho', '우영': 'wooyoung',
  '의찬': 'euchan', '규성': 'kyusung', '재성': 'jaeseong',
  // Additional common syllables
  '병': 'byeong', '창': 'chang', '욱': 'wook', '식': 'sik',
  '도': 'do', '주': 'ju', '하': 'ha', '경': 'kyung', '섭': 'seop', '덕': 'deok',
};

/**
 * Romanize a Korean name string into Latin characters.
 * Produces space-separated syllables for proper tokenization.
 * Uses compound matching for known 2-character sequences (e.g., 흥민 → heungmin).
 * Exported for testing — not typically needed by consumers.
 */
export function romanizeKorean(korean: string): string {
  // Try full-syllable matching first (e.g., "흥민" → "heungmin")
  if (HANGUL_ROMANIZATION[korean]) {
    return HANGUL_ROMANIZATION[korean];
  }

  const chars = [...korean];
  const syllables: string[] = [];
  let i = 0;

  while (i < chars.length) {
    const code = chars[i].charCodeAt(0);

    // Non-Korean character — pass through
    if (code < 0xac00 || code > 0xd7a3) {
      syllables.push(chars[i].toLowerCase());
      i++;
      continue;
    }

    // Try 2-character compound lookup first (e.g., 흥민 → heungmin)
    if (i + 1 < chars.length) {
      const pair = chars[i] + chars[i + 1];
      if (HANGUL_ROMANIZATION[pair]) {
        syllables.push(HANGUL_ROMANIZATION[pair]);
        i += 2;
        continue;
      }
    }

    // Single character lookup
    if (HANGUL_ROMANIZATION[chars[i]]) {
      syllables.push(HANGUL_ROMANIZATION[chars[i]]);
      i++;
      continue;
    }

    // Decompose into jamo for basic romanization
    const syllableIndex = code - 0xac00;
    const initialIndex = Math.floor(syllableIndex / 588);
    const medialIndex = Math.floor((syllableIndex % 588) / 28);

    const initials = [
      'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '',
      'j', 'jj', 'ch', 'k', 't', 'p', 'h',
    ];
    const medials = [
      'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae',
      'oe', 'yo', 'u', 'weo', 'we', 'wi', 'yu', 'eu', 'ui', 'i',
    ];

    const initial = initials[initialIndex] ?? '';
    const medial = medials[medialIndex] ?? '';
    syllables.push(`${initial}${medial}`);
    i++;
  }

  return syllables.join(' ');
}

// ---------------------------------------------------------------------------
// Text Normalization & Tokenization
// ---------------------------------------------------------------------------

/**
 * Normalize a search query:
 * - Trim whitespace
 * - Collapse multiple spaces
 * - Lowercase
 * - Remove common punctuation/special chars
 */
export function normalizeQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,'"]/g, '')
    .replace(/[-–—]/g, ' ');
}

/**
 * Split a text string into searchable tokens (lowercase, no empty strings).
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,.\-–—/\\]+/)
    .filter((t) => t.length > 0);
}

/**
 * Build a search index entry for a player.
 */
export function buildSearchIndexEntry(player: {
  name: string;
  nameEn: string;
  teamName: string;
  teamNameEn: string;
}): SearchIndexEntry {
  const nameLower = player.name.toLowerCase();
  const nameEnLower = player.nameEn.toLowerCase();
  const teamNameLower = player.teamName.toLowerCase();
  const teamNameEnLower = player.teamNameEn.toLowerCase();

  const nameEnTokens = tokenize(player.nameEn);
  const nameRomanized = romanizeKorean(player.name);
  const nameRomanizedTokens = tokenize(nameRomanized);

  // Generate alternative romanization forms for common ambiguous characters.
  // e.g., 이 → "i" but also commonly "lee" or "yi" in Korean names
  const nameRomanizedAlt = generateAlternativeRomanization(player.name);
  const nameRomanizedAltTokens = tokenize(nameRomanizedAlt);

  // Combined search text includes all name variants and team names
  const searchText = [
    nameLower,
    nameEnLower,
    nameRomanized,
    nameRomanizedAlt,
    teamNameLower,
    teamNameEnLower,
    nameEnTokens.join(' '),
    nameRomanizedTokens.join(' '),
    nameRomanizedAltTokens.join(' '),
  ].join(' ');

  return {
    name: nameLower,
    nameEn: nameEnLower,
    teamName: teamNameLower,
    teamNameEn: teamNameEnLower,
    nameEnTokens,
    nameRomanized,
    nameRomanizedTokens,
    searchText,
  };
}

/**
 * Generate alternative romanization for Korean names with ambiguous characters.
 * e.g., 이 → "lee" (surname variant), 김 → "kim" (surname variant).
 * Produces space-separated syllables for proper tokenization.
 */
function generateAlternativeRomanization(korean: string): string {
  const ALTERNATIVE_MAP: Record<string, string> = {
    '이': 'lee',   // Common surname: 이 → Lee/Yi
    '김': 'kim',   // Common surname: 김 → Kim (not Gim)
    '박': 'park',  // Common surname: 박 → Park (not Bag)
    '최': 'choi',  // Common surname: 최 → Choi (not Choe)
    '정': 'jung',  // Common surname: 정 → Jung (not Jeong)
    '강': 'kang',  // 강 → Kang (not Gang)
    '조': 'cho',   // 조 → Cho
    '윤': 'yoon',  // 윤 → Yoon (not Yun)
    '장': 'jang',  // 장 → Jang
    '임': 'lim',   // 임 → Lim
    '한': 'han',   // 한 → Han
    '신': 'shin',  // 신 → Shin (not Sin)
  };

  const chars = [...korean];
  const alternatives: string[] = [];
  let i = 0;

  while (i < chars.length) {
    const code = chars[i].charCodeAt(0);

    // Non-Korean character — pass through
    if (code < 0xac00 || code > 0xd7a3) {
      alternatives.push(chars[i].toLowerCase());
      i++;
      continue;
    }

    // Try 2-character compound lookup first
    if (i + 1 < chars.length) {
      const pair = chars[i] + chars[i + 1];
      if (HANGUL_ROMANIZATION[pair]) {
        alternatives.push(HANGUL_ROMANIZATION[pair]);
        i += 2;
        continue;
      }
    }

    // Use alternative map for common surname/given name characters
    if (ALTERNATIVE_MAP[chars[i]]) {
      alternatives.push(ALTERNATIVE_MAP[chars[i]]);
      i++;
      continue;
    }

    // Fallback: use main romanization lookup
    if (HANGUL_ROMANIZATION[chars[i]]) {
      alternatives.push(HANGUL_ROMANIZATION[chars[i]]);
      i++;
      continue;
    }

    // Final fallback: decompose into jamo
    const syllableIndex = code - 0xac00;
    const initialIndex = Math.floor(syllableIndex / 588);
    const medialIndex = Math.floor((syllableIndex % 588) / 28);
    const initials = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
    const medials = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','weo','we','wi','yu','eu','ui','i'];
    const initial = initials[initialIndex] ?? '';
    const medial = medials[medialIndex] ?? '';
    alternatives.push(`${initial}${medial}`);
    i++;
  }

  return alternatives.join(' ');
}

// ---------------------------------------------------------------------------
// Relevance Scoring
// ---------------------------------------------------------------------------

/**
 * Score a search result for relevance.
 *
 * Scoring (higher = more relevant):
 * - Exact full-name match (Korean or English): 100
 * - Exact full-name match (romanized): 90
 * - First token exact match (Korean): 85
 * - First token exact match (English): 80
 * - Name starts with query: 70
 * - Name contains query: 50
 * - Token contains query: 40
 * - Team name exact match: 60
 * - Team name contains query: 30
 * - Search text contains query: 20
 */
export function scoreSearchMatch(
  entry: SearchIndexEntry,
  query: string,
  queryTokens: string[],
): number {
  const q = query.toLowerCase();

  // 1. Exact full-name match (Korean)
  if (entry.name === q) return 100;

  // 2. Exact full-name match (English)
  if (entry.nameEn === q) return 100;

  // 3. Exact full-name match (romanized Korean)
  if (entry.nameRomanized === q) return 90;

  // 4. First token exact match — Korean name
  if (queryTokens.length === 1) {
    const token = queryTokens[0];
    if (entry.name === token) return 85;
    if (entry.nameEnTokens[0] === token) return 80;
    if (entry.nameRomanizedTokens[0] === token) return 78;

    // Korean name starts with token
    if (entry.name.startsWith(token)) return 72;
    // English first name starts with token
    if (entry.nameEnTokens[0]?.startsWith(token)) return 68;
    // English last name starts with token
    if (entry.nameEnTokens[entry.nameEnTokens.length - 1]?.startsWith(token)) return 66;
  }

  // 5. Multi-token: all tokens match (exact) in English name
  if (queryTokens.length > 1) {
    const allTokensMatchEn = queryTokens.every((t) =>
      entry.nameEnTokens.some((nt) => nt === t),
    );
    if (allTokensMatchEn) return 85;

    const allTokensMatchRomanized = queryTokens.every((t) =>
      entry.nameRomanizedTokens.some((nt) => nt === t),
    );
    if (allTokensMatchRomanized) return 80;
  }

  // 6. Name starts with full query
  if (entry.name.startsWith(q)) return 70;
  if (entry.nameEn.startsWith(q)) return 68;
  if (entry.nameRomanized.startsWith(q)) return 65;

  // 7. Name contains full query
  if (entry.name.includes(q)) return 55;
  if (entry.nameEn.includes(q)) return 50;
  if (entry.nameRomanized.includes(q)) return 45;

  // 8. Any token starts with any query token (partial word matching)
  let bestTokenScore = 0;
  for (const qt of queryTokens) {
    for (const nt of entry.nameEnTokens) {
      if (nt === qt) bestTokenScore = Math.max(bestTokenScore, 45);
      else if (nt.startsWith(qt)) bestTokenScore = Math.max(bestTokenScore, 38);
      else if (nt.includes(qt)) bestTokenScore = Math.max(bestTokenScore, 28);
    }
    for (const nt of entry.nameRomanizedTokens) {
      if (nt === qt) bestTokenScore = Math.max(bestTokenScore, 42);
      else if (nt.startsWith(qt)) bestTokenScore = Math.max(bestTokenScore, 35);
      else if (nt.includes(qt)) bestTokenScore = Math.max(bestTokenScore, 25);
    }
  }
  if (bestTokenScore > 0) return bestTokenScore;

  // 9. Team name matches
  if (entry.teamName === q) return 60;
  if (entry.teamNameEn === q) return 58;
  if (entry.teamName.includes(q)) return 30;
  if (entry.teamNameEn.includes(q)) return 28;

  // 10. Search text contains query (catch-all)
  if (entry.searchText.includes(q)) return 15;

  return 0;
}

// ---------------------------------------------------------------------------
// Paginated Search
// ---------------------------------------------------------------------------

/**
 * Apply pagination to a scored results array.
 */
export function paginateResults<T>(
  scoredResults: SearchResult<T>[],
  options: PaginationOptions = {},
): PaginatedResult<T> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  // Sort by score descending, then return the page
  const sorted = scoredResults.sort((a, b) => b.score - a.score);
  const results = sorted.slice(offset, offset + limit).map((r) => r.item);

  return {
    results,
    total: sorted.length,
    limit,
    offset,
  };
}
