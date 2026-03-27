import { Player, CardType, SEASONS } from '@/types/player';

/** Resolve season metadata fields from SEASONS lookup, with safe defaults. */
function seasonMeta(seasonId: number) {
  const s = SEASONS[seasonId];
  return {
    seasonSlug: s?.slug ?? `season-${seasonId}`,
    cardType: s?.cardType ?? 'BASE' as CardType,
    seasonYear: s?.seasonYear ?? '',
    releaseDate: s?.releaseDate ?? '2024-01-01',
  };
}

// Mock player data for development. Will be replaced by details.csv seed data.
export const MOCK_PLAYERS: Player[] = [
  // --- 손흥민: 3 season card variants (TOTNUCL 24/25, HOT, ICON) ---
  {
    spid: 101001101, pid: 101001, name: '손흥민', nameEn: 'Heungmin Son',
    seasonId: 68, seasonName: 'TOTNUCL (24/25)', position: 'LW',
    teamId: 1, teamName: '토트넘', teamNameEn: 'Tottenham',
    leagueId: 1, leagueName: '프리미어리그',
    stats: { ovr: 92, pace: 91, shooting: 84, passing: 80, dribbling: 89, defending: 36, physical: 68 },
    price: 5200000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(68),
  },
  {
    spid: 101001102, pid: 101001, name: '손흥민', nameEn: 'Heungmin Son',
    seasonId: 60, seasonName: 'HOT', position: 'LW',
    teamId: 1, teamName: '토트넘', teamNameEn: 'Tottenham',
    leagueId: 1, leagueName: '프리미어리그',
    stats: { ovr: 90, pace: 89, shooting: 82, passing: 79, dribbling: 88, defending: 34, physical: 67 },
    price: 3800000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(60),
  },
  {
    spid: 101001103, pid: 101001, name: '손흥민', nameEn: 'Heungmin Son',
    seasonId: 69, seasonName: 'ICON', position: 'LW',
    teamId: 1, teamName: '토트넘', teamNameEn: 'Tottenham',
    leagueId: 1, leagueName: '프리미어리그',
    stats: { ovr: 95, pace: 94, shooting: 88, passing: 83, dribbling: 92, defending: 38, physical: 72 },
    price: 8500000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(69),
  },
  // --- 이강인: 2 season card variants (TOTNUCL 24/25, TOTNUCL 23/24) ---
  {
    spid: 102001102, pid: 102001, name: '이강인', nameEn: 'Kangin Lee',
    seasonId: 68, seasonName: 'TOTNUCL (24/25)', position: 'CM',
    teamId: 5, teamName: '파리 생제르맹', teamNameEn: 'Paris Saint-Germain',
    leagueId: 2, leagueName: '리그 1',
    stats: { ovr: 85, pace: 78, shooting: 76, passing: 84, dribbling: 87, defending: 65, physical: 72 },
    price: 1800000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(68),
  },
  {
    spid: 102001103, pid: 102001, name: '이강인', nameEn: 'Kangin Lee',
    seasonId: 67, seasonName: 'TOTNUCL (23/24)', position: 'CM',
    teamId: 5, teamName: '파리 생제르맹', teamNameEn: 'Paris Saint-Germain',
    leagueId: 2, leagueName: '리그 1',
    stats: { ovr: 82, pace: 76, shooting: 73, passing: 81, dribbling: 85, defending: 63, physical: 70 },
    price: 1100000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(67),
  },
  // --- 김민재: 2 season card variants (TOTNUCL 24/25, HOT) ---
  {
    spid: 103001103, pid: 103001, name: '김민재', nameEn: 'Minjae Kim',
    seasonId: 68, seasonName: 'TOTNUCL (24/25)', position: 'CB',
    teamId: 3, teamName: '바이에른 뮌헨', teamNameEn: 'Bayern Munich',
    leagueId: 3, leagueName: '분데스리가',
    stats: { ovr: 89, pace: 82, shooting: 48, passing: 65, dribbling: 70, defending: 92, physical: 85 },
    price: 3200000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(68),
  },
  {
    spid: 103001104, pid: 103001, name: '김민재', nameEn: 'Minjae Kim',
    seasonId: 60, seasonName: 'HOT', position: 'CB',
    teamId: 3, teamName: '바이에른 뮌헨', teamNameEn: 'Bayern Munich',
    leagueId: 3, leagueName: '분데스리가',
    stats: { ovr: 87, pace: 80, shooting: 46, passing: 63, dribbling: 68, defending: 90, physical: 83 },
    price: 2400000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(60),
  },
  {
    spid: 104001104, pid: 104001, name: '황의찬', nameEn: 'Euichan Hwang',
    seasonId: 67, seasonName: 'TOTNUCL (23/24)', position: 'ST',
    teamId: 10, teamName: '셀틱', teamNameEn: 'Celtic',
    leagueId: 4, leagueName: '스코티시 프리미어십',
    stats: { ovr: 79, pace: 90, shooting: 78, passing: 62, dribbling: 79, defending: 34, physical: 72 },
    price: 850000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(67),
  },
  {
    spid: 105001105, pid: 105001, name: '조규성', nameEn: 'Kyusung Cho',
    seasonId: 67, seasonName: 'TOTNUCL (23/24)', position: 'GK',
    teamId: 6, teamName: '알샤르', teamNameEn: 'Al Shabab',
    leagueId: 5, leagueName: '사우디 프로리그',
    stats: { ovr: 76, pace: 42, shooting: 15, passing: 38, dribbling: 30, defending: 28, physical: 72 },
    price: 350000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(67),
  },
  {
    spid: 201001201, pid: 201001, name: '음바페', nameEn: 'Kylian Mbappe',
    seasonId: 69, seasonName: 'ICON', position: 'ST',
    teamId: 20, teamName: '레알 마드리드', teamNameEn: 'Real Madrid',
    leagueId: 6, leagueName: '라리가',
    stats: { ovr: 95, pace: 97, shooting: 92, passing: 80, dribbling: 93, defending: 35, physical: 78 },
    price: 8500000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(69),
  },
  {
    spid: 202001202, pid: 202001, name: '할랜드', nameEn: 'Erling Haaland',
    seasonId: 69, seasonName: 'ICON', position: 'ST',
    teamId: 21, teamName: '맨체스터 시티', teamNameEn: 'Manchester City',
    leagueId: 1, leagueName: '프리미어리그',
    stats: { ovr: 93, pace: 89, shooting: 95, passing: 65, dribbling: 80, defending: 45, physical: 88 },
    price: 7800000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(69),
  },
  {
    spid: 203001203, pid: 203001, name: '살라', nameEn: 'Mohamed Salah',
    seasonId: 69, seasonName: 'ICON', position: 'RW',
    teamId: 22, teamName: '리버풀', teamNameEn: 'Liverpool',
    leagueId: 1, leagueName: '프리미어리그',
    stats: { ovr: 90, pace: 93, shooting: 87, passing: 82, dribbling: 90, defending: 45, physical: 75 },
    price: 5500000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(69),
  },
  {
    spid: 204001204, pid: 204001, name: '드 브라위너', nameEn: 'Virgil van Dijk',
    seasonId: 68, seasonName: 'TOTNUCL (24/25)', position: 'CB',
    teamId: 22, teamName: '리버풀', teamNameEn: 'Liverpool',
    leagueId: 1, leagueName: '프리미어리그',
    stats: { ovr: 90, pace: 75, shooting: 55, passing: 70, dribbling: 72, defending: 93, physical: 86 },
    price: 3500000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(68),
  },
  {
    spid: 205001205, pid: 205001, name: '데 흐아이', nameEn: 'Frenkie de Jong',
    seasonId: 68, seasonName: 'TOTNUCL (24/25)', position: 'CM',
    teamId: 20, teamName: 'FC 바르셀로나', teamNameEn: 'FC Barcelona',
    leagueId: 6, leagueName: '라리가',
    stats: { ovr: 88, pace: 74, shooting: 72, passing: 92, dribbling: 90, defending: 80, physical: 78 },
    price: 2800000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(68),
  },
  {
    spid: 206001206, pid: 206001, name: '알리송', nameEn: 'Alisson Becker',
    seasonId: 68, seasonName: 'TOTNUCL (24/25)', position: 'GK',
    teamId: 22, teamName: '리버풀', teamNameEn: 'Liverpool',
    leagueId: 1, leagueName: '프리미어리그',
    stats: { ovr: 90, pace: 48, shooting: 18, passing: 42, dribbling: 25, defending: 30, physical: 82 },
    price: 2200000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(68),
  },
  {
    spid: 207001207, pid: 207001, name: '빈시투스', nameEn: 'Vinicius Junior',
    seasonId: 69, seasonName: 'ICON', position: 'LW',
    teamId: 20, teamName: '레알 마드리드', teamNameEn: 'Real Madrid',
    leagueId: 6, leagueName: '라리가',
    stats: { ovr: 92, pace: 95, shooting: 82, passing: 78, dribbling: 95, defending: 30, physical: 62 },
    price: 6000000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(69),
  },
  {
    spid: 208001208, pid: 208001, name: '벨링엄', nameEn: 'Jude Bellingham',
    seasonId: 68, seasonName: 'TOTNUCL (24/25)', position: 'CAM',
    teamId: 20, teamName: '레알 마드리드', teamNameEn: 'Real Madrid',
    leagueId: 6, leagueName: '라리가',
    stats: { ovr: 89, pace: 78, shooting: 82, passing: 85, dribbling: 87, defending: 75, physical: 82 },
    price: 4200000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(68),
  },
  {
    spid: 209001209, pid: 209001, name: '루카쿠', nameEn: 'Romelu Lukaku',
    seasonId: 67, seasonName: 'TOTNUCL (23/24)', position: 'ST',
    teamId: 7, teamName: '첼시', teamNameEn: 'Chelsea',
    leagueId: 1, leagueName: '프리미어리그',
    stats: { ovr: 84, pace: 82, shooting: 86, passing: 62, dribbling: 78, defending: 35, physical: 88 },
    price: 1200000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(67),
  },
  {
    spid: 210001210, pid: 210001, name: '디布鲁노', nameEn: 'Bruno Fernandes',
    seasonId: 68, seasonName: 'TOTNUCL (24/25)', position: 'CAM',
    teamId: 23, teamName: '맨체스터 유나이티드', teamNameEn: 'Manchester United',
    leagueId: 1, leagueName: '프리미어리그',
    stats: { ovr: 88, pace: 72, shooting: 84, passing: 90, dribbling: 86, defending: 68, physical: 76 },
    price: 2400000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(68),
  },
  {
    spid: 211001211, pid: 211001, name: '페드리', nameEn: 'Pedri',
    seasonId: 68, seasonName: 'TOTNUCL (24/25)', position: 'CM',
    teamId: 20, teamName: 'FC 바르셀로나', teamNameEn: 'FC Barcelona',
    leagueId: 6, leagueName: '라리가',
    stats: { ovr: 87, pace: 72, shooting: 70, passing: 90, dribbling: 89, defending: 72, physical: 65 },
    price: 2100000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(68),
  },
  {
    spid: 212001212, pid: 212001, name: '아르누', nameEn: 'Arnold',
    seasonId: 68, seasonName: 'TOTNUCL (24/25)', position: 'RB',
    teamId: 22, teamName: '리버풀', teamNameEn: 'Liverpool',
    leagueId: 1, leagueName: '프리미어리그',
    stats: { ovr: 85, pace: 78, shooting: 68, passing: 86, dribbling: 78, defending: 78, physical: 74 },
    price: 1500000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(68),
  },
  {
    spid: 213001213, pid: 213001, name: '로버트슨', nameEn: 'Andrew Robertson',
    seasonId: 67, seasonName: 'TOTNUCL (23/24)', position: 'LB',
    teamId: 22, teamName: '리버풀', teamNameEn: 'Liverpool',
    leagueId: 1, leagueName: '프리미어리그',
    stats: { ovr: 82, pace: 78, shooting: 55, passing: 80, dribbling: 75, defending: 82, physical: 76 },
    price: 900000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(67),
  },
  {
    spid: 214001214, pid: 214001, name: '카네이로', nameEn: 'Rodri',
    seasonId: 69, seasonName: 'ICON', position: 'CDM',
    teamId: 21, teamName: '맨체스터 시티', teamNameEn: 'Manchester City',
    leagueId: 1, leagueName: '프리미어리그',
    stats: { ovr: 91, pace: 62, shooting: 72, passing: 88, dribbling: 85, defending: 88, physical: 84 },
    price: 4500000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(69),
  },
  {
    spid: 215001215, pid: 215001, name: '에데르송', nameEn: 'Eder Militao',
    seasonId: 68, seasonName: 'TOTNUCL (24/25)', position: 'CB',
    teamId: 20, teamName: '레알 마드리드', teamNameEn: 'Real Madrid',
    leagueId: 6, leagueName: '라리가',
    stats: { ovr: 86, pace: 80, shooting: 42, passing: 58, dribbling: 62, defending: 88, physical: 82 },
    price: 1600000000, priceUpdatedAt: '2026-03-27',
    ...seasonMeta(68),
  },
];

// Generate more mock players for search/filter testing.
// Each base player (unique pid) gets 1–3 season card variants (unique spids)
// so that searching for a name returns separate entries per season card.
export function generateMockPlayers(count: number = 200): Player[] {
  const teams = [
    { id: 1, name: '토트넘', nameEn: 'Tottenham', league: '프리미어리그', leagueId: 1 },
    { id: 21, name: '맨체스터 시티', nameEn: 'Manchester City', league: '프리미어리그', leagueId: 1 },
    { id: 22, name: '리버풀', nameEn: 'Liverpool', league: '프리미어리그', leagueId: 1 },
    { id: 23, name: '맨체스터 유나이티드', nameEn: 'Manchester United', league: '프리미어리그', leagueId: 1 },
    { id: 20, name: '레알 마드리드', nameEn: 'Real Madrid', league: '라리가', leagueId: 6 },
    { id: 30, name: 'FC 바르셀로나', nameEn: 'FC Barcelona', league: '라리가', leagueId: 6 },
    { id: 3, name: '바이에른 뮌헨', nameEn: 'Bayern Munich', league: '분데스리가', leagueId: 3 },
    { id: 5, name: '파리 생제르맹', nameEn: 'Paris Saint-Germain', league: '리그 1', leagueId: 2 },
    { id: 40, name: '인터 밀라노', nameEn: 'Inter Milan', league: '세리에 A', leagueId: 7 },
    { id: 41, name: '유벤투스', nameEn: 'Juventus', league: '세리에 A', leagueId: 7 },
  ];

  const positions: Array<{ pos: string; ovrRange: [number, number] }> = [
    { pos: 'ST', ovrRange: [75, 95] },
    { pos: 'CF', ovrRange: [76, 93] },
    { pos: 'LW', ovrRange: [74, 92] },
    { pos: 'RW', ovrRange: [74, 92] },
    { pos: 'CAM', ovrRange: [74, 90] },
    { pos: 'CM', ovrRange: [72, 89] },
    { pos: 'CDM', ovrRange: [74, 91] },
    { pos: 'LM', ovrRange: [72, 88] },
    { pos: 'RM', ovrRange: [72, 88] },
    { pos: 'LB', ovrRange: [72, 88] },
    { pos: 'RB', ovrRange: [72, 88] },
    { pos: 'CB', ovrRange: [72, 92] },
    { pos: 'GK', ovrRange: [72, 90] },
  ];

  const seasons = [
    { id: 67, name: 'TOTNUCL (23/24)' },
    { id: 68, name: 'TOTNUCL (24/25)' },
    { id: 69, name: 'ICON' },
    { id: 60, name: 'HOT' },
  ];

  // name (Korean) ↔ nameEn (English) pairs
  // Includes Korean K-League players, European-based Koreans, and global stars
  const namePairs = [
    // Korean players
    { name: '손흥민', nameEn: 'Heungmin Son' },
    { name: '이강인', nameEn: 'Kangin Lee' },
    { name: '김민재', nameEn: 'Minjae Kim' },
    { name: '황의찬', nameEn: 'Euichan Hwang' },
    { name: '백승호', nameEn: 'Seungho Baek' },
    { name: '정우영', nameEn: 'Wooyoung Jung' },
    { name: '이승우', nameEn: 'Seungwoo Lee' },
    { name: '조규성', nameEn: 'Kyusung Cho' },
    { name: '황희찬', nameEn: 'Heechan Hwang' },
    { name: '이재성', nameEn: 'Jaeseong Lee' },
    { name: '권창훈', nameEn: 'Changhoon Kwon' },
    { name: '오세훈', nameEn: 'Sehun Oh' },
    { name: '서재석', nameEn: 'Jaeseok Seo' },
    { name: '조현우', nameEn: 'Hyunwoo Jo' },
    { name: '김영권', nameEn: 'Younggwon Kim' },
    { name: '김치열', nameEn: 'Chiyeol Kim' },
    { name: '윤재호', nameEn: 'Jaeho Yoon' },
    // International stars
    { name: '음바페', nameEn: 'Kylian Mbappe' },
    { name: '할랜드', nameEn: 'Erling Haaland' },
    { name: '살라', nameEn: 'Mohamed Salah' },
    { name: '드 브라위너', nameEn: 'Kevin De Bruyne' },
    { name: '데 흐아이', nameEn: 'Frenkie de Jong' },
    { name: '알리송', nameEn: 'Alisson Becker' },
    { name: '빈시투스', nameEn: 'Vinicius Junior' },
    { name: '벨링엄', nameEn: 'Jude Bellingham' },
    { name: '루카쿠', nameEn: 'Romelu Lukaku' },
    { name: '디 브루노', nameEn: 'Bruno Fernandes' },
    { name: '페드리', nameEn: 'Pedri' },
    { name: '로버트슨', nameEn: 'Andrew Robertson' },
    { name: '카네이로', nameEn: 'Rodri' },
    { name: '에데르송', nameEn: 'Eder Militao' },
    { name: '메시', nameEn: 'Lionel Messi' },
    { name: '호날두', nameEn: 'Cristiano Ronaldo' },
    { name: '사카', nameEn: 'Bukayo Saka' },
    { name: '무萨拉', nameEn: 'Mohamed Musa' },
    { name: '뎀벨레', nameEn: 'Ousmane Dembele' },
    { name: '레반도프스키', nameEn: 'Robert Lewandowski' },
    { name: '놀퍼트', nameEn: 'Nordi Mukiele' },
    { name: '케인', nameEn: 'Harry Kane' },
    { name: '데이비스', nameEn: 'Alphonso Davies' },
  ];

  const players: Player[] = [...MOCK_PLAYERS];
  const seed = 42;

  // Deterministic pseudo-random from seed
  let randState = seed;
  const rand = (min: number, max: number) => {
    randState = (randState * 16807 + 0) % 2147483647;
    return Math.floor((randState / 2147483647) * (max - min + 1)) + min;
  };

  // Create season card variants per base player.
  // Each base player (pid) gets 1–3 different season cards.
  let spidCounter = 300001001;
  let pidCounter = 300001;

  while (players.length < count) {
    const team = teams[rand(0, teams.length - 1)];
    const posInfo = positions[rand(0, positions.length - 1)];
    const namePair = namePairs[rand(0, namePairs.length - 1)];
    const pid = pidCounter++;
    const baseOvr = rand(posInfo.ovrRange[0], posInfo.ovrRange[1]);

    // Pick 1–3 unique seasons for this player's variants
    const variantCount = rand(1, 3);
    const shuffledSeasons = [...seasons].sort(() => rand(0, 100) - 50);
    const pickedSeasons = shuffledSeasons.slice(0, variantCount);

    for (const season of pickedSeasons) {
      if (players.length >= count) break;

      // Special/ICON cards get a stat boost, base cards stay at baseOvr
      const ovrBoost = season.id === 69 ? rand(2, 5) : season.id !== 24 && season.id !== 23 ? rand(1, 4) : 0;
      const ovr = Math.min(99, baseOvr + ovrBoost);
      const meta = seasonMeta(season.id);

      players.push({
        spid: spidCounter++,
        pid,                              // shared across all variants of this player
        name: namePair.name,              // plain base name — no season suffix
        nameEn: namePair.nameEn,          // plain English name
        seasonId: season.id,
        seasonName: season.name,          // season info is a separate field
        position: posInfo.pos as Player['position'],
        teamId: team.id,
        teamName: team.name,
        teamNameEn: team.nameEn,
        leagueId: team.leagueId,
        leagueName: team.league,
        stats: {
          ovr,
          pace: Math.min(99, Math.max(40, ovr + rand(-15, 10))),
          shooting: Math.min(99, Math.max(30, ovr + rand(-15, 10))),
          passing: Math.min(99, Math.max(30, ovr + rand(-20, 10))),
          dribbling: Math.min(99, Math.max(30, ovr + rand(-15, 10))),
          defending: Math.min(99, Math.max(25, ovr + rand(-25, 5))),
          physical: Math.min(99, Math.max(40, ovr + rand(-10, 10))),
        },
        price: rand(100000000, 8000000000),
        priceUpdatedAt: '2026-03-27',
        ...meta,
      });
    }
  }

  return players;
}
