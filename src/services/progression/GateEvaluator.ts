/**
 * Gate Evaluator
 * Evaluates mastery gate requirements for level progression
 */

import {
  getAtomMastery,
  getAllAtomMastery,
  type AtomMastery,
  MASTERY_ACCURACY_THRESHOLD,
  MASTERY_MIN_ATTEMPTS,
  MASTERY_STREAK_THRESHOLD,
} from '../../models/EloRating.js';
import { query } from '../../db/connection.js';

import type {
  GateType,
  GateStatus,
  GateRequirement,
  AccuracyRequirement,
  ConsistencyRequirement,
  VolumeRequirement,
  TimingRequirement,
  StreakRequirement,
  CompositeRequirement,
  GateProgress,
  GateEvaluationResult,
  MasteryGate,
  GateSummary,
} from './types.js';

// ============================================
// Single Requirement Evaluators
// ============================================

/**
 * Evaluate an accuracy requirement
 */
export function evaluateAccuracyRequirement(
  req: AccuracyRequirement,
  masteryData: AtomMastery[]
): GateProgress {
  // Filter to relevant atoms if specified
  const relevantMastery = req.atomIds && req.atomIds.length > 0
    ? masteryData.filter(m => req.atomIds!.includes(m.atom_id))
    : masteryData;
  
  if (relevantMastery.length === 0) {
    return {
      gateId: 0,
      gateType: 'accuracy',
      status: 'locked',
      currentValue: 0,
      requiredValue: req.threshold,
      percentComplete: 0,
      description: req.description,
      details: 'No attempts yet',
    };
  }
  
  // Use recent accuracy if window specified, otherwise overall
  const windowSize = req.windowSize ?? 0;
  let accuracy: number;
  let totalAttempts: number;
  
  if (windowSize > 0) {
    // Use recent accuracy average
    accuracy = relevantMastery.reduce((sum, m) => sum + m.recent_accuracy, 0) / relevantMastery.length;
    totalAttempts = relevantMastery.reduce((sum, m) => sum + m.recent_attempts.length, 0);
  } else {
    // Use overall accuracy
    accuracy = relevantMastery.reduce((sum, m) => sum + m.accuracy, 0) / relevantMastery.length;
    totalAttempts = relevantMastery.reduce((sum, m) => sum + m.attempts_total, 0);
  }
  
  // Check minimum attempts
  const minAttempts = req.minAttempts ?? 0;
  const hasEnoughAttempts = totalAttempts >= minAttempts;
  
  const passed = accuracy >= req.threshold && hasEnoughAttempts;
  const percentComplete = Math.min(100, (accuracy / req.threshold) * 100);
  
  let status: GateStatus;
  if (passed) {
    status = 'passed';
  } else if (totalAttempts > 0) {
    status = 'in_progress';
  } else {
    status = 'locked';
  }
  
  return {
    gateId: 0,
    gateType: 'accuracy',
    status,
    currentValue: accuracy,
    requiredValue: req.threshold,
    percentComplete: Math.round(percentComplete),
    description: req.description,
    details: `${Math.round(accuracy * 100)}% accuracy on ${totalAttempts} attempts`,
  };
}

/**
 * Evaluate a consistency requirement
 */
export function evaluateConsistencyRequirement(
  req: ConsistencyRequirement,
  masteryData: AtomMastery[]
): GateProgress {
  // Calculate variance across recent attempts
  const recentResults: boolean[] = [];
  for (const m of masteryData) {
    recentResults.push(...m.recent_attempts.slice(-req.windowSize));
  }
  
  if (recentResults.length < req.windowSize / 2) {
    return {
      gateId: 0,
      gateType: 'consistency',
      status: 'locked',
      currentValue: 1,
      requiredValue: req.threshold,
      percentComplete: 0,
      description: req.description,
      details: 'Need more attempts to measure consistency',
    };
  }
  
  // Calculate variance (standard deviation of binary results)
  const mean = recentResults.filter(Boolean).length / recentResults.length;
  const variance = recentResults.reduce((sum, r) => sum + Math.pow((r ? 1 : 0) - mean, 2), 0) / recentResults.length;
  const stdDev = Math.sqrt(variance);
  
  const passed = stdDev <= req.threshold;
  const percentComplete = Math.min(100, ((req.threshold - stdDev) / req.threshold) * 100);
  
  return {
    gateId: 0,
    gateType: 'consistency',
    status: passed ? 'passed' : 'in_progress',
    currentValue: stdDev,
    requiredValue: req.threshold,
    percentComplete: Math.max(0, Math.round(percentComplete)),
    description: req.description,
    details: `Variance: ${stdDev.toFixed(2)} (need ≤ ${req.threshold})`,
  };
}

/**
 * Evaluate a volume requirement
 */
export function evaluateVolumeRequirement(
  req: VolumeRequirement,
  masteryData: AtomMastery[]
): GateProgress {
  const totalAttempts = req.correctOnly
    ? masteryData.reduce((sum, m) => sum + m.attempts_correct, 0)
    : masteryData.reduce((sum, m) => sum + m.attempts_total, 0);
  
  const passed = totalAttempts >= req.threshold;
  const percentComplete = Math.min(100, (totalAttempts / req.threshold) * 100);
  
  return {
    gateId: 0,
    gateType: 'volume',
    status: passed ? 'passed' : (totalAttempts > 0 ? 'in_progress' : 'locked'),
    currentValue: totalAttempts,
    requiredValue: req.threshold,
    percentComplete: Math.round(percentComplete),
    description: req.description,
    details: `${totalAttempts} of ${req.threshold} ${req.correctOnly ? 'correct ' : ''}attempts`,
  };
}

/**
 * Evaluate a timing requirement
 */
export function evaluateTimingRequirement(
  req: TimingRequirement
): GateProgress {
  // This requires timing data from attempts - would need to query
  // For now, return a placeholder that can be filled in
  
  // Query timing data
  const timingData = query<{ within_budget: number; total: number }>(`
    SELECT 
      SUM(CASE WHEN time_spent_seconds <= time_budget_seconds * ? THEN 1 ELSE 0 END) as within_budget,
      COUNT(*) as total
    FROM question_attempts
    WHERE is_correct = 1
  `, [req.budgetMultiplier ?? 1.0]);
  
  if (!timingData[0] || timingData[0].total === 0) {
    return {
      gateId: 0,
      gateType: 'timing',
      status: 'locked',
      currentValue: 0,
      requiredValue: req.threshold,
      percentComplete: 0,
      description: req.description,
      details: 'No timing data available',
    };
  }
  
  const { within_budget, total } = timingData[0];
  const timingRate = within_budget / total;
  const passed = timingRate >= req.threshold;
  
  return {
    gateId: 0,
    gateType: 'timing',
    status: passed ? 'passed' : 'in_progress',
    currentValue: timingRate,
    requiredValue: req.threshold,
    percentComplete: Math.round((timingRate / req.threshold) * 100),
    description: req.description,
    details: `${Math.round(timingRate * 100)}% within time budget`,
  };
}

/**
 * Evaluate a streak requirement
 */
export function evaluateStreakRequirement(
  req: StreakRequirement,
  masteryData: AtomMastery[]
): GateProgress {
  // Find the best current streak across all atoms
  let bestStreak = 0;
  
  for (const m of masteryData) {
    let streak = 0;
    // Count from end of recent attempts
    for (let i = m.recent_attempts.length - 1; i >= 0 && m.recent_attempts[i]; i--) {
      streak++;
    }
    bestStreak = Math.max(bestStreak, streak);
  }
  
  const passed = bestStreak >= req.threshold;
  const percentComplete = Math.min(100, (bestStreak / req.threshold) * 100);
  
  return {
    gateId: 0,
    gateType: 'streak',
    status: passed ? 'passed' : (bestStreak > 0 ? 'in_progress' : 'locked'),
    currentValue: bestStreak,
    requiredValue: req.threshold,
    percentComplete: Math.round(percentComplete),
    description: req.description,
    details: `Best streak: ${bestStreak} of ${req.threshold}`,
  };
}

/**
 * Evaluate a composite requirement
 */
export function evaluateCompositeRequirement(
  req: CompositeRequirement,
  masteryData: AtomMastery[]
): GateProgress {
  const subResults: GateProgress[] = [];
  
  for (const subReq of req.requirements) {
    const result = evaluateRequirement(subReq, masteryData);
    subResults.push(result);
  }
  
  let passed: boolean;
  let percentComplete: number;
  
  if (req.passingMode === 'all') {
    passed = subResults.every(r => r.status === 'passed');
    percentComplete = subResults.reduce((sum, r) => sum + r.percentComplete, 0) / subResults.length;
  } else if (req.passingMode === 'any') {
    passed = subResults.some(r => r.status === 'passed');
    percentComplete = Math.max(...subResults.map(r => r.percentComplete));
  } else {
    // Weighted
    const weights = req.requirements.map(r => r.weight ?? 1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const weightedScore = subResults.reduce((sum, r, i) => {
      return sum + (r.status === 'passed' ? weights[i] / totalWeight : 0);
    }, 0);
    passed = weightedScore >= req.threshold;
    percentComplete = weightedScore * 100;
  }
  
  const passedCount = subResults.filter(r => r.status === 'passed').length;
  
  return {
    gateId: 0,
    gateType: 'composite',
    status: passed ? 'passed' : (passedCount > 0 ? 'in_progress' : 'locked'),
    currentValue: passedCount,
    requiredValue: subResults.length,
    percentComplete: Math.round(percentComplete),
    description: req.description,
    details: `${passedCount} of ${subResults.length} sub-requirements passed`,
  };
}

/**
 * Route to the correct evaluator based on requirement type
 */
export function evaluateRequirement(
  req: GateRequirement,
  masteryData: AtomMastery[]
): GateProgress {
  switch (req.type) {
    case 'accuracy':
      return evaluateAccuracyRequirement(req as AccuracyRequirement, masteryData);
    case 'consistency':
      return evaluateConsistencyRequirement(req as ConsistencyRequirement, masteryData);
    case 'volume':
      return evaluateVolumeRequirement(req as VolumeRequirement, masteryData);
    case 'timing':
      return evaluateTimingRequirement(req as TimingRequirement);
    case 'streak':
      return evaluateStreakRequirement(req as StreakRequirement, masteryData);
    case 'composite':
      return evaluateCompositeRequirement(req as CompositeRequirement, masteryData);
    default:
      throw new Error(`Unknown gate type: ${(req as any).type}`);
  }
}

// ============================================
// Gate Evaluation
// ============================================

/**
 * Evaluate a complete mastery gate
 */
export function evaluateGate(gate: MasteryGate): GateEvaluationResult {
  // Get mastery data for relevant atoms
  let masteryData: AtomMastery[];
  
  if (gate.atomIds && gate.atomIds.length > 0) {
    masteryData = gate.atomIds
      .map(id => getAtomMastery(id))
      .filter((m): m is AtomMastery => m !== null);
  } else {
    masteryData = getAllAtomMastery();
  }
  
  // Evaluate all requirements
  const reqResults = gate.requirements.map(req => evaluateRequirement(req, masteryData));
  
  // Gate passes if all requirements pass
  const allPassed = reqResults.every(r => r.status === 'passed');
  
  // Calculate overall progress
  const avgProgress = reqResults.reduce((sum, r) => sum + r.percentComplete, 0) / reqResults.length;
  
  // Identify blockers
  const blockers = reqResults
    .filter(r => r.status !== 'passed')
    .map(r => r.details || r.description);
  
  // Generate suggestions
  const suggestions: string[] = [];
  for (const result of reqResults) {
    if (result.status !== 'passed') {
      if (result.gateType === 'accuracy' && result.currentValue < result.requiredValue) {
        suggestions.push(`Focus on accuracy - currently at ${Math.round((result.currentValue as number) * 100)}%`);
      } else if (result.gateType === 'volume') {
        suggestions.push(`Need ${result.requiredValue - result.currentValue} more attempts`);
      } else if (result.gateType === 'streak') {
        suggestions.push(`Build a streak of ${result.requiredValue} correct answers`);
      }
    }
  }
  
  // Determine overall status
  let status: GateStatus;
  if (allPassed) {
    status = 'passed';
  } else if (reqResults.some(r => r.status === 'in_progress')) {
    status = 'in_progress';
  } else {
    status = 'locked';
  }
  
  return {
    gateId: gate.id,
    passed: allPassed,
    progress: {
      gateId: gate.id,
      gateType: 'composite',
      status,
      currentValue: reqResults.filter(r => r.status === 'passed').length,
      requiredValue: reqResults.length,
      percentComplete: Math.round(avgProgress),
      description: gate.description,
      details: `${reqResults.filter(r => r.status === 'passed').length} of ${reqResults.length} requirements met`,
    },
    blockers: blockers.length > 0 ? blockers : undefined,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}

/**
 * Get summary of all gates for a user
 */
export function getGateSummary(gates: MasteryGate[]): GateSummary {
  const results = gates.map(g => evaluateGate(g));
  
  const passedGates = results.filter(r => r.passed).length;
  const inProgressGates = results.filter(r => !r.passed && r.progress.status === 'in_progress').length;
  const lockedGates = results.filter(r => r.progress.status === 'locked').length;
  
  // Find next gate (first in_progress or first locked)
  const nextGate = gates.find((g, i) => 
    results[i].progress.status === 'in_progress' || results[i].progress.status === 'locked'
  );
  
  // Find blocking gates (in_progress with low progress)
  const blockingGates = gates.filter((g, i) => 
    !results[i].passed && results[i].progress.percentComplete < 50
  );
  
  return {
    totalGates: gates.length,
    passedGates,
    inProgressGates,
    lockedGates,
    nextGate,
    blockingGates,
  };
}

// ============================================
// Default Gate Definitions
// ============================================

/**
 * Create standard atom mastery gate
 */
export function createAtomMasteryGate(atomId: number, atomName: string): MasteryGate {
  return {
    id: atomId,
    levelNumber: 0,
    name: `Master: ${atomName}`,
    description: `Demonstrate mastery of ${atomName}`,
    requirements: [
      { 
        type: 'accuracy', 
        threshold: MASTERY_ACCURACY_THRESHOLD, 
        description: `${Math.round(MASTERY_ACCURACY_THRESHOLD * 100)}% accuracy`,
      },
      { 
        type: 'volume', 
        threshold: MASTERY_MIN_ATTEMPTS, 
        description: `At least ${MASTERY_MIN_ATTEMPTS} attempts`,
      },
      { 
        type: 'streak', 
        threshold: MASTERY_STREAK_THRESHOLD, 
        description: `${MASTERY_STREAK_THRESHOLD} correct in a row`,
      },
    ],
    atomIds: [atomId],
    xpReward: 100,
  };
}

// ============================================
// Singleton Export
// ============================================

let evaluatorInstance: GateEvaluator | null = null;

export class GateEvaluator {
  evaluateAccuracyRequirement = evaluateAccuracyRequirement;
  evaluateConsistencyRequirement = evaluateConsistencyRequirement;
  evaluateVolumeRequirement = evaluateVolumeRequirement;
  evaluateTimingRequirement = evaluateTimingRequirement;
  evaluateStreakRequirement = evaluateStreakRequirement;
  evaluateCompositeRequirement = evaluateCompositeRequirement;
  evaluateRequirement = evaluateRequirement;
  evaluateGate = evaluateGate;
  getGateSummary = getGateSummary;
  createAtomMasteryGate = createAtomMasteryGate;
}

export function getGateEvaluator(): GateEvaluator {
  if (!evaluatorInstance) {
    evaluatorInstance = new GateEvaluator();
  }
  return evaluatorInstance;
}
