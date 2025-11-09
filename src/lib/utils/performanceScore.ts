// Position-specific weights for different metrics
const roleWeights = {
  TOP: {
    combat: 0.30,
    economy: 0.25,
    earlyLane: 0.15,
    vision: 0.10,
    objectives: 0.00,
    survivability: 0.15,
    utility: 0.05,
  },
  JUNGLE: {
    combat: 0.25,
    economy: 0.25,
    earlyLane: 0.10,
    vision: 0.20,
    objectives: 0.10,
    survivability: 0.05,
    utility: 0.05,
  },
  MIDDLE: {
    combat: 0.25,
    economy: 0.25,
    earlyLane: 0.15,
    vision: 0.10,
    objectives: 0.0,
    survivability: 0.20,
    utility: 0.05,
  },
  BOTTOM: {
    combat: 0.20,
    economy: 0.25,
    earlyLane: 0.15,
    vision: 0.05,
    objectives: 0.0,
    survivability: 0.35,
    utility: 0.00,
  },
  UTILITY: {
    combat: 0.15,
    economy: 0.10,
    earlyLane: 0.05,
    vision: 0.25,
    objectives: 0.10,
    survivability: 0.20,
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
  damageDealtToTurrets?: number;
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
    earlyLaningPhaseGoldExpAdvantage?: number;
    laningPhaseGoldExpAdvantage?: number;
    laneMinionsFirst10Minutes?: number;
    killsOnOtherLanesEarlyJungleAsLaner?: number;
    killsOnOtherLanesEarlyJungleAsJungler?: number;
    epicMonsterSteals?: number;
  };
}

// Convert z-score to a score centered at 70 with range ~30-100
function zScoreToDistribution(zScore: number, center = 70, scale = 12): number {
  // Clamp z-score to reasonable range (-3 to 3)
  const clampedZ = Math.max(-3, Math.min(3, zScore));
  return center + clampedZ * scale;
}

// Calculate z-score (standard deviations from mean)
function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

// Calculate standard deviation
function calculateStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function calculateEarlyLaneScore(
  player: Participant,
  team: Participant[],
  opponent: Participant | null,
  gameDuration: number
): number {
  const role = player.teamPosition || "MIDDLE";
  const isJungle = role === "JUNGLE";
  
  const earlyAdvantage = player.challenges?.earlyLaningPhaseGoldExpAdvantage ?? 0;
  const laningAdvantage = player.challenges?.laningPhaseGoldExpAdvantage ?? 0;
  const cs10Min = player.challenges?.laneMinionsFirst10Minutes ?? 0;
  const roamKills = isJungle 
    ? (player.challenges?.killsOnOtherLanesEarlyJungleAsJungler ?? 0)
    : (player.challenges?.killsOnOtherLanesEarlyJungleAsLaner ?? 0);

  // Calculate team stats for normalization
  const teamEarlyAdv = team.map(p => p.challenges?.earlyLaningPhaseGoldExpAdvantage ?? 0);
  const meanEarlyAdv = teamEarlyAdv.reduce((a, b) => a + b, 0) / teamEarlyAdv.length;
  const stdDevEarlyAdv = calculateStdDev(teamEarlyAdv, meanEarlyAdv);

  // Base score from early advantage relative to team (centered at 70)
  const advZScore = calculateZScore(earlyAdvantage, meanEarlyAdv, stdDevEarlyAdv);
  let baseScore = zScoreToDistribution(advZScore, 70, 15);


  // Laning phase advantage bonus (positive = won lane, negative = lost lane)
  const laningBonus = laningAdvantage * 0.015; // ±15 for ±1000 gold/xp advantage

  // CS@10 scoring (role-adjusted)
  let csExpectation = 70; // Base expectation
  if (role === "TOP") csExpectation = 75;
  if (role === "MIDDLE") csExpectation = 75;
  if (role === "BOTTOM") csExpectation = 70;
  if (role === "JUNGLE") csExpectation = 45;
  if (role === "UTILITY") csExpectation = 15;

  const csBonus = (cs10Min - csExpectation) * 0.3; // ±3 points per CS difference

  // Roaming/early game impact
  const roamBonus = roamKills * (isJungle ? 8 : 12); // Higher value for laners roaming

  // Extreme performance bonuses
  let extremeBonus = 0;
  if (earlyAdvantage > 1500) extremeBonus = Math.min((earlyAdvantage - 1500) / 100, 15);
  if (earlyAdvantage < -1500) extremeBonus = Math.max((earlyAdvantage + 1500) / 100, -20);

  // Perfect CS bonus (role-specific)
  if (!isJungle && cs10Min >= 95) extremeBonus += 10;

  const finalScore = baseScore + laningBonus + csBonus + roamBonus + extremeBonus;
  
  return Math.max(10, Math.min(100, finalScore));
}

function calculateCombatScore(
  player: Participant,
  team: Participant[],
  opponent: Participant | null,
  gameDuration: number
): number {
  const kda = player.deaths > 0
    ? (player.kills + player.assists) / player.deaths
    : player.kills + player.assists;
  const killPart = player.challenges?.killParticipation || 0;
  const dmgShare = player.challenges?.teamDamagePercentage || 0;
  const totalDamageDealt = player.totalDamageDealtToChampions || 0;
  const soloKills = player.challenges?.soloKills || 0;

  // Calculate team stats for normalization
  const teamKDAs = team.map(p => 
    p.deaths > 0 ? (p.kills + p.assists) / p.deaths : p.kills + p.assists
  );
  const meanKDA = teamKDAs.reduce((a, b) => a + b, 0) / teamKDAs.length;
  const stdDevKDA = calculateStdDev(teamKDAs, meanKDA);

  // Base score from KDA relative to team (centered at 70)
  const kdaZScore = calculateZScore(kda, meanKDA, stdDevKDA);
  let baseScore = zScoreToDistribution(kdaZScore, 70, 15);

  // Direct comparison to opponent (if available)
  if (opponent) {
    const oppKDA = opponent.deaths > 0
      ? (opponent.kills + opponent.assists) / opponent.deaths
      : opponent.kills + opponent.assists;
    const oppDmgShare = opponent.challenges?.teamDamagePercentage || 0;
    
    // Bonus/penalty for outperforming opponent
    const kdaDiff = kda - oppKDA;
    const oppBonus = kdaDiff * 5; // ±10 for ±2 KDA difference
    
    const dmgDiff = dmgShare - oppDmgShare;
    const dmgOppBonus = dmgDiff * 50; // ±10 for ±0.2 damage share difference

    const damageDiff = totalDamageDealt - (opponent.totalDamageDealtToChampions || 0);
    const damageOppBonus = damageDiff * 0.001; // ±10 for ±1000 damage difference
    
    baseScore += oppBonus + dmgOppBonus + damageOppBonus;
  }

  // Kill participation bonus/penalty (0-1 scale, centered at 0.6)
  const kpBonus = (killPart - 0.5) * 40; // ±40 points from 0.6 baseline
  
  // Damage share bonus (0-1 scale, centered at 0.2)
  const dmgBonus = (dmgShare - 0.25) * 30; // ±30 points from 0.2 baseline

  // Exceptional performance bonuses
  const soloKillBonus = Math.min(soloKills * 2, 10); // Up to +15

  // Penalties for poor performance
  let penalty = 0;
  if (kda < 1.0) penalty = (1.0 - kda) * 20; // Penalty for KDA < 1
  if (killPart < 0.3) penalty += (0.3 - killPart) * 30; // Low participation penalty

  console.log(player.teamPosition)
  console.log("KP BONUS", kpBonus, "DMG BONUS", dmgBonus, "SOLO KILL BONUS", soloKillBonus, "MULTIKILL BONUS", "PENALTY", penalty)

  const finalScore = baseScore + kpBonus + dmgBonus + soloKillBonus  - penalty;
  
  return Math.max(10, Math.min(100, finalScore));
}

function calculateEconomyScore(
  player: Participant,
  team: Participant[],
  opponent: Participant | null,
  gameDuration: number
): number {
  const gpm = (player.goldEarned / gameDuration) * 60;
  const cs = player.totalMinionsKilled + player.neutralMinionsKilled;
  const csPerMin = cs / (gameDuration / 60);

  // Calculate team stats
  const teamGPMs = team.map(p => (p.goldEarned / gameDuration) * 60);
  const meanGPM = teamGPMs.reduce((a, b) => a + b, 0) / teamGPMs.length;
  const stdDevGPM = calculateStdDev(teamGPMs, meanGPM);

  // Base score from GPM (centered at 70)
  const gpmZScore = calculateZScore(gpm, meanGPM, stdDevGPM);
  let baseScore = zScoreToDistribution(gpmZScore, 70, 14);

  // Direct comparison to opponent (if available)
  if (opponent) {
    const oppGPM = (opponent.goldEarned / gameDuration) * 60;
    const oppCS = opponent.totalMinionsKilled + opponent.neutralMinionsKilled;
    const oppCSPerMin = oppCS / (gameDuration / 60);
    
    const gpmDiff = gpm - oppGPM;
    const oppBonus = gpmDiff * 0.03; // ±10 for ±333 GPM difference
    
    const csDiff = csPerMin - oppCSPerMin;
    const csOppBonus = csDiff * 2; // ±10 for ±5 CS/min difference
    
    baseScore += oppBonus + csOppBonus;
  }

  // CS/min bonuses (role-adjusted expectations)
  const role = player.teamPosition || "MIDDLE";
  let csExpectation = 8; // Base expectation
  if (role === "JUNGLE") csExpectation = 7;
  if (role === "UTILITY") csExpectation = 1.5;

  const csBonus = (csPerMin - csExpectation) * 3; // ±30 for ±10 cs/min difference

  // Extreme performance adjustments
  let extremeBonus = 0;
  if (gpm > 600) extremeBonus = Math.min((gpm - 600) / 20, 15);
  if (gpm < 250) extremeBonus = -Math.min((250 - gpm) / 10, 30);

  const finalScore = baseScore + csBonus + extremeBonus;
  
  return Math.max(10, Math.min(100, finalScore));
}

function calculateVisionScore(
  player: Participant,
  team: Participant[],
  opponent: Participant | null,
  gameDuration: number
): number {
  const visionPerMin = player.visionScore && gameDuration
    ? player.visionScore / (gameDuration / 60)
    : 0;
  const wardsPlaced = player.wardsPlaced || 0;
  const wardsKilled = player.wardsKilled || 0;
  const controlWards = player.detectorWardsPlaced || 0;

  // Calculate team stats
  const teamVisionPM = team.map(p => 
    p.visionScore ? p.visionScore / (gameDuration / 60) : 0
  );
  const meanVisionPM = teamVisionPM.reduce((a, b) => a + b, 0) / teamVisionPM.length;
  const stdDevVisionPM = calculateStdDev(teamVisionPM, meanVisionPM);

  // Base score from vision/min (centered at 70)
  const visionZScore = calculateZScore(visionPerMin, meanVisionPM, stdDevVisionPM);
  let baseScore = zScoreToDistribution(visionZScore, 70, 12);

  // Direct comparison to opponent (if available)
  if (opponent) {
    const oppVisionPerMin = opponent.visionScore && gameDuration
      ? opponent.visionScore / (gameDuration / 60)
      : 0;
    const oppWardsKilled = opponent.wardsKilled || 0;
    
    const visionDiff = visionPerMin - oppVisionPerMin;
    const oppBonus = visionDiff * 3; // ±9 for ±3 vision/min difference
    
    const wardKillDiff = wardsKilled - oppWardsKilled;
    const wardKillOppBonus = wardKillDiff * 0.3; // ±3 for ±10 ward kills difference
    
    baseScore += oppBonus + wardKillOppBonus;
  }

  // Role-adjusted expectations
  const role = player.teamPosition || "MIDDLE";
  const isSupport = role === "UTILITY";
  const wardExpectation = isSupport ? 20 : 10;
  const controlExpectation = isSupport ? 10 : 5;

  // Ward activity bonuses
  const wardBonus = (wardsPlaced - wardExpectation) * 0.8;
  const controlBonus = (controlWards - controlExpectation) * 2;
  const visionDenyBonus = wardsKilled * 0.5;

  // Exceptional vision play
  let extremeBonus = 0;
  if (isSupport && visionPerMin > 4) extremeBonus = Math.min((visionPerMin - 4) * 5, 15);
  if (visionPerMin < 0.5) extremeBonus = -20; // Very poor vision

  const finalScore = baseScore + wardBonus + controlBonus + visionDenyBonus + extremeBonus;
  
  return Math.max(10, Math.min(100, finalScore));
}

function calculateObjectiveScore(
  player: Participant,
  team: Participant[],
  opponent: Participant | null,
  gameDuration: number
): number {
  const role = player.teamPosition || "MIDDLE";
  const isJungle = role === "JUNGLE";
  
  const turretDmg = player.damageDealtToTurrets || 0;
  const dragons = player.dragonKills || 0;
  const barons = player.baronKills || 0;
  const objDmg = player.damageDealtToObjectives || 0;
  const epicSteals = player.challenges?.epicMonsterSteals || 0;

  // Calculate team totals
  const teamTurretDmg = team.reduce((sum, p) => sum + (p.damageDealtToTurrets || 0), 0);
  const teamObjDmg = team.reduce((sum, p) => sum + (p.damageDealtToObjectives || 0), 0);
  
  const turretDmgShare = teamTurretDmg > 0 ? turretDmg / teamTurretDmg : 0;
  const objDmgShare = teamObjDmg > 0 ? objDmg / teamObjDmg : 0;

  let baseScore = 70;

  if (isJungle) {
    // Junglers: 20% turret damage, 80% objective damage
    const turretComponent = (turretDmgShare - 0.15) * 100; // Expected ~15% for jungle
    const objComponent = (objDmgShare - 0.25) * 120; // Expected ~25% for jungle
    baseScore = 70 + turretComponent * 0.2 + objComponent * 0.8;
    
    // Direct comparison to enemy jungler
    if (opponent) {
      const oppDragons = opponent.dragonKills || 0;
      const oppBarons = opponent.baronKills || 0;
      const oppObjDmg = opponent.damageDealtToObjectives || 0;
      const oppObjDmgShare = teamObjDmg > 0 ? oppObjDmg / teamObjDmg : 0;
      
      const dragonDiff = dragons - oppDragons;
      const baronDiff = barons - oppBarons;
      const objDiff = objDmgShare - oppObjDmgShare;
      
      baseScore += dragonDiff * 8 + baronDiff * 12 + objDiff * 40;
    }
    
    // Epic monster bonuses (more valuable for junglers)
    const dragonBonus = dragons * 10; // +10 per dragon
    const baronBonus = barons * 18; // +18 per baron
    const stealBonus = epicSteals * 25; // +25 per epic steal (HUGE bonus)
    
    // Penalty for low objective control
    let penalty = 0;
    if (objDmgShare < 0.15) penalty = (0.15 - objDmgShare) * 150;
    
    const finalScore = baseScore + dragonBonus + baronBonus + stealBonus - penalty;
    return Math.max(10, Math.min(100, finalScore));
    
  } else {
    // Laners: 80% turret damage, 20% objective damage
    const turretComponent = (turretDmgShare - 0.2) * 150; // Expected ~20% for laners
    const objComponent = (objDmgShare - 0.15) * 100; // Expected ~15% for laners
    baseScore = 70 + turretComponent * 0.8 + objComponent * 0.2;
    
    // Direct comparison to lane opponent
    if (opponent) {
      const oppTurretDmg = opponent.damageDealtToTurrets || 0;
      const oppTurretDmgShare = teamTurretDmg > 0 ? oppTurretDmg / teamTurretDmg : 0;
      const turretDiff = turretDmgShare - oppTurretDmgShare;
      baseScore += turretDiff * 60; // ±12 for ±0.2 difference
    }
    
    // Epic monster bonuses (less valuable for laners)
    const dragonBonus = dragons * 6; // +6 per dragon
    const baronBonus = barons * 12; // +12 per baron
    
    // Turret damage excellence bonus
    let turretBonus = 0;
    if (turretDmgShare > 0.3) turretBonus = (turretDmgShare - 0.3) * 50;
    
    // Penalty for low turret damage (except support)
    let penalty = 0;
    if (turretDmgShare < 0.1 && role !== "UTILITY") {
      penalty = (0.1 - turretDmgShare) * 100;
    }
    
    const finalScore = baseScore + turretBonus + dragonBonus + baronBonus - penalty;
    return Math.max(10, Math.min(100, finalScore));
  }
}

function calculateSurvivabilityScore(
  player: Participant,
  team: Participant[],
  opponent: Participant | null,
  gameDuration: number
): number {
  const deaths = player.deaths || 0;
  const timeSpentDead = player.totalTimeSpentDead || 0;
  const deathRate = deaths / (gameDuration / 60); // Deaths per minute

  // Calculate team death stats
  const teamDeaths = team.map(p => p.deaths || 0);
  const meanDeaths = teamDeaths.reduce((a, b) => a + b, 0) / teamDeaths.length;
  const stdDevDeaths = calculateStdDev(teamDeaths, meanDeaths);

  // Base score from death rate relative to team (inverted - fewer deaths = better)
  const deathZScore = calculateZScore(deaths, meanDeaths, stdDevDeaths);
  let baseScore = zScoreToDistribution(-deathZScore, 70, 15); // Negative because fewer is better

  // Direct comparison to opponent (if available)
  if (opponent) {
    const oppDeaths = opponent.deaths || 0;
    const deathDiff = oppDeaths - deaths; // Inverted: more opponent deaths = better for you
    const oppBonus = deathDiff * 3; // ±9 for ±3 death difference
    baseScore += oppBonus;
  }

  // Time spent dead penalty
  const deadTimePercent = timeSpentDead / gameDuration;
  const deadTimePenalty = deadTimePercent * 100; // Up to -30 for 30% time dead

  // Death rate bonuses/penalties
  let deathBonus = 0;
  if (deathRate < 0.15) deathBonus = (0.15 - deathRate) * 100; // Bonus for <0.15 deaths/min
  if (deathRate > 0.5) deathBonus = (0.5 - deathRate) * 80; // Penalty for >0.5 deaths/min

  // Perfect game bonus
  if (deaths === 0) deathBonus += 15;

  const finalScore = baseScore - deadTimePenalty + deathBonus;
  
  return Math.max(10, Math.min(100, finalScore));
}

function calculateUtilityScore(
  player: Participant,
  team: Participant[],
  opponent: Participant | null,
  gameDuration: number
): number {
  const healing = player.totalHealsOnTeammates || 0;
  const shielding = player.totalDamageShieldedOnTeammates || 0;
  const cc = player.timeCCingOthers || 0;
  const effectiveHS = player.challenges?.effectiveHealAndShielding || 0;

  const role = player.teamPosition || "MIDDLE";
  const isSupport = role === "UTILITY";

  // Calculate team utility stats
  const teamCC = team.map(p => p.timeCCingOthers || 0);
  const meanCC = teamCC.reduce((a, b) => a + b, 0) / teamCC.length;
  const stdDevCC = calculateStdDev(teamCC, meanCC);

  // Base score from CC relative to team (centered at 70)
  const ccZScore = calculateZScore(cc, meanCC, stdDevCC);
  let baseScore = zScoreToDistribution(ccZScore, 70, 12);

  // Direct comparison to opponent (if available)
  if (opponent) {
    const oppCC = opponent.timeCCingOthers || 0;
    const oppHS = (opponent.totalHealsOnTeammates || 0) + (opponent.totalDamageShieldedOnTeammates || 0);
    const playerHS = healing + shielding;
    
    const ccDiff = cc - oppCC;
    const ccOppBonus = ccDiff * 0.08; // ±8 for ±100 CC duration difference
    
    const hsDiff = playerHS - oppHS;
    const hsOppBonus = hsDiff * 0.003; // ±6 for ±2000 heal/shield difference
    
    baseScore += ccOppBonus + hsOppBonus;
  }

  // Heal/shield bonuses (more valuable for supports)
  const hsValue = healing + shielding + effectiveHS;
  const hsMultiplier = isSupport ? 0.01 : 0.005;
  const hsBonus = Math.min(hsValue * hsMultiplier, 25);

  // CC duration bonuses
  const ccBonus = Math.min(cc * 0.15, 20);

  // Role-based adjustments
  if (isSupport) {
    // Supports expected to have high utility
    if (hsValue < 1000) baseScore -= 20;
    if (cc < 50) baseScore -= 15;
  } else {
    // Non-supports get bonus for utility
    if (hsValue > 3000) baseScore += 10;
  }

  const finalScore = baseScore + hsBonus + ccBonus;
  
  return Math.max(10, Math.min(100, finalScore));
}

export function calculatePlayerScore(
  player: Participant,
  team: Participant[],
  enemyTeam: Participant[],
  gameDuration: number
): {
  total: number;
  breakdown: {
    combat: number;
    economy: number;
    earlyLane: number;
    vision: number;
    objectives: number;
    survivability: number;
    utility: number;
  };
} {
  const role = player.teamPosition || "MIDDLE";
  const weights = roleWeights[role as keyof typeof roleWeights] || roleWeights.MIDDLE;

  // Find the opponent in the same role
  const opponent = enemyTeam.find(p => p.teamPosition === role) || null;

  const combat = calculateCombatScore(player, team, opponent, gameDuration);
  const economy = calculateEconomyScore(player, team, opponent, gameDuration);
  const earlyLane = calculateEarlyLaneScore(player, team, opponent, gameDuration);
  const vision = calculateVisionScore(player, team, opponent, gameDuration);
  const objectives = calculateObjectiveScore(player, team, opponent, gameDuration);
  const survivability = calculateSurvivabilityScore(player, team, opponent, gameDuration);
  const utility = calculateUtilityScore(player, team, opponent, gameDuration);

  const finalScore =
    combat * weights.combat +
    economy * weights.economy +
    earlyLane * weights.earlyLane +
    vision * weights.vision +
    objectives * weights.objectives +
    survivability * weights.survivability +
    utility * weights.utility;

    const breakdown  ={
      combat: Math.round(combat),
      economy: Math.round(economy),
      earlyLane: Math.round(earlyLane),
      vision: Math.round(vision),
      objectives: Math.round(objectives),
      survivability: Math.round(survivability),
      utility: Math.round(utility),
    }

    console.log (breakdown)
    console.log(player.teamId, player.teamPosition)
    console.log("___")

  return {
    total: Math.round(finalScore),
    breakdown: {
      combat: Math.round(combat),
      economy: Math.round(economy),
      earlyLane: Math.round(earlyLane),
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
      p.teamId === 100 ? team200 : team100, // Pass enemy team
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