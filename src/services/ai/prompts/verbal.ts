/**
 * Verbal Section Prompts
 * Specialized prompts for SC, CR, and RC questions
 */

import type { GenerationRequest } from '../types.js';
import {
  buildGenerationPrompt,
  QUESTION_RESPONSE_FORMAT,
  RC_RESPONSE_FORMAT,
  QUESTION_GENERATOR_SYSTEM_PROMPT,
  JSON_FORMAT_INSTRUCTIONS,
} from './base.js';

// ============================================
// Sentence Correction Prompts
// ============================================

export function buildSentenceCorrectionPrompt(request: GenerationRequest): string {
  const basePrompt = buildGenerationPrompt(request);
  
  return `${basePrompt}

**Format Requirements for Sentence Correction:**
- Present a sentence with an underlined portion
- Provide 5 answer choices (A through E)
- Choice A MUST repeat the underlined portion exactly (no change option)
- Only one choice should be grammatically and stylistically correct
- Other choices should contain identifiable errors

**SC-Specific Rules:**
- Test specific grammar rules, not just "sounds wrong"
- Each wrong answer should have a clear, teachable error
- Avoid choices that are both grammatically correct but stylistically different
- The correct answer should be unambiguous to an expert

**Common SC Categories to Test:**
- Subject-verb agreement (especially with intervening phrases)
- Pronoun reference and agreement
- Modifier placement (dangling, misplaced)
- Parallelism in lists and comparisons
- Verb tense consistency
- Idiom usage
- Comparison structures (like/as, more than/compared to)
- Concision (avoid redundancy)

${QUESTION_RESPONSE_FORMAT}

**Note:** Format the stem as: "The [underlined portion] was examined by researchers."
Use [brackets] to indicate the underlined portion.
${JSON_FORMAT_INSTRUCTIONS}`;
}

export const SENTENCE_CORRECTION_SYSTEM_PROMPT = `${QUESTION_GENERATOR_SYSTEM_PROMPT}

For GMAT Sentence Correction specifically:
- Focus on testing one primary grammar concept, possibly with secondary issues
- Avoid overly convoluted sentences that obscure the grammar being tested
- Wrong answers should be wrong for specific, identifiable reasons
- Right answers should be clearly superior, not just "acceptable"
- Test GMAT-specific idioms and structures that frequently appear on the exam
- Maintain formal, academic register throughout`;

// ============================================
// Critical Reasoning Prompts
// ============================================

export function buildCriticalReasoningPrompt(request: GenerationRequest): string {
  const basePrompt = buildGenerationPrompt(request);
  
  // Determine CR question subtype from atoms if possible
  const subtypeHint = determineCRSubtype(request.atomNames);
  
  return `${basePrompt}

**Format Requirements for Critical Reasoning:**
- Short argument or scenario (2-4 sentences)
- Clear question stem asking to strengthen, weaken, find assumption, etc.
- 5 answer choices (A through E)
- Only one answer that best addresses the question

**CR Question Type:** ${subtypeHint}

**CR-Specific Rules:**
- The argument should have a clear conclusion and supporting evidence
- There should be a logical gap that the question addresses
- Wrong answers should be plausible but either:
  - Irrelevant to the argument's logic
  - Address a different aspect than asked
  - Go in the wrong direction (strengthen vs weaken)
  - Be true but not impact the argument

**CR Question Types:**
- Strengthen: Find what makes the conclusion more likely
- Weaken: Find what makes the conclusion less likely
- Assumption: Find the unstated necessary assumption
- Inference: Find what must be true based on the passage
- Evaluate: Find what information would help assess the argument
- Flaw: Identify the logical flaw in the reasoning
- Paradox: Explain an apparent contradiction

${QUESTION_RESPONSE_FORMAT}
${JSON_FORMAT_INSTRUCTIONS}`;
}

function determineCRSubtype(atomNames: string[]): string {
  const lower = atomNames.map(n => n.toLowerCase()).join(' ');
  
  if (lower.includes('strengthen')) return 'STRENGTHEN - Find what supports the conclusion';
  if (lower.includes('weaken')) return 'WEAKEN - Find what undermines the conclusion';
  if (lower.includes('assumption')) return 'ASSUMPTION - Find the unstated necessary assumption';
  if (lower.includes('inference')) return 'INFERENCE - Find what must be true';
  if (lower.includes('evaluate')) return 'EVALUATE - Find what helps assess the argument';
  if (lower.includes('flaw')) return 'FLAW - Identify the logical error';
  if (lower.includes('paradox') || lower.includes('explain')) return 'PARADOX - Resolve the apparent contradiction';
  
  return 'STRENGTHEN or WEAKEN - Design based on the argument structure';
}

export const CRITICAL_REASONING_SYSTEM_PROMPT = `${QUESTION_GENERATOR_SYSTEM_PROMPT}

For GMAT Critical Reasoning specifically:
- Arguments should be realistic scenarios (business, science, policy)
- Avoid overly abstract or philosophical arguments
- The logical structure should be clear but not obvious
- Wrong answers should be tempting but distinguishable to careful readers
- Include arguments with common logical patterns:
  - Causal claims
  - Analogies
  - Statistical evidence
  - Surveys and studies
  - Predictions based on trends`;

// ============================================
// Reading Comprehension Prompts
// ============================================

export function buildReadingComprehensionPrompt(request: GenerationRequest): string {
  const basePrompt = buildGenerationPrompt(request);
  const questionSubtype = determineRCSubtype(request.atomNames);
  
  return `${basePrompt}

**Format Requirements for Reading Comprehension:**
- Passage: 200-350 words, academic but accessible
- Question about the passage
- 5 answer choices (A through E)

**RC Question Type:** ${questionSubtype}

**Passage Requirements:**
- Clear topic and main idea
- Logical paragraph structure
- Some complexity (opposing views, nuance, qualifications)
- Academic tone but not overly technical
- Should support multiple question types

**Question Type Guidelines:**

*Main Idea:* Ask what the passage is primarily about. Wrong answers are too narrow, too broad, or about minor details.

*Detail:* Ask about specific information stated in the passage. Wrong answers misstate facts or come from wrong locations.

*Inference:* Ask what can be concluded. Wrong answers go beyond what's supported or state the opposite.

*Tone/Attitude:* Ask about the author's perspective. Wrong answers mischaracterize the tone.

*Structure/Purpose:* Ask about organization or why something was included. Wrong answers misidentify rhetorical function.

${RC_RESPONSE_FORMAT}
${JSON_FORMAT_INSTRUCTIONS}`;
}

function determineRCSubtype(atomNames: string[]): string {
  const lower = atomNames.map(n => n.toLowerCase()).join(' ');
  
  if (lower.includes('main idea') || lower.includes('primary purpose')) return 'MAIN IDEA';
  if (lower.includes('detail') || lower.includes('specific')) return 'DETAIL';
  if (lower.includes('inference') || lower.includes('suggest') || lower.includes('imply')) return 'INFERENCE';
  if (lower.includes('tone') || lower.includes('attitude')) return 'TONE/ATTITUDE';
  if (lower.includes('structure') || lower.includes('purpose') || lower.includes('function')) return 'STRUCTURE/PURPOSE';
  
  return 'INFERENCE - The most common RC question type';
}

export const READING_COMPREHENSION_SYSTEM_PROMPT = `${QUESTION_GENERATOR_SYSTEM_PROMPT}

For GMAT Reading Comprehension specifically:
- Passages should be drawn from academic domains: science, business, social science, humanities
- Include passages with nuanced arguments (not simple "X is good/bad")
- Questions should require careful reading, not just keyword matching
- Wrong answers should be tempting partial truths or reasonable-sounding misinterpretations
- Main idea questions should have wrong answers that are too specific or too general`;

// ============================================
// Complete Prompt Builders
// ============================================

export function buildVerbalPrompt(request: GenerationRequest): {
  systemPrompt: string;
  userPrompt: string;
} {
  switch (request.questionType) {
    case 'sentence_correction':
      return {
        systemPrompt: SENTENCE_CORRECTION_SYSTEM_PROMPT,
        userPrompt: buildSentenceCorrectionPrompt(request),
      };
    
    case 'critical_reasoning':
      return {
        systemPrompt: CRITICAL_REASONING_SYSTEM_PROMPT,
        userPrompt: buildCriticalReasoningPrompt(request),
      };
    
    case 'reading_comprehension':
      return {
        systemPrompt: READING_COMPREHENSION_SYSTEM_PROMPT,
        userPrompt: buildReadingComprehensionPrompt(request),
      };
    
    default:
      return {
        systemPrompt: QUESTION_GENERATOR_SYSTEM_PROMPT,
        userPrompt: buildGenerationPrompt(request),
      };
  }
}
