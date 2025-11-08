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
      teamId: number;
      teamPosition?: string;
      visionScore?: number;
      wardsPlaced?: number;
      wardsKilled?: number;
      detectorWardsPlaced?: number;
      turretTakedowns?: number;
      dragonKills?: number;
      baronKills?: number;
      damageDealtToObjectives?: number;
      totalDamageDealtToChampions?: number;
      totalTimeSpentDead?: number;
      totalHealsOnTeammates?: number;
      totalDamageShieldedOnTeammates?: number;
      timeCCingOthers?: number;
      challenges?: {
        soloKills?: number;
        multikills?: number;
        effectiveHealAndShielding?: number;
        killParticipation?: number;
        teamDamagePercentage?: number;
      };
      perks: {
        styles: Array<{
          style?: number; // Style ID (e.g., 8000 for Precision, 8100 for Domination)
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
