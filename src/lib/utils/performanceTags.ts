import { MatchData } from "@/app/components/summoner/types";

export interface PerformanceTag {
  name: string;
  description: string;
  category: 'economy' | 'combat' | 'vision' | 'objective' | 'special';
  color: string;
}

export function getPerformanceTags(
  playerData: MatchData['info']['participants'][0],
  gameDuration: number
): PerformanceTag[] {
  const tags: PerformanceTag[] = [];
  const challenges = playerData.challenges || {};
  
  // Economy & Laning
  if (challenges.earlyLaningPhaseGoldExpAdvantage === 1) {
    tags.push({ name: 'Lane Dominator', description: 'Dominated the lane early', category: 'economy', color: 'bg-emerald-500/20 text-emerald-300' });
  }
  if ((challenges.laneMinionsFirst10Minutes || 0) >= 100) {
    tags.push({ name: 'Perfect CS', description: '100+ CS in first 10 minutes', category: 'economy', color: 'bg-lime-500/20 text-lime-300' });
  }
  if ((challenges.goldPerMinute || 0) >= 500) {
    tags.push({ name: 'Rich', description: '500+ gold per minute', category: 'economy', color: 'bg-teal-500/20 text-teal-300' });
  }
  if ((playerData.itemsPurchased || 0) >= 25) {
    tags.push({ name: 'Adaptive', description: 'Bought 25+ items', category: 'economy', color: 'bg-sky-500/20 text-sky-300' });
  }
  if ((challenges.killingSprees || 0) >= 2) {
    tags.push({ name: 'Snowballer', description: 'Multiple killing sprees', category: 'combat', color: 'bg-violet-500/20 text-violet-300' });
  }
  
  // Combat Excellence
  if ((playerData.timeCCingOthers || 0) >= 30) {
    tags.push({ name: 'CC Master', description: '30+ seconds of crowd control', category: 'combat', color: 'bg-indigo-500/20 text-indigo-300' });
  }
  if ((challenges.killsNearEnemyTurret || 0) >= 3) {
    tags.push({ name: 'Tower Diver', description: '3+ kills near enemy tower', category: 'combat', color: 'bg-fuchsia-500/20 text-fuchsia-300' });
  }
  if ((challenges.immobilizeAndKillWithAlly || 0) >= 3) {
    tags.push({ name: 'Setup King', description: 'Set up 3+ kills with CC', category: 'combat', color: 'bg-blue-500/20 text-blue-300' });
  }
  if ((challenges.knockEnemyIntoTeamAndKill || 0) >= 1) {
    tags.push({ name: 'Insec', description: 'Knocked an enemy into your team for kill', category: 'combat', color: 'bg-purple-500/20 text-purple-300' });
  }
  if ((challenges.skillshotsDodged || 0) >= 30) {
    tags.push({ name: 'Untouchable', description: 'Dodged 30+ skillshots', category: 'combat', color: 'bg-cyan-500/20 text-cyan-300' });
  }
  if (playerData.deaths === 0 && playerData.kills >= 5) {
    tags.push({ name: 'Flawless', description: 'Deathless with 5+ kills', category: 'combat', color: 'bg-purple-500/20 text-purple-300' });
  }
  if ((challenges.damagePerMinute || 0) >= 800) {
    tags.push({ name: 'High DPM', description: '800+ damage per minute', category: 'combat', color: 'bg-pink-500/20 text-pink-300' });
  }
  if ((challenges.damageSelfMitigated || 0) >= 30000) {
    tags.push({ name: 'Tank', description: '30k+ damage mitigated', category: 'combat', color: 'bg-slate-500/20 text-slate-300' });
  }
  if ((challenges.longestTimeSpentLiving || 0) >= 900) {
    tags.push({ name: 'Survivor', description: 'Stayed alive for 15+ minutes', category: 'combat', color: 'bg-green-500/20 text-green-300' });
  }
  
  // Vision & Map Control
  if ((playerData.visionScore || 0) >= 80) {
    tags.push({ name: 'Vision King', description: '80+ vision score', category: 'vision', color: 'bg-sky-500/20 text-sky-300' });
  }
  if ((challenges.wardTakedowns || 0) >= 5) {
    tags.push({ name: 'Vision Denier', description: 'Destroyed 5+ wards', category: 'vision', color: 'bg-teal-500/20 text-teal-300' });
  }
  if ((challenges.controlWardTimeCoverageInRiverOrEnemyHalf || 0) > 0.7) {
    tags.push({ name: 'River Control', description: 'Controlled river vision', category: 'vision', color: 'bg-blue-500/20 text-blue-300' });
  }
  if ((challenges.visionScorePerMinute || 0) > 1) {
    tags.push({ name: 'Map Aware', description: '1+ vision score per minute', category: 'vision', color: 'bg-cyan-500/20 text-cyan-300' });
  }

  
  // Multikills - only show the highest achieved
  if ((playerData.pentaKills || 0) >= 1) {
    tags.push({ name: 'PENTAKILL!', description: 'Earned a Pentakill', category: 'combat', color: 'bg-fuchsia-500/20 text-fuchsia-300' });
  } else if ((playerData.quadraKills || 0) >= 1) {
    tags.push({ name: 'Quadra', description: 'Earned a Quadra Kill', category: 'combat', color: 'bg-purple-500/20 text-purple-300' });
  } else if ((playerData.tripleKills || 0) >= 1) {
    tags.push({ name: 'Triple Kill', description: 'Scored a triple kill', category: 'combat', color: 'bg-violet-500/20 text-violet-300' });
  } else if ((playerData.doubleKills || 0) >= 1) {
    tags.push({ name: 'Double Kill', description: 'Scored a double kill', category: 'combat', color: 'bg-indigo-500/20 text-indigo-300' });
  }
  if ((playerData.largestKillingSpree || 0) >= 5) {
    tags.push({ name: 'Killing Spree', description: '5+ kill streak', category: 'combat', color: 'bg-violet-500/20 text-violet-300' });
  }
  if (playerData.deaths === 0) {
    tags.push({ name: 'Deathless', description: 'Perfect game - no deaths', category: 'combat', color: 'bg-green-500/20 text-green-300' });
  }
  if ((challenges.outnumberedKills || 0) >= 1) {
    tags.push({ name: 'Outnumbered Killer', description: 'Won outnumbered fight', category: 'combat', color: 'bg-emerald-500/20 text-emerald-300' });
  }
  if ((challenges.multiKillOneSpell || 0) >= 1) {
    tags.push({ name: 'Multi-Spell', description: 'Multiple kills with one spell', category: 'combat', color: 'bg-purple-500/20 text-purple-300' });
  }
  if ((challenges.takedownsInEnemyFountain || 0) >= 1) {
    tags.push({ name: 'Fountain Dive', description: 'Got kill in enemy fountain', category: 'special', color: 'bg-fuchsia-500/20 text-fuchsia-300' });
  }
  
  // Objectives
  if ((challenges.epicMonsterSteals || 0) >= 1) {
    tags.push({ name: 'Epic Steal', description: 'Stole Baron or Dragon', category: 'objective', color: 'bg-purple-500/20 text-purple-300' });
  }
  if ((playerData.turretTakedowns || 0) >= 3) {
    tags.push({ name: 'Siege Expert', description: 'Destroyed 3+ turrets', category: 'objective', color: 'bg-blue-500/20 text-blue-300' });
  }
  if ((challenges.damageDealtToBuildings || 0) > 5000) {
    tags.push({ name: 'Demolisher', description: '5k+ damage to structures', category: 'objective', color: 'bg-sky-500/20 text-sky-300' });
  }
  if (playerData.firstTowerKill || playerData.firstBloodKill) {
    tags.push({ name: 'First Strike', description: 'First Blood or First Tower', category: 'objective', color: 'bg-lime-500/20 text-lime-300' });
  }
  
  // Special/Creative
  if (challenges.getTakedownsInAllLanesEarlyJungleAsLaner === 1) {
    tags.push({ name: 'Roamer', description: 'Got kills in all lanes', category: 'special', color: 'bg-teal-500/20 text-teal-300' });
  }
  if ((challenges.unseenRecalls || 0) >= 1) {
    tags.push({ name: 'Sneaky', description: 'Recalled unseen', category: 'special', color: 'bg-indigo-500/20 text-indigo-300' });
  }
  if ((challenges.takedownsInAlcove || 0) >= 1) {
    tags.push({ name: 'Corner Hunter', description: 'Got kill in alcove', category: 'special', color: 'bg-violet-500/20 text-violet-300' });
  }
  if ((challenges.saveAllyFromDeath || 0) >= 1) {
    tags.push({ name: 'Lifesaver', description: 'Saved ally from death', category: 'special', color: 'bg-green-500/20 text-green-300' });
  }
  if ((challenges.bountyGold || 0) > 500) {
    tags.push({ name: 'Bounty Hunter', description: '500+ bounty gold collected', category: 'special', color: 'bg-emerald-500/20 text-emerald-300' });
  }
  if ((challenges.pickKillWithAlly || 0) >= 10) {
    tags.push({ name: 'Duo Queue', description: '10+ coordinated kills with ally', category: 'special', color: 'bg-blue-500/20 text-blue-300' });
  }
  
  return tags;
}
