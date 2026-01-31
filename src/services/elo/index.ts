/**
 * ELO Services - Index
 * Exports all ELO-related services
 */

// Types
export * from './types.js';

// Constants
export * from './constants.js';

// Calculator
export {
  calculateExpectedWinRate,
  getKFactor,
  calculateRawEloChange,
  getTimingFactor,
  detectGrinding,
  getAntiGrindMultiplier,
  getMomentumState,
  getRatingConfidence,
  calculateAdjustedEloChange,
  updateRatingWithAdjustments,
  updateMultiScopeRatings,
  EloCalculator,
  getEloCalculator,
} from './EloCalculator.js';

// Question Selector
export {
  calculateDifficultyTarget,
  categorizeDifficulty,
  scoreQuestion,
  calculateSelectionPlan,
  getUserElo,
  fetchCandidateQuestions,
  selectQuestions,
  getNextQuestion,
  QuestionSelector,
  getQuestionSelector,
  type SelectionMode,
  type SelectionCriteria,
  type SelectedQuestion,
} from './QuestionSelector.js';

// Difficulty Matcher
export {
  getDifficultyBands,
  getBandForRating,
  getQuestionBand,
  calculateMatchScore,
  getMatchQuality,
  analyzeMatch,
  getRecommendedDifficulty,
  findDifficultyForWinRate,
  isQuestionAppropriate,
  sortByMatchQuality,
  filterByAppropriateness,
  analyzeDifficultyDistribution,
  DifficultyMatcher,
  getDifficultyMatcher,
} from './DifficultyMatcher.js';
