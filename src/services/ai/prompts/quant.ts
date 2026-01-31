/**
 * Quantitative Section Prompts
 * Specialized prompts for Problem Solving and Data Sufficiency
 */

import type { GenerationRequest } from '../types.js';
import {
  buildGenerationPrompt,
  QUESTION_RESPONSE_FORMAT,
  DS_RESPONSE_FORMAT,
  QUESTION_GENERATOR_SYSTEM_PROMPT,
  JSON_FORMAT_INSTRUCTIONS,
} from './base.js';

// ============================================
// Problem Solving Prompts
// ============================================

export function buildProblemSolvingPrompt(request: GenerationRequest): string {
  const basePrompt = buildGenerationPrompt(request);
  
  return `${basePrompt}

**Format Requirements for Problem Solving:**
- Exactly 5 answer choices (A through E)
- Only one mathematically correct answer
- Choices should be in logical order when possible (ascending/descending numbers)
- Distractors should result from plausible calculation errors, not random values
- Numbers should be "clean" when possible (avoid excessive decimals unless testing that skill)

**Quality Checks:**
- Verify all arithmetic and algebra is correct
- Ensure the problem is solvable without a calculator
- Check that no two answers could both be correct under different interpretations
- Confirm the fastest method works within the time budget

${QUESTION_RESPONSE_FORMAT}
${JSON_FORMAT_INSTRUCTIONS}`;
}

export const PROBLEM_SOLVING_SYSTEM_PROMPT = `${QUESTION_GENERATOR_SYSTEM_PROMPT}

For GMAT Quantitative Problem Solving questions specifically:
- Problems should test mathematical reasoning, not just computation
- Avoid problems that require lengthy calculations without strategic shortcuts
- Include "trap" answers that catch common conceptual errors
- Numbers should be chosen so the correct answer is unambiguous
- Consider algebra, number properties, and strategic estimation as valid solving methods`;

// ============================================
// Data Sufficiency Prompts
// ============================================

export function buildDataSufficiencyPrompt(request: GenerationRequest): string {
  const basePrompt = buildGenerationPrompt(request);
  
  return `${basePrompt}

**Format Requirements for Data Sufficiency:**
- A clear question asking what needs to be determined
- Statement (1) providing some information
- Statement (2) providing some information
- Standard DS answer choices (A through E)

**DS-Specific Rules:**
- The question must be answerable given certain information
- Statements should be independent (one doesn't reference the other)
- "Sufficient" means the question can be answered definitively (YES or NO, a single value, etc.)
- Avoid ambiguous sufficiency (make it clear-cut)

**Statement Design Guidelines:**
- Each statement should provide different information
- Statements should not contradict each other
- Consider cases where:
  - Statement 1 alone is sufficient (Answer A)
  - Statement 2 alone is sufficient (Answer B)
  - Neither alone but both together (Answer C)
  - Each alone is sufficient (Answer D)
  - Neither helps even together (Answer E)

**Quality Checks:**
- Test each statement independently first
- Verify the combination analysis is correct
- Ensure there's only one correct answer
- Check for hidden constraints (e.g., "x is a positive integer")

${DS_RESPONSE_FORMAT}
${JSON_FORMAT_INSTRUCTIONS}`;
}

export const DATA_SUFFICIENCY_SYSTEM_PROMPT = `${QUESTION_GENERATOR_SYSTEM_PROMPT}

For GMAT Data Sufficiency questions specifically:
- The key skill is evaluating what information is SUFFICIENT, not solving for exact values
- Design statements that test whether students understand sufficiency vs. calculation
- Include scenarios where statements seem insufficient but have hidden constraints
- Test number property awareness (positive/negative, integer/decimal, zero inclusion)
- Avoid making both statements obviously insufficient or obviously sufficient`;

// ============================================
// Quant Topic-Specific Enhancements
// ============================================

export function getQuantTopicGuidance(atomNames: string[]): string {
  const guidance: string[] = [];
  
  const topicKeywords: Record<string, string> = {
    'rate': 'Include rate/time/distance or rate/time/work relationships. Use the formula: Rate × Time = Distance/Work',
    'ratio': 'Test ratio manipulation, scaling, and proportion. Consider part-to-part vs part-to-whole',
    'percent': 'Test percent change, percent of percent, and compound percent. Include "percent more/less than" scenarios',
    'exponent': 'Test exponent rules (multiplication, division, negative, fractional). Include simplification',
    'quadratic': 'Include factoring, completing the square, or quadratic formula. Test discriminant understanding',
    'probability': 'Test counting principles, combinations/permutations, conditional probability',
    'geometry': 'Include diagrams conceptually. Test properties, not just formulas',
    'coordinate': 'Test slope, distance, midpoint. Include line equation transformations',
    'statistics': 'Test mean, median, mode, range, standard deviation concepts',
    'number properties': 'Test divisibility, primes, factors, GCD/LCM, odd/even, positive/negative',
    'inequalities': 'Test inequality manipulation, especially when multiplying/dividing by negatives',
    'absolute value': 'Include cases requiring split analysis (positive and negative scenarios)',
    'sequence': 'Test arithmetic and geometric sequences. Include sum formulas',
    'function': 'Test function notation, composition, and transformation',
    'sets': 'Test Venn diagrams, union/intersection, complement',
  };
  
  for (const atom of atomNames) {
    const lowerAtom = atom.toLowerCase();
    for (const [keyword, guide] of Object.entries(topicKeywords)) {
      if (lowerAtom.includes(keyword)) {
        guidance.push(guide);
      }
    }
  }
  
  return guidance.length > 0 
    ? `\n**Topic-Specific Guidance:**\n${guidance.join('\n')}`
    : '';
}

// ============================================
// Complete Prompt Builders
// ============================================

export function buildQuantPrompt(request: GenerationRequest): {
  systemPrompt: string;
  userPrompt: string;
} {
  const topicGuidance = getQuantTopicGuidance(request.atomNames);
  
  if (request.questionType === 'data_sufficiency') {
    return {
      systemPrompt: DATA_SUFFICIENCY_SYSTEM_PROMPT,
      userPrompt: buildDataSufficiencyPrompt(request) + topicGuidance,
    };
  }
  
  return {
    systemPrompt: PROBLEM_SOLVING_SYSTEM_PROMPT,
    userPrompt: buildProblemSolvingPrompt(request) + topicGuidance,
  };
}
