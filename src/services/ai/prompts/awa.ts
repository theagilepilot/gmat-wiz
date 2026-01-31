/**
 * AWA (Analytical Writing Assessment) Prompts
 * Prompts for generating AWA essay prompts and sample outlines
 */

import type { GenerationRequest, AWAPrompt } from '../types.js';
import {
  QUESTION_GENERATOR_SYSTEM_PROMPT,
  JSON_FORMAT_INSTRUCTIONS,
} from './base.js';

// ============================================
// AWA Argument Analysis Prompt
// ============================================

export function buildAWAPrompt(request: GenerationRequest): string {
  return `Generate a GMAT Analytical Writing Assessment (AWA) prompt.

**Target Difficulty:** ${request.targetDifficulty} ELO

**AWA Format:**
The AWA presents a brief argument that the test-taker must analyze in a 30-minute essay.
The task is to critique the argument's reasoning, NOT to state personal opinions on the topic.

**Argument Characteristics:**
- 3-4 sentences presenting a position
- Contains 2-4 logical flaws
- Based on some evidence or reasoning
- Reaches a conclusion that may not be fully supported

**Common Logical Flaws to Include:**
- Hasty generalization (small sample to broad conclusion)
- Post hoc fallacy (assuming causation from correlation)
- False dichotomy (presenting only two options)
- Unwarranted assumption (unstated but required premise)
- Weak analogy (comparing dissimilar things)
- Appeal to authority (citing inappropriate sources)
- Circular reasoning (conclusion assumes itself)
- Overgeneralization (using words like "all" or "never")
- Ignoring alternatives (not considering other explanations)
- Sampling bias (unrepresentative data)

**Topics:** Business, policy, education, environment, economics, technology

Respond with JSON:
{
  "argument": "The full argument text (3-4 sentences)",
  "topic": "Brief topic description",
  "logicalFlaws": [
    {"name": "Flaw name", "description": "How this flaw appears in the argument"},
    {"name": "Second flaw", "description": "How this flaw appears"}
  ],
  "suggestedStructure": [
    "Paragraph 1: Introduction - summarize the argument and state your task",
    "Paragraph 2: First major flaw with explanation",
    "Paragraph 3: Second major flaw with explanation",
    "Paragraph 4: Additional weaknesses or conditions that would strengthen",
    "Paragraph 5: Conclusion - summarize flaws and suggest improvements"
  ],
  "sampleOutline": "Brief bullet points of what a strong response would cover",
  "strongResponseHints": ["Hint 1", "Hint 2", "Hint 3"],
  "estimatedDifficulty": ${request.targetDifficulty}
}
${JSON_FORMAT_INSTRUCTIONS}`;
}

// ============================================
// AWA System Prompt
// ============================================

export const AWA_SYSTEM_PROMPT = `${QUESTION_GENERATOR_SYSTEM_PROMPT}

For GMAT AWA specifically:
- Arguments should be from realistic business/policy contexts
- Include 2-4 identifiable logical flaws
- Arguments should sound reasonable at first but have clear weaknesses upon analysis
- Avoid politically charged or controversial topics
- The argument should be analyzable in 30 minutes
- Include enough complexity to differentiate strong from weak responses`;

// ============================================
// AWA Evaluation Rubric
// ============================================

export const AWA_SCORING_CRITERIA = `
**AWA Scoring Rubric (0-6 scale):**

**6 (Outstanding):**
- Identifies and insightfully analyzes the argument's key flaws
- Develops ideas cogently with well-chosen examples
- Well organized with clear transitions
- Demonstrates superior control of language
- May have minor errors that don't interfere with meaning

**5 (Strong):**
- Identifies and clearly analyzes the argument's main flaws
- Develops ideas clearly with relevant examples
- Generally well organized
- Demonstrates clear control of language
- May have occasional errors

**4 (Adequate):**
- Identifies and analyzes some important flaws
- Develops ideas adequately
- Adequately organized
- Demonstrates adequate control of language
- May have some flaws in grammar/usage

**3 (Limited):**
- Some analysis but may not identify major flaws
- Ideas may be vague or underdeveloped
- Organization may be unclear
- Has errors that occasionally obscure meaning

**2 (Seriously Flawed):**
- Little relevant analysis
- Ideas poorly developed
- Poorly organized
- Has frequent errors that obscure meaning

**1 (Fundamentally Deficient):**
- Little or no analysis
- Severely underdeveloped
- Severely flawed organization
- Pervasive errors

**0:** Off-topic, blank, or not in English
`;

// ============================================
// Sample AWA Topics by Category
// ============================================

export const AWA_TOPIC_CATEGORIES = {
  business: [
    'Company profitability and employee satisfaction',
    'Market expansion strategies',
    'Product quality vs. cost reduction',
    'Employee incentive programs',
    'Corporate social responsibility',
  ],
  policy: [
    'Government regulation of industry',
    'Educational funding allocation',
    'Urban development priorities',
    'Environmental protection measures',
    'Public health initiatives',
  ],
  education: [
    'Teaching methods and student outcomes',
    'Technology in the classroom',
    'Standardized testing effectiveness',
    'Curriculum development',
    'Higher education funding',
  ],
  economics: [
    'Consumer behavior predictions',
    'Economic indicators and forecasts',
    'Industry trend analysis',
    'Investment strategy recommendations',
    'Labor market dynamics',
  ],
};

// ============================================
// Complete Prompt Builder
// ============================================

export function buildCompleteAWAPrompt(request: GenerationRequest): {
  systemPrompt: string;
  userPrompt: string;
} {
  return {
    systemPrompt: AWA_SYSTEM_PROMPT,
    userPrompt: buildAWAPrompt(request),
  };
}
