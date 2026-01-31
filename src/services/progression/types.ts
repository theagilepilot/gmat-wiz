/**
 * Progression Types
 * Type definitions for mastery gates and level progression
 */

// ============================================
// Gate Types
// ============================================

export type GateType = 
  | 'accuracy'       // Accuracy threshold on atom set
  | 'consistency'    // Variance limits (consistent performance)
  | 'volume'         // Minimum attempts required
  | 'timing'         // Percentage within time budget
  | 'streak'         // Error-free streak requirement
  | 'composite';     // Combination of multiple gates

export type GateStatus = 'locked' | 'in_progress' | 'passed' | 'failed';

// ============================================
// Gate Definitions
// ============================================

export interface GateRequirement {
  type: GateType;
  threshold: number;
  description: string;
  weight?: number;  // For composite gates
}

export interface AccuracyRequirement extends GateRequirement {
  type: 'accuracy';
  threshold: number;  // e.g., 0.85 = 85%
  minAttempts?: number;  // Minimum attempts before gate can be passed
  atomIds?: number[];  // Specific atoms to evaluate
  windowSize?: number;  // Recent attempts to consider
}

export interface ConsistencyRequirement extends GateRequirement {
  type: 'consistency';
  threshold: number;  // Maximum variance allowed (e.g., 0.15)
  windowSize: number;  // Number of attempts to evaluate
}

export interface VolumeRequirement extends GateRequirement {
  type: 'volume';
  threshold: number;  // Minimum attempts required
  correctOnly?: boolean;  // Only count correct attempts
}

export interface TimingRequirement extends GateRequirement {
  type: 'timing';
  threshold: number;  // Percentage within budget (e.g., 0.80)
  budgetMultiplier?: number;  // Allow up to X times budget (default 1.0)
}

export interface StreakRequirement extends GateRequirement {
  type: 'streak';
  threshold: number;  // Number of correct in a row
  recent?: boolean;  // Must be recent streak (not historical)
}

export interface CompositeRequirement extends GateRequirement {
  type: 'composite';
  requirements: GateRequirement[];
  passingMode: 'all' | 'any' | 'weighted';  // How to combine
  threshold: number;  // For weighted: minimum weighted score
}

// ============================================
// Gate Progress
// ============================================

export interface GateProgress {
  gateId: number;
  gateType: GateType;
  status: GateStatus;
  currentValue: number;
  requiredValue: number;
  percentComplete: number;
  description: string;
  details?: string;
}

export interface GateEvaluationResult {
  gateId: number;
  passed: boolean;
  progress: GateProgress;
  blockers?: string[];
  suggestions?: string[];
}

// ============================================
// Mastery Gates
// ============================================

export interface MasteryGate {
  id: number;
  levelNumber: number;
  name: string;
  description: string;
  requirements: GateRequirement[];
  atomIds?: number[];  // Atoms this gate governs
  topicCodes?: string[];  // Topics this gate governs
  unlocks?: string[];  // What passing this gate unlocks
  xpReward?: number;
}

export interface GateSummary {
  totalGates: number;
  passedGates: number;
  inProgressGates: number;
  lockedGates: number;
  nextGate?: MasteryGate;
  blockingGates: MasteryGate[];
}

// ============================================
// Level System
// ============================================

export interface Level {
  number: number;
  name: string;
  minXp: number;
  requiredGates: number[];  // Gate IDs required to reach this level
  perks?: string[];
  badge?: string;
}

export interface LevelProgress {
  currentLevel: number;
  currentXp: number;
  xpToNextLevel: number;
  percentToNext: number;
  gatesRequired: GateProgress[];
  gatesPassed: number;
  gatesToPass: number;
  canLevelUp: boolean;
  blockedBy?: string[];
}

// ============================================
// User Progression State
// ============================================

export interface UserProgressionState {
  level: number;
  totalXp: number;
  passedGateIds: number[];
  currentGates: GateProgress[];
  masteredAtomIds: number[];
  masteredTopicCodes: string[];
  achievements: string[];
  lastLevelUpAt?: Date;
}

// ============================================
// Progression Events
// ============================================

export type ProgressionEventType = 
  | 'gate_passed'
  | 'gate_failed'
  | 'level_up'
  | 'atom_mastered'
  | 'topic_mastered'
  | 'streak_achieved'
  | 'xp_earned';

export interface ProgressionEvent {
  type: ProgressionEventType;
  timestamp: Date;
  details: Record<string, unknown>;
  xpEarned?: number;
  message: string;
}

// ============================================
// Gate Templates
// ============================================

export const STANDARD_GATES = {
  ATOM_MASTERY: (atomId: number): MasteryGate => ({
    id: atomId * 1000,  // Derived ID
    levelNumber: 0,
    name: 'Atom Mastery',
    description: 'Demonstrate consistent performance on this skill',
    requirements: [
      { type: 'accuracy', threshold: 0.85, description: '85% accuracy' },
      { type: 'volume', threshold: 10, description: 'At least 10 attempts' },
      { type: 'streak', threshold: 5, description: '5 correct in a row' },
    ],
    atomIds: [atomId],
  }),
  
  TOPIC_PROFICIENCY: (topicCode: string, atomIds: number[]): MasteryGate => ({
    id: topicCode.charCodeAt(0) * 10000,  // Derived ID
    levelNumber: 0,
    name: 'Topic Proficiency',
    description: 'Master all atoms in this topic',
    requirements: [
      { type: 'accuracy', threshold: 0.9, description: '90% accuracy across topic' },
      { type: 'volume', threshold: 20, description: 'At least 20 attempts' },
    ],
    topicCodes: [topicCode],
    atomIds,
  }),
  
  SECTION_MASTERY: (sectionCode: string): MasteryGate => ({
    id: sectionCode.charCodeAt(0) * 100000,
    levelNumber: 0,
    name: 'Section Mastery',
    description: 'Achieve high proficiency across the section',
    requirements: [
      { type: 'accuracy', threshold: 0.80, description: '80% section accuracy' },
      { type: 'timing', threshold: 0.75, description: '75% within time budget' },
      { type: 'volume', threshold: 100, description: 'At least 100 questions' },
    ],
    topicCodes: [],  // Would be filled with section topics
  }),
};
