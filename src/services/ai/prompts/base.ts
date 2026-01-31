/**
 * Base Prompt Templates
 * Core prompts and helpers for AI question generation
 */

import type { GenerationRequest, GMATSection, QuestionTypeCode } from '../types.js';

// ============================================
// System Prompts
// ============================================

export const QUESTION_GENERATOR_SYSTEM_PROMPT = `You are an expert GMAT question writer with decades of experience creating official GMAT questions. Your questions are known for:

1. **Precision**: Every question has exactly one unambiguous correct answer
2. **Authenticity**: Questions match the style, difficulty, and format of real GMAT questions
3. **Educational Value**: Each question tests specific skills and concepts
4. **Strategic Traps**: Distractors are designed to catch common errors, not trick unfairly

You understand:
- GMAT scoring (200-800) and difficulty levels
- Question timing constraints (2 min for quant, 1.5-2 min for verbal)
- Common student mistakes at each difficulty level
- The difference between testing knowledge vs. testing problem-solving ability

When generating questions, you always:
- Ensure mathematical accuracy (verify all calculations)
- Make distractors plausible but clearly wrong
- Include efficient solving methods, not just brute force
- Note any traps or common errors that might catch students`;

export const JSON_FORMAT_INSTRUCTIONS = `
Respond with a valid JSON object. Do not include any text outside the JSON.
Do not wrap the JSON in markdown code blocks.`;

// ============================================
// Difficulty Descriptions
// ============================================

export function getDifficultyDescription(eloRating: number): string {
  if (eloRating < 400) {
    return 'Very Easy (Foundation level) - Basic concepts, straightforward application, minimal steps';
  } else if (eloRating < 500) {
    return 'Easy (Below Average) - Standard problems, clear path to solution, 1-2 steps';
  } else if (eloRating < 550) {
    return 'Medium-Easy (Average) - Some complexity, may require 2-3 steps or insight';
  } else if (eloRating < 600) {
    return 'Medium (Above Average) - Moderate complexity, requires solid understanding, strategic approach helps';
  } else if (eloRating < 650) {
    return 'Medium-Hard (Good) - Complex problems, multiple concepts, time pressure matters';
  } else if (eloRating < 700) {
    return 'Hard (Very Good) - Challenging problems, advanced concepts, traps present';
  } else if (eloRating < 750) {
    return 'Very Hard (Excellent) - High complexity, subtle traps, efficient method crucial';
  } else {
    return 'Expert (Top Percentile) - Extremely challenging, multiple advanced concepts, expert-level traps';
  }
}

export function getTargetTime(section: GMATSection, questionType: QuestionTypeCode, difficulty: number): number {
  // Base times in seconds
  const baseTimes: Record<string, number> = {
    problem_solving: 120,
    data_sufficiency: 120,
    sentence_correction: 90,
    critical_reasoning: 120,
    reading_comprehension: 120, // per question, not passage
    graphics_interpretation: 150,
    two_part_analysis: 180,
    table_analysis: 180,
    multi_source_reasoning: 180,
    awa_essay: 1800, // 30 minutes
  };

  const base = baseTimes[questionType] ?? 120;
  
  // Adjust for difficulty: harder questions get slightly more time
  const difficultyFactor = 1 + (difficulty - 500) / 1000; // 0.8x to 1.3x
  
  return Math.round(base * Math.max(0.8, Math.min(1.3, difficultyFactor)));
}

// ============================================
// Question Type Descriptions
// ============================================

export function getQuestionTypeDescription(questionType: QuestionTypeCode): string {
  const descriptions: Record<QuestionTypeCode, string> = {
    problem_solving: `Problem Solving: Standard multiple-choice math problems. Student must find the correct numerical or algebraic answer from 5 choices.`,
    
    data_sufficiency: `Data Sufficiency: Unique GMAT format. Given a question and two statements, determine if the statements provide sufficient information to answer. Choices are always:
A) Statement 1 alone is sufficient
B) Statement 2 alone is sufficient  
C) Both statements together are sufficient
D) Each statement alone is sufficient
E) Neither statement, even together, is sufficient`,
    
    sentence_correction: `Sentence Correction: Part or all of a sentence is underlined. Choose the best version from 5 options. Tests grammar, style, and clarity. Option A always repeats the original.`,
    
    critical_reasoning: `Critical Reasoning: Short argument followed by a question about strengthening, weakening, assumptions, inferences, or evaluation. Tests logical reasoning ability.`,
    
    reading_comprehension: `Reading Comprehension: Questions based on a passage (200-350 words). Tests understanding of main ideas, details, inferences, tone, and structure.`,
    
    graphics_interpretation: `Graphics Interpretation: Interpret data from graphs, charts, or other visual displays. Fill-in-the-blank format with dropdown menus.`,
    
    two_part_analysis: `Two-Part Analysis: Problems requiring two related answers. Could be quantitative, verbal, or a combination. Answers are selected from a table.`,
    
    table_analysis: `Table Analysis: Analyze data presented in a sortable table. Answer multiple true/false or yes/no questions about the data.`,
    
    multi_source_reasoning: `Multi-Source Reasoning: Synthesize information from multiple sources (tabs). Answer questions requiring integration of data from different sources.`,
    
    awa_essay: `Analytical Writing Assessment: Analyze an argument's reasoning and evidence. Write a critique identifying logical flaws and unsupported assumptions.`,
  };

  return descriptions[questionType] ?? 'Unknown question type';
}

// ============================================
// Trap Archetype Descriptions
// ============================================

export function getTrapDescription(trapArchetype: string): string {
  const traps: Record<string, string> = {
    // Quant traps
    calculation_trap: 'Include a distractor that results from a common arithmetic error (sign error, order of operations mistake)',
    partial_answer: 'Include a distractor that is a correct intermediate result but not the final answer',
    unit_trap: 'Include a distractor that results from forgetting unit conversion or using wrong units',
    reverse_trap: 'Include a distractor that comes from solving the inverse problem or misreading what\'s being asked',
    approximation_trap: 'Include a distractor that seems close to the correct answer but uses wrong rounding',
    assumption_trap: 'Include a distractor that requires an unstated assumption that isn\'t valid',
    
    // Verbal traps
    extreme_language: 'Include a distractor with absolute words (always, never, all, none) that goes too far',
    out_of_scope: 'Include a distractor that sounds relevant but introduces information not in the passage/argument',
    opposite_trap: 'Include a distractor that states the opposite of what\'s supported',
    too_narrow: 'Include a distractor that is true but only partially addresses the question',
    too_broad: 'Include a distractor that is too general or sweeping',
    correlation_causation: 'Include a distractor that confuses correlation with causation',
    
    // DS traps  
    insufficient_combo: 'Make both statements individually insufficient but together sufficient (or vice versa)',
    hidden_constraint: 'Include a statement that seems insufficient but contains a hidden constraint',
    number_properties: 'Test whether statements determine number properties (positive/negative, integer/non-integer)',
  };

  return traps[trapArchetype] ?? 'Include plausible distractors based on common student errors';
}

// ============================================
// Base Generation Prompt Builder
// ============================================

export function buildGenerationPrompt(request: GenerationRequest): string {
  const {
    section,
    questionType,
    targetDifficulty,
    atomNames,
    atomDescriptions,
    trapArchetype,
    methodHint,
    timeBudgetSeconds,
    avoidSimilarTo,
  } = request;

  const difficultyDesc = getDifficultyDescription(targetDifficulty);
  const questionTypeDesc = getQuestionTypeDescription(questionType);
  const targetTime = timeBudgetSeconds ?? getTargetTime(section, questionType, targetDifficulty);

  let prompt = `Generate a GMAT ${section.toUpperCase()} question with the following specifications:

**Question Type:** ${questionType.replace(/_/g, ' ').toUpperCase()}
${questionTypeDesc}

**Target Difficulty:** ${targetDifficulty} ELO
${difficultyDesc}

**Concepts to Test:**
${atomNames.map((name, i) => `- ${name}: ${atomDescriptions[i] || 'Core concept'}`).join('\n')}

**Time Budget:** ${targetTime} seconds
The question should be solvable within this time by a student at this difficulty level using the optimal method.
`;

  if (methodHint) {
    prompt += `\n**Preferred Solving Method:** ${methodHint}
Design the question so this method is the fastest path to the answer.
`;
  }

  if (trapArchetype) {
    prompt += `\n**Trap Archetype:** ${trapArchetype}
${getTrapDescription(trapArchetype)}
`;
  }

  if (avoidSimilarTo && avoidSimilarTo.length > 0) {
    prompt += `\n**Avoid Similar Questions:**
The following question stems have been recently used. Create something distinctly different:
${avoidSimilarTo.slice(0, 3).map(s => `- "${s.slice(0, 100)}..."`).join('\n')}
`;
  }

  return prompt;
}

// ============================================
// Response Format Templates
// ============================================

export const QUESTION_RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "stem": "The complete question text, including any setup or context",
  "choices": [
    {"label": "A", "text": "First choice", "isCorrect": false, "trapType": "calculation_trap"},
    {"label": "B", "text": "Second choice", "isCorrect": true, "trapType": null},
    {"label": "C", "text": "Third choice", "isCorrect": false, "trapType": "partial_answer"},
    {"label": "D", "text": "Fourth choice", "isCorrect": false, "trapType": null},
    {"label": "E", "text": "Fifth choice", "isCorrect": false, "trapType": null}
  ],
  "correctAnswer": "B",
  "explanation": "Step-by-step solution explaining the fastest method and why each wrong answer is wrong",
  "fastestMethod": "Brief description of the most efficient solving approach",
  "trapNotes": "Description of common errors this question might catch (or null if none)",
  "estimatedDifficulty": 550,
  "timeBudgetSeconds": 120
}`;

export const DS_RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "stem": "The question being asked (what we need to determine)",
  "statement1": "First statement providing information",
  "statement2": "Second statement providing information",
  "choices": [
    {"label": "A", "text": "Statement (1) ALONE is sufficient, but statement (2) alone is not sufficient", "isCorrect": false},
    {"label": "B", "text": "Statement (2) ALONE is sufficient, but statement (1) alone is not sufficient", "isCorrect": false},
    {"label": "C", "text": "BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient", "isCorrect": true},
    {"label": "D", "text": "EACH statement ALONE is sufficient", "isCorrect": false},
    {"label": "E", "text": "Statements (1) and (2) TOGETHER are NOT sufficient", "isCorrect": false}
  ],
  "correctAnswer": "C",
  "explanation": "Analysis of each statement alone, then together, explaining why each is/isn't sufficient",
  "fastestMethod": "Key insight or shortcut for evaluating sufficiency",
  "trapNotes": "Common mistakes students make on this type of DS question",
  "estimatedDifficulty": 600,
  "timeBudgetSeconds": 120
}`;

export const RC_RESPONSE_FORMAT = `
Respond with a JSON object in this exact format:
{
  "passage": {
    "text": "The full reading passage (200-350 words)",
    "wordCount": 275,
    "topic": "Brief topic description",
    "structure": "argument|compare_contrast|cause_effect|narrative|analysis"
  },
  "stem": "The question about the passage",
  "questionSubtype": "main_idea|detail|inference|tone|structure|strengthen_weaken",
  "choices": [
    {"label": "A", "text": "First choice", "isCorrect": false, "trapType": "out_of_scope"},
    {"label": "B", "text": "Second choice", "isCorrect": true, "trapType": null},
    {"label": "C", "text": "Third choice", "isCorrect": false, "trapType": "too_narrow"},
    {"label": "D", "text": "Fourth choice", "isCorrect": false, "trapType": "opposite_trap"},
    {"label": "E", "text": "Fifth choice", "isCorrect": false, "trapType": "extreme_language"}
  ],
  "correctAnswer": "B",
  "explanation": "Why B is correct and why each other choice is wrong, with passage references",
  "fastestMethod": "Efficient approach to this question type",
  "trapNotes": "Common traps in this RC question",
  "estimatedDifficulty": 580,
  "timeBudgetSeconds": 120
}`;
