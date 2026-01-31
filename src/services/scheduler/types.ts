/**
 * Scheduler Type Definitions
 * Types for daily planning, block generation, and priority scoring
 */

// ================================
// Core Types
// ================================

export interface DailyPlan {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  targetMinutes: number;
  blocks: PlannedBlock[];
  priorities: PriorityItem[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PlannedBlock {
  id: string;
  order: number;
  type: BlockType;
  mode: TrainingMode;
  targetQuestions: number;
  estimatedMinutes: number;
  focus: BlockFocus;
  atoms: string[];
  status: BlockStatus;
  completedAt?: Date;
}

export type BlockType = 'build' | 'review' | 'test' | 'remediation';
export type TrainingMode = 'sprint' | 'endurance' | 'review' | 'mixed' | 'gate-attempt';
export type BlockStatus = 'pending' | 'in-progress' | 'completed' | 'skipped';

export interface BlockFocus {
  section?: string;
  questionType?: string;
  skill?: string;
  atoms?: string[];
  gateId?: string;
  description: string;
}

// ================================
// Priority System
// ================================

export interface PriorityItem {
  atomId: string;
  atomName: string;
  section: string;
  score: number;
  factors: PriorityFactor[];
  lastPracticed?: Date;
  reviewDue?: Date;
}

export interface PriorityFactor {
  type: PriorityFactorType;
  weight: number;
  value: number;
  contribution: number;
  description: string;
}

export type PriorityFactorType = 
  | 'blocking-gate'
  | 'weakness-cluster'
  | 'spaced-repetition'
  | 'section-balance'
  | 'time-since-practice'
  | 'error-frequency'
  | 'low-mastery';

// ================================
// Scheduler Configuration
// ================================

export interface SchedulerConfig {
  // Time budgets
  defaultDailyMinutes: number;
  minBlockMinutes: number;
  maxBlockMinutes: number;
  questionsPerMinute: number;
  
  // Priority weights
  priorityWeights: PriorityWeights;
  
  // Block distribution
  blockDistribution: BlockDistribution;
  
  // Anti-grind settings
  antiGrind: AntiGrindConfig;
}

export interface PriorityWeights {
  blockingGate: number;
  weaknessCluster: number;
  spacedRepetition: number;
  sectionBalance: number;
  timeSincePractice: number;
  errorFrequency: number;
  lowMastery: number;
}

export interface BlockDistribution {
  build: number;      // % for new learning
  review: number;     // % for spaced review
  weakness: number;   // % for weakness targeting
  gate: number;       // % for gate attempts
}

export interface AntiGrindConfig {
  maxSameAtomPerSession: number;
  cooldownMinutes: number;
  minVarietyPerBlock: number;
  diminishingReturnsThreshold: number;
}

// ================================
// Spaced Repetition
// ================================

export interface ReviewItem {
  id: string;
  userId: string;
  atomId: string;
  questionId?: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  dueDate: Date;
  lastReview?: Date;
  quality?: number; // 0-5 scale for SM-2
}

export interface ReviewSchedule {
  dueNow: ReviewItem[];
  dueToday: ReviewItem[];
  dueTomorrow: ReviewItem[];
  dueThisWeek: ReviewItem[];
  overdue: ReviewItem[];
}

// ================================
// Session Context
// ================================

export interface SessionContext {
  userId: string;
  currentLevel: number;
  targetMinutes: number;
  completedToday: SessionStats;
  recentAtoms: AtomHistory[];
  blockingGates: GateInfo[];
  weaknesses: WeaknessInfo[];
}

export interface SessionStats {
  blocks: number;
  questions: number;
  minutes: number;
  correctRate: number;
  atomsCovered: string[];
}

export interface AtomHistory {
  atomId: string;
  lastPracticed: Date;
  attemptsToday: number;
  correctToday: number;
}

export interface GateInfo {
  gateId: string;
  levelId: number;
  atomId: string;
  requirement: string;
  currentProgress: number;
  targetProgress: number;
  isBlocking: boolean;
}

export interface WeaknessInfo {
  atomId: string;
  atomName: string;
  section: string;
  accuracy: number;
  recentErrors: number;
  eloRating: number;
  priority: number;
}

// ================================
// Block Generation
// ================================

export interface BlockRequest {
  userId: string;
  type: BlockType;
  mode?: TrainingMode;
  targetMinutes?: number;
  targetQuestions?: number;
  focusAtoms?: string[];
  section?: string;
  gateId?: string;
}

export interface GeneratedBlock {
  id: string;
  type: BlockType;
  mode: TrainingMode;
  questions: SelectedQuestion[];
  estimatedMinutes: number;
  focus: BlockFocus;
  xpPotential: number;
}

export interface SelectedQuestion {
  questionId: string;
  atomId: string;
  difficulty: number;
  selectionReason: SelectionReason;
  timeBudget: number;
}

export type SelectionReason = 
  | 'near-rating'
  | 'stretch'
  | 'weakness'
  | 'review'
  | 'gate-requirement'
  | 'random';

// ================================
// Cooldown System
// ================================

export interface Cooldown {
  id: string;
  userId: string;
  type: CooldownType;
  targetId: string; // atomId, gateId, etc.
  startedAt: Date;
  expiresAt: Date;
  reason: string;
}

export type CooldownType = 
  | 'atom'
  | 'gate'
  | 'question-type'
  | 'section';

// ================================
// Constants
// ================================

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  defaultDailyMinutes: 60,
  minBlockMinutes: 5,
  maxBlockMinutes: 30,
  questionsPerMinute: 0.5, // 2 minutes per question average
  
  priorityWeights: {
    blockingGate: 10.0,
    weaknessCluster: 5.0,
    spacedRepetition: 4.0,
    sectionBalance: 2.0,
    timeSincePractice: 3.0,
    errorFrequency: 4.0,
    lowMastery: 3.0
  },
  
  blockDistribution: {
    build: 0.40,
    review: 0.30,
    weakness: 0.20,
    gate: 0.10
  },
  
  antiGrind: {
    maxSameAtomPerSession: 5,
    cooldownMinutes: 30,
    minVarietyPerBlock: 3,
    diminishingReturnsThreshold: 3
  }
};
