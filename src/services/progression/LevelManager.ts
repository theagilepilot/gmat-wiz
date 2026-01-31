/**
 * Level Manager
 * Manages user level progression and XP tracking
 */

import { query, queryOne, getDatabase, saveDatabase } from '../../db/connection.js';
import { evaluateGate, getGateSummary, createAtomMasteryGate } from './GateEvaluator.js';
import type {
  Level,
  LevelProgress,
  MasteryGate,
  GateProgress,
  UserProgressionState,
  ProgressionEvent,
} from './types.js';

// ============================================
// Level Definitions
// ============================================

/**
 * Standard level progression
 * XP requirements increase exponentially
 */
export const LEVELS: Level[] = [
  { number: 1, name: 'Novice', minXp: 0, requiredGates: [], perks: ['Access to Build mode'], badge: '🌱' },
  { number: 2, name: 'Apprentice', minXp: 500, requiredGates: [], perks: ['Streak tracking'], badge: '📚' },
  { number: 3, name: 'Student', minXp: 1500, requiredGates: [], perks: ['Access to Prove mode'], badge: '🎯' },
  { number: 4, name: 'Scholar', minXp: 3500, requiredGates: [], perks: ['Advanced analytics'], badge: '📊' },
  { number: 5, name: 'Practitioner', minXp: 7000, requiredGates: [], perks: ['Custom training blocks'], badge: '⚡' },
  { number: 6, name: 'Expert', minXp: 12000, requiredGates: [], perks: ['AI-generated questions'], badge: '🔮' },
  { number: 7, name: 'Master', minXp: 20000, requiredGates: [], perks: ['Diagnostic assessments'], badge: '👑' },
  { number: 8, name: 'Grandmaster', minXp: 32000, requiredGates: [], perks: ['All features unlocked'], badge: '🏆' },
  { number: 9, name: 'Legend', minXp: 50000, requiredGates: [], perks: ['Legend status'], badge: '⭐' },
  { number: 10, name: 'Ascended', minXp: 75000, requiredGates: [], perks: ['You have ascended'], badge: '🌟' },
];

// ============================================
// XP Calculations
// ============================================

/**
 * Get level for a given XP amount
 */
export function getLevelForXp(xp: number): Level {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXp) {
      return LEVELS[i];
    }
  }
  return LEVELS[0];
}

/**
 * Calculate XP needed for next level
 */
export function getXpToNextLevel(currentXp: number): { needed: number; percent: number; nextLevel: Level | null } {
  const currentLevel = getLevelForXp(currentXp);
  const currentIndex = LEVELS.findIndex(l => l.number === currentLevel.number);
  
  if (currentIndex === LEVELS.length - 1) {
    // Max level
    return { needed: 0, percent: 100, nextLevel: null };
  }
  
  const nextLevel = LEVELS[currentIndex + 1];
  const xpIntoLevel = currentXp - currentLevel.minXp;
  const xpForLevel = nextLevel.minXp - currentLevel.minXp;
  const needed = nextLevel.minXp - currentXp;
  const percent = Math.min(100, Math.round((xpIntoLevel / xpForLevel) * 100));
  
  return { needed, percent, nextLevel };
}

/**
 * Calculate XP award for a question result
 */
export function calculateQuestionXp(
  wasCorrect: boolean,
  timeRatio: number,  // actual/budget
  streak: number,
  difficultyMatch: 'easy' | 'optimal' | 'hard' | 'stretch'
): number {
  if (!wasCorrect) return 0;
  
  let xp = 10;  // Base XP
  
  // Time bonus (up to +5 for fast)
  if (timeRatio <= 0.5) {
    xp += 5;
  } else if (timeRatio <= 0.75) {
    xp += 3;
  }
  
  // Difficulty bonus
  const difficultyBonus = {
    easy: 0,
    optimal: 5,
    hard: 10,
    stretch: 20,
  };
  xp += difficultyBonus[difficultyMatch];
  
  // Streak bonus (capped)
  xp += Math.min(streak, 10);
  
  return xp;
}

// ============================================
// Level Progress
// ============================================

/**
 * Get current level progress for user
 */
export function getLevelProgress(
  currentXp: number,
  passedGateIds: number[],
  allGates: MasteryGate[]
): LevelProgress {
  const currentLevel = getLevelForXp(currentXp);
  const { needed, percent, nextLevel } = getXpToNextLevel(currentXp);
  
  // Get required gates for next level
  const requiredGateIds = nextLevel?.requiredGates ?? [];
  const gatesRequired: GateProgress[] = [];
  
  for (const gateId of requiredGateIds) {
    const gate = allGates.find(g => g.id === gateId);
    if (gate) {
      const result = evaluateGate(gate);
      gatesRequired.push(result.progress);
    }
  }
  
  const gatesPassed = gatesRequired.filter(g => g.status === 'passed').length;
  const gatesToPass = gatesRequired.length;
  
  // Can level up if have enough XP and all required gates passed
  const canLevelUp = needed === 0 || (nextLevel !== null && currentXp >= nextLevel.minXp && gatesPassed >= gatesToPass);
  
  // Identify blockers
  const blockedBy: string[] = [];
  if (nextLevel && currentXp < nextLevel.minXp) {
    blockedBy.push(`Need ${needed} more XP`);
  }
  for (const gate of gatesRequired) {
    if (gate.status !== 'passed') {
      blockedBy.push(`Gate not passed: ${gate.description}`);
    }
  }
  
  return {
    currentLevel: currentLevel.number,
    currentXp,
    xpToNextLevel: needed,
    percentToNext: percent,
    gatesRequired,
    gatesPassed,
    gatesToPass,
    canLevelUp,
    blockedBy: blockedBy.length > 0 ? blockedBy : undefined,
  };
}

// ============================================
// User State Management
// ============================================

/**
 * Get user progression state from database
 */
export function getUserProgressionState(): UserProgressionState {
  // Get user record (assuming single user for now)
  const user = queryOne<{
    total_xp: number;
    current_level: number;
  }>('SELECT total_xp, current_level FROM users LIMIT 1');
  
  // Get passed gates
  const passedGates = query<{ gate_id: number }>(`
    SELECT DISTINCT atom_id as gate_id 
    FROM atom_mastery 
    WHERE mastery_level = 'mastered'
  `);
  
  // Get mastered atoms
  const masteredAtoms = query<{ atom_id: number }>(`
    SELECT atom_id FROM atom_mastery WHERE mastery_level = 'mastered'
  `);
  
  // Get mastered topics (topics where all atoms are mastered)
  const masteredTopics = query<{ topic_code: string }>(`
    SELECT t.code as topic_code
    FROM topics t
    WHERE NOT EXISTS (
      SELECT 1 FROM skill_atoms sa
      LEFT JOIN atom_mastery am ON sa.id = am.atom_id
      WHERE sa.topic_id = t.id AND (am.mastery_level IS NULL OR am.mastery_level != 'mastered')
    )
  `);
  
  return {
    level: user?.current_level ?? 1,
    totalXp: user?.total_xp ?? 0,
    passedGateIds: passedGates.map(g => g.gate_id),
    currentGates: [],  // Would be populated from active gates
    masteredAtomIds: masteredAtoms.map(a => a.atom_id),
    masteredTopicCodes: masteredTopics.map(t => t.topic_code),
    achievements: [],
  };
}

/**
 * Award XP to user
 */
export function awardXp(amount: number, reason: string): ProgressionEvent | null {
  if (amount <= 0) return null;
  
  const db = getDatabase();
  const beforeState = getUserProgressionState();
  
  // Update user XP
  db.run('UPDATE users SET total_xp = total_xp + ? WHERE id = 1', [amount]);
  
  // Check for level up
  const afterXp = beforeState.totalXp + amount;
  const beforeLevel = getLevelForXp(beforeState.totalXp);
  const afterLevel = getLevelForXp(afterXp);
  
  if (afterLevel.number > beforeLevel.number) {
    // Level up!
    db.run('UPDATE users SET current_level = ? WHERE id = 1', [afterLevel.number]);
    saveDatabase();
    
    return {
      type: 'level_up',
      timestamp: new Date(),
      details: {
        fromLevel: beforeLevel.number,
        toLevel: afterLevel.number,
        newLevelName: afterLevel.name,
        newPerks: afterLevel.perks,
        badge: afterLevel.badge,
      },
      xpEarned: amount,
      message: `🎉 Level Up! You are now ${afterLevel.name} (Level ${afterLevel.number})!`,
    };
  }
  
  saveDatabase();
  
  return {
    type: 'xp_earned',
    timestamp: new Date(),
    details: { amount, reason },
    xpEarned: amount,
    message: `+${amount} XP: ${reason}`,
  };
}

/**
 * Check and apply gate completion
 */
export function checkGateCompletion(gate: MasteryGate): ProgressionEvent | null {
  const result = evaluateGate(gate);
  
  if (result.passed) {
    // Award XP if gate has reward
    if (gate.xpReward) {
      return awardXp(gate.xpReward, `Completed gate: ${gate.name}`);
    }
    
    return {
      type: 'gate_passed',
      timestamp: new Date(),
      details: { gateId: gate.id, gateName: gate.name },
      message: `🏅 Gate Passed: ${gate.name}!`,
    };
  }
  
  return null;
}

/**
 * Get available perks for user's level
 */
export function getAvailablePerks(level: number): string[] {
  const perks: string[] = [];
  
  for (const lvl of LEVELS) {
    if (lvl.number <= level && lvl.perks) {
      perks.push(...lvl.perks);
    }
  }
  
  return perks;
}

/**
 * Check if feature is unlocked
 */
export function isFeatureUnlocked(feature: string, level: number): boolean {
  const perks = getAvailablePerks(level);
  
  const featureMap: Record<string, string> = {
    'prove_mode': 'Access to Prove mode',
    'ai_questions': 'AI-generated questions',
    'diagnostics': 'Diagnostic assessments',
    'analytics': 'Advanced analytics',
    'custom_blocks': 'Custom training blocks',
  };
  
  const requiredPerk = featureMap[feature];
  return !requiredPerk || perks.includes(requiredPerk);
}

// ============================================
// Singleton Export
// ============================================

let managerInstance: LevelManager | null = null;

export class LevelManager {
  LEVELS = LEVELS;
  getLevelForXp = getLevelForXp;
  getXpToNextLevel = getXpToNextLevel;
  calculateQuestionXp = calculateQuestionXp;
  getLevelProgress = getLevelProgress;
  getUserProgressionState = getUserProgressionState;
  awardXp = awardXp;
  checkGateCompletion = checkGateCompletion;
  getAvailablePerks = getAvailablePerks;
  isFeatureUnlocked = isFeatureUnlocked;
}

export function getLevelManager(): LevelManager {
  if (!managerInstance) {
    managerInstance = new LevelManager();
  }
  return managerInstance;
}
