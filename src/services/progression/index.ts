/**
 * Progression Services - Index
 * Exports all progression-related services
 */

// Types
export * from './types.js';

// Gate Evaluator
export {
  evaluateAccuracyRequirement,
  evaluateConsistencyRequirement,
  evaluateVolumeRequirement,
  evaluateTimingRequirement,
  evaluateStreakRequirement,
  evaluateCompositeRequirement,
  evaluateRequirement,
  evaluateGate,
  getGateSummary,
  createAtomMasteryGate,
  GateEvaluator,
  getGateEvaluator,
} from './GateEvaluator.js';

// Level Manager
export {
  LEVELS,
  getLevelForXp,
  getXpToNextLevel,
  calculateQuestionXp,
  getLevelProgress,
  getUserProgressionState,
  awardXp,
  checkGateCompletion,
  getAvailablePerks,
  isFeatureUnlocked,
  LevelManager,
  getLevelManager,
} from './LevelManager.js';
