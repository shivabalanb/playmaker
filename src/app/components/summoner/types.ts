export interface MatchData {
  metadata: {
    matchId: string;
  };
  info: {
    queueId: number;
    gameDuration: number;
    gameCreation: number;
    participants: Array<{
      puuid: string;
      championName: string;
      kills: number;
      deaths: number;
      assists: number;
      win: boolean;
      goldEarned: number;
      totalMinionsKilled: number;
      neutralMinionsKilled: number;
      item0: number;
      item1: number;
      item2: number;
      item3: number;
      item4: number;
      item5: number;
      item6: number;
      summoner1Id: number;
      summoner2Id: number;
      perks: {
        styles: Array<{
          selections: Array<{
            perk: number;
          }>;
        }>;
      };
    }>;
  };
}

export interface SummonerData {
  profileIconId: number;
  summonerLevel: number;
  id: string;
}

export interface RankData {
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
}

export interface ChampionStats {
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
}
