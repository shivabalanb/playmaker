// Position-specific weights for different metrics
const roleWeights = {
  TOP: {
    combat: 0.35,
    economy: 0.25,
    vision: 0.10,
    objectives: 0.15,
    survivability: 0.10,
    utility: 0.05,
  },
  JUNGLE: {
    combat: 0.25,
    economy: 0.15,
    vision: 0.20,
    objectives: 0.30,
    survivability: 0.05,
    utility: 0.05,
  },
  MIDDLE: {
    combat: 0.40,
    economy: 0.25,
    vision: 0.10,
    objectives: 0.10,
    survivability: 0.10,
    utility: 0.05,
  },
  BOTTOM: {
    combat: 0.40,
    economy: 0.30,
    vision: 0.05,
    objectives: 0.15,
    survivability: 0.08,
    utility: 0.02,
  },
  UTILITY: {
    combat: 0.15,
    economy: 0.10,
    vision: 0.25,
    objectives: 0.10,
    survivability: 0.25,
    utility: 0.15,
  },
};

interface Participant {
  puuid: string;
  teamId: number;
  teamPosition?: string;
  kills: number;
  deaths: number;
  assists: number;
  goldEarned: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
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
}

function calculateCombatScore(
  player: Participant,
  teamAvg: { kda: number; dmgShare: number }
): number {
  const kda =
    player.deaths > 0
      ? (player.kills + player.assists) / player.deaths
      : player.kills + player.assists;
  const killPart = player.challenges?.killParticipation || 0;
  const dmgShare = player.challenges?.teamDamagePercentage || 0;
  const soloKills = player.challenges?.soloKills || 0;
  const multikills = player.challenges?.multikills || 0;

  // Normalize against team average
  const kdaScore = Math.min((kda / (teamAvg.kda || 1)) * 50, 50);
  const killPartScore = killPart * 25;
  const dmgScore = dmgShare * 100;
  const bonusScore = Math.min(soloKills * 2 + multikills * 3, 15);

  return Math.min(kdaScore + killPartScore + dmgScore * 0.2 + bonusScore, 100);
}

function calculateEconomyScore(
  player: Participant,
  teamAvg: { gpm: number },
  gameDuration: number
): number {
  const gpm = (player.goldEarned / gameDuration) * 60;
  const cs = player.totalMinionsKilled + player.neutralMinionsKilled;
  const csPerMin = cs / (gameDuration / 60);

  const gpmScore = Math.min((gpm / (teamAvg.gpm || 1)) * 50, 60);
  const csScore = Math.min(csPerMin * 3, 40);

  return Math.min(gpmScore + csScore, 100);
}

function calculateVisionScore(
  player: Participant,
  teamAvg: { visionPerMin: number },
  gameDuration: number
): number {
  const visionPerMin =
    player.visionScore && gameDuration
      ? player.visionScore / (gameDuration / 60)
      : 0;
  const wardsPlaced = player.wardsPlaced || 0;
  const wardsKilled = player.wardsKilled || 0;
  const controlWards = player.detectorWardsPlaced || 0;

  const visionScore = Math.min(
    (visionPerMin / (teamAvg.visionPerMin || 1)) * 50,
    50
  );
  const wardScore = Math.min(
    (wardsPlaced / 2 + wardsKilled * 2 + controlWards * 3),
    50
  );

  return Math.min(visionScore + wardScore, 100);
}

function calculateObjectiveScore(
  player: Participant,
  teamTotal: { objDmg: number }
): number {
  const turrets = player.turretTakedowns || 0;
  const dragons = player.dragonKills || 0;
  const barons = player.baronKills || 0;
  const objDmg = player.damageDealtToObjectives || 0;

  const turretScore = Math.min(turrets * 8, 40);
  const epicScore = dragons * 15 + barons * 20;
  const dmgScore = Math.min((objDmg / (teamTotal.objDmg || 1)) * 30, 30);

  return Math.min(turretScore + epicScore + dmgScore, 100);
}

function calculateSurvivabilityScore(
  player: Participant,
  teamAvg: { deaths: number },
  gameDuration: number
): number {
  const deaths = player.deaths || 0;
  const timeSpentDead = player.totalTimeSpentDead || 0;
  const deathPenalty = deaths * 8;
  const deadTimePenalty = (timeSpentDead / gameDuration) * 100;

  // Estimate damage taken percentage (not always available)
  const damageTaken = 0; // player.damageTakenOnTeamPercentage || 0;
  const tankScore =
    player.teamPosition === "UTILITY" || player.teamPosition === "TOP"
      ? damageTaken * 50
      : 0;

  return Math.max(100 - deathPenalty - deadTimePenalty + tankScore, 0);
}

function calculateUtilityScore(player: Participant): number {
  const healing = player.totalHealsOnTeammates || 0;
  const shielding = player.totalDamageShieldedOnTeammates || 0;
  const cc = player.timeCCingOthers || 0;
  const effectiveHS = player.challenges?.effectiveHealAndShielding || 0;

  const healScore = Math.min((healing + shielding + effectiveHS) / 100, 40);
  const ccScore = Math.min(cc * 2, 60);

  return Math.min(healScore + ccScore, 100);
}

function calculateTeamAverages(team: Participant[], gameDuration: number) {
  const count = team.length;
  return {
    kda:
      team.reduce(
        (sum, p) =>
          sum +
          (p.deaths > 0
            ? (p.kills + p.assists) / p.deaths
            : p.kills + p.assists),
        0
      ) / count,
    gpm:
      team.reduce(
        (sum, p) => sum + (p.goldEarned / gameDuration) * 60,
        0
      ) / count,
    visionPerMin:
      team.reduce(
        (sum, p) =>
          sum + (p.visionScore ? p.visionScore / (gameDuration / 60) : 0),
        0
      ) / count,
    objDmg: team.reduce(
      (sum, p) => sum + (p.damageDealtToObjectives || 0),
      0
    ),
    dmgShare:
      team.reduce(
        (sum, p) => sum + (p.challenges?.teamDamagePercentage || 0),
        0
      ) / count,
    deaths: team.reduce((sum, p) => sum + p.deaths, 0) / count,
  };
}

export function calculatePlayerScore(
  player: Participant,
  team: Participant[],
  gameDuration: number
): {
  total: number;
  breakdown: {
    combat: number;
    economy: number;
    vision: number;
    objectives: number;
    survivability: number;
    utility: number;
  };
} {
  const role = player.teamPosition || "MIDDLE";
  const weights = roleWeights[role as keyof typeof roleWeights] || roleWeights.MIDDLE;
  const teamAvg = calculateTeamAverages(team, gameDuration);

  const combat = calculateCombatScore(player, {
    kda: teamAvg.kda,
    dmgShare: teamAvg.dmgShare,
  });
  const economy = calculateEconomyScore(player, { gpm: teamAvg.gpm }, gameDuration);
  const vision = calculateVisionScore(
    player,
    { visionPerMin: teamAvg.visionPerMin },
    gameDuration
  );
  const objectives = calculateObjectiveScore(player, { objDmg: teamAvg.objDmg });
  const survivability = calculateSurvivabilityScore(
    player,
    { deaths: teamAvg.deaths },
    gameDuration
  );
  const utility = calculateUtilityScore(player);

  const finalScore =
    combat * weights.combat +
    economy * weights.economy +
    vision * weights.vision +
    objectives * weights.objectives +
    survivability * weights.survivability +
    utility * weights.utility;

  return {
    total: Math.round(finalScore),
    breakdown: {
      combat: Math.round(combat),
      economy: Math.round(economy),
      vision: Math.round(vision),
      objectives: Math.round(objectives),
      survivability: Math.round(survivability),
      utility: Math.round(utility),
    },
  };
}

export function calculatePlayerRank(
  playerPuuid: string,
  participants: Participant[],
  gameDuration: number
): { score: number; rank: number } {
  // Separate teams
  const team100 = participants.filter((p) => p.teamId === 100);
  const team200 = participants.filter((p) => p.teamId === 200);

  // Calculate scores for all players
  const allScores = participants.map((p) => ({
    puuid: p.puuid,
    score: calculatePlayerScore(
      p,
      p.teamId === 100 ? team100 : team200,
      gameDuration
    ).total,
  }));

  // Sort by score descending
  allScores.sort((a, b) => b.score - a.score);

  // Find player's rank
  const playerIndex = allScores.findIndex((p) => p.puuid === playerPuuid);
  const playerScore = allScores[playerIndex]?.score || 0;

  return {
    score: playerScore,
    rank: playerIndex + 1,
  };
}

