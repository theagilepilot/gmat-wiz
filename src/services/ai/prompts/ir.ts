/**
 * Integrated Reasoning Section Prompts
 * Specialized prompts for IR question types
 */

import type { GenerationRequest } from '../types.js';
import {
  buildGenerationPrompt,
  QUESTION_GENERATOR_SYSTEM_PROMPT,
  JSON_FORMAT_INSTRUCTIONS,
} from './base.js';

// ============================================
// Graphics Interpretation Prompts
// ============================================

export function buildGraphicsInterpretationPrompt(request: GenerationRequest): string {
  const basePrompt = buildGenerationPrompt(request);
  
  return `${basePrompt}

**Format Requirements for Graphics Interpretation:**
- Describe a graph, chart, or data visualization
- Create 2-3 fill-in-the-blank questions with dropdown options
- Each blank should have 3-5 answer options

**Supported Graph Types:**
- Line graphs (trends over time)
- Bar charts (comparisons)
- Scatter plots (correlations)
- Pie charts (proportions)
- Combined/dual-axis charts

**GI-Specific Guidelines:**
- Describe the graph clearly enough to be understood without seeing it
- Questions should test graph reading skills, not just arithmetic
- Include questions about trends, comparisons, and calculations
- Dropdown options should include plausible wrong answers

Respond with JSON:
{
  "graphDescription": "Detailed description of the graph including title, axes, data points",
  "graphType": "line|bar|scatter|pie|combined",
  "dataPoints": [{"label": "...", "value": ...}, ...],
  "questions": [
    {
      "text": "According to the graph, the [BLANK1] occurred in [BLANK2].",
      "blanks": [
        {"id": "BLANK1", "options": ["highest sales", "lowest sales", "median sales"], "correctAnswer": "highest sales"},
        {"id": "BLANK2", "options": ["2020", "2021", "2022"], "correctAnswer": "2021"}
      ]
    }
  ],
  "explanation": "How to read the graph and find the answers",
  "estimatedDifficulty": 550,
  "timeBudgetSeconds": 150
}
${JSON_FORMAT_INSTRUCTIONS}`;
}

// ============================================
// Two-Part Analysis Prompts
// ============================================

export function buildTwoPartAnalysisPrompt(request: GenerationRequest): string {
  const basePrompt = buildGenerationPrompt(request);
  
  return `${basePrompt}

**Format Requirements for Two-Part Analysis:**
- Problem requiring two related answers
- Both answers selected from the same set of options
- Can be quantitative, verbal, or mixed

**TPA Question Structures:**
- Algebraic: Find values for two variables
- Logical: Identify premise and conclusion
- Strategic: Find costs and revenues, or cause and effect
- Verbal: Strengthen AND weaken an argument

**TPA-Specific Guidelines:**
- The two answers should be related but distinct
- Usually 5-6 options to choose from
- Some options may be used for both, one, or neither
- Table format with two columns for selection

Respond with JSON:
{
  "stem": "Problem description and context",
  "column1Label": "Label for first selection (e.g., 'Value of X')",
  "column2Label": "Label for second selection (e.g., 'Value of Y')",
  "options": [
    {"label": "A", "text": "Option A"},
    {"label": "B", "text": "Option B"},
    {"label": "C", "text": "Option C"},
    {"label": "D", "text": "Option D"},
    {"label": "E", "text": "Option E"},
    {"label": "F", "text": "Option F"}
  ],
  "correctColumn1": "B",
  "correctColumn2": "D",
  "explanation": "Step-by-step solution for both parts",
  "fastestMethod": "Efficient approach to solve both parts",
  "estimatedDifficulty": 580,
  "timeBudgetSeconds": 180
}
${JSON_FORMAT_INSTRUCTIONS}`;
}

// ============================================
// Table Analysis Prompts
// ============================================

export function buildTableAnalysisPrompt(request: GenerationRequest): string {
  const basePrompt = buildGenerationPrompt(request);
  
  return `${basePrompt}

**Format Requirements for Table Analysis:**
- Sortable data table with 4-6 columns and 8-12 rows
- 3 true/false or yes/no statements about the data
- Statements should require sorting or calculation to verify

**Table Content Guidelines:**
- Realistic data (business metrics, statistics, survey results)
- Include sortable numeric and text columns
- Data should allow for multiple valid sorts
- Numbers should support calculations without a calculator

**Statement Types:**
- Direct lookup (but requires finding right cell)
- Comparison (requires sorting)
- Calculation (percentage, difference, ratio)
- Conditional (if X, then Y)

Respond with JSON:
{
  "tableTitle": "Title describing the data",
  "columns": ["Column1", "Column2", "Column3", "Column4", "Column5"],
  "rows": [
    ["Row1Col1", "Row1Col2", "Row1Col3", "Row1Col4", "Row1Col5"],
    ["Row2Col1", "Row2Col2", "Row2Col3", "Row2Col4", "Row2Col5"]
  ],
  "statements": [
    {"text": "Statement about the data", "isTrue": true, "explanation": "Why true/false"},
    {"text": "Another statement", "isTrue": false, "explanation": "Why true/false"},
    {"text": "Third statement", "isTrue": true, "explanation": "Why true/false"}
  ],
  "sortHint": "Which column to sort by to answer efficiently",
  "estimatedDifficulty": 560,
  "timeBudgetSeconds": 180
}
${JSON_FORMAT_INSTRUCTIONS}`;
}

// ============================================
// Multi-Source Reasoning Prompts
// ============================================

export function buildMultiSourceReasoningPrompt(request: GenerationRequest): string {
  const basePrompt = buildGenerationPrompt(request);
  
  return `${basePrompt}

**Format Requirements for Multi-Source Reasoning:**
- 2-3 information sources (tabs/documents)
- Each source provides different but related information
- 3 yes/no questions requiring information from multiple sources

**Source Types:**
- Email correspondence
- Report excerpts
- Data tables
- Policy documents
- News articles

**MSR-Specific Guidelines:**
- Sources should not be redundant
- Questions should require synthesizing information across sources
- Some information may conflict or need reconciliation
- Include questions that test:
  - Direct information lookup
  - Inference across sources
  - Contradiction identification

Respond with JSON:
{
  "sources": [
    {"title": "Email from Marketing Director", "type": "email", "content": "Full text..."},
    {"title": "Q3 Sales Report", "type": "report", "content": "Full text or data..."},
    {"title": "Company Policy Memo", "type": "memo", "content": "Full text..."}
  ],
  "questions": [
    {
      "text": "Based on the information provided, [statement]",
      "isTrue": true,
      "explanation": "Cite which sources and why",
      "sourcesNeeded": ["Email from Marketing Director", "Q3 Sales Report"]
    }
  ],
  "estimatedDifficulty": 600,
  "timeBudgetSeconds": 180
}
${JSON_FORMAT_INSTRUCTIONS}`;
}

// ============================================
// IR System Prompt
// ============================================

export const IR_SYSTEM_PROMPT = `${QUESTION_GENERATOR_SYSTEM_PROMPT}

For GMAT Integrated Reasoning specifically:
- IR tests the ability to evaluate information from multiple sources
- Questions require real-world data interpretation skills
- Problems often have business or research contexts
- Calculator is allowed, so mental math shortcuts are less important
- Focus on data analysis, not computation
- Time management is crucial (12 questions in 30 minutes)`;

// ============================================
// Complete Prompt Builder
// ============================================

export function buildIRPrompt(request: GenerationRequest): {
  systemPrompt: string;
  userPrompt: string;
} {
  let userPrompt: string;
  
  switch (request.questionType) {
    case 'graphics_interpretation':
      userPrompt = buildGraphicsInterpretationPrompt(request);
      break;
    
    case 'two_part_analysis':
      userPrompt = buildTwoPartAnalysisPrompt(request);
      break;
    
    case 'table_analysis':
      userPrompt = buildTableAnalysisPrompt(request);
      break;
    
    case 'multi_source_reasoning':
      userPrompt = buildMultiSourceReasoningPrompt(request);
      break;
    
    default:
      userPrompt = buildGenerationPrompt(request);
  }
  
  return {
    systemPrompt: IR_SYSTEM_PROMPT,
    userPrompt,
  };
}
