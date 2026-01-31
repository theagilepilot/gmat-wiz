# GMAT Ascension (Classic GMAT)

A local-first, minimal web UI GMAT training system that gamifies skill acquisition while enforcing mastery gates.
It adapts difficulty (ELO-like), trains GMAT performance as a muscle (recognition, decisions, execution, fundamentals, timing),
and uses reflection-first error logging with explanation reveal only after diagnosis.

## Target Audience
- Single user initially (future multi-user possible)
- 0 GMAT experience; needs fundamentals rebuild
- Target: 750–800
- 4-month intensive plan, daily use

## GMAT Exam Coverage (Classic GMAT)
- Quantitative
- Verbal
- Integrated Reasoning (IR)
- Analytical Writing Assessment (AWA)

## Runtime / Deployment
- Node.js local app with minimal web UI
- Launch: `npm run start`
- `.env` stores API keys
- Local persistence (SQLite preferred)
- Optional local folder for study docs (RAG)

## Core Product Principles
- Reflection-first: explanation shown only AFTER user classifies outcome
- Hard mastery gates: no progression with known weaknesses
- Anti-grind mechanics: prevent “XP farming”
- GMAT realism > volume (AI-generated content must be validated)

---

# Features

## 1) Daily Guidance (Scheduler)
- App chooses "what to do next" based on:
  - mastery gates currently blocking progression
  - highest-ROI weakness clusters (atom + error type + time drift)
  - recency / spaced repetition
  - section balance across Quant/Verbal/IR/AWA

Outputs:
- 1–3 training blocks
- each block includes goal + win condition + estimated time

## 2) Training Modes
### Build Mode (learning)
- hints allowed (optional, XP-taxed)
- lenient timing (level-dependent)
- stronger explanations and drills

### Prove Mode (gating)
- no hints
- strict timing windows (level-dependent)
- determines unlocks and level advancement

## 3) Question Attempt Loop (Core UX)
For each item:
1) user answers (timer visible)
2) user logs outcome:
   - Correct / Incorrect / Correct-but-slow / Inefficient-method
3) if not “clean win,” user must classify error type:
   - Concept Gap
   - Recognition Failure
   - Decision Error
   - Execution Error
   - Timing Error
   - Abandonment Failure
4) user completes 1–3 structured reflection prompts
5) app reveals explanation:
   - fastest valid approach
   - trap notes
   - time-budget guidance
6) app updates:
   - ELO ratings
   - mastery metrics
   - spaced repetition queue
   - next recommended block

## 4) Skill Atom System (Non-negotiable)
Every item is tagged with:
- Section -> Topic -> Subtopic -> Atom
- Question type
- Intended fastest method archetype
- Trap archetypes (if applicable)

This powers:
- error log specificity
- mastery gates
- adaptive scheduling

## 5) Error Log System (Smart + Question-Aware)
- Required classification when performance is not “clean win”
- Auto-suggested likely error types based on telemetry:
  - long time + wrong: timing/decision
  - fast + wrong: recognition/trap
  - right + very slow: decision/fundamental inefficiency
- Stores:
  - user reflection
  - final correct approach summary
  - "what to do next time" micro-rule

## 6) Adaptive Difficulty (ELO-like)
- Ratings maintained per:
  - section
  - question type
  - atom cluster
- Item selection:
  - mostly near current rating
  - occasional stretch items
  - heavy targeting toward blocked gates

## 7) Timing Discipline (Ramps by Level)
- Level-based time budgets:
  - early levels: generous timing to build correctness + clean execution
  - mid levels: enforce per-question budgets
  - late levels: test-realistic pacing + section endurance
- Timing metrics:
  - median time
  - variance
  - late-section drift
  - abandonment latency (how long you hold on before guessing)

## 8) AI Generation (OpenAI API)
### Generator Inputs
- section / question type / target difficulty
- target atom(s)
- allowed methods (fastest GMAT-valid)
- timing budget
- style constraints (GMAT-like wording and structure)

### Validator Pipeline (Reject unless passes)
- one unambiguous correct answer
- distractors plausible + aligned with common traps
- difficulty matches target (reasoning complexity > brute computation)
- solvable within budget using intended method
- explanation coherent and matches fastest method
- trap notes present for medium/hard

If rejection rate high:
- tighten prompt constraints automatically
- regenerate

## 9) Local RAG (Study Docs)
- optional folder: user drops notes, strategies, explanations
- retrieval augments:
  - explanations
  - concept refreshers
  - remediation drills
- if empty: normal generation and built-in concept summaries

## 10) Future: Vetted Bank Import (PDF/DOC)
Not MVP, but design now:
- user imports a PDF/DOC containing official questions and answers
- ingestion pipeline:
  - extract text
  - detect question boundaries
  - parse choices + correct answer + explanation if present
  - tag section/type/atoms (semi-automated with user review)
- stored locally as “vetted_bank” items
- scheduler can prefer vetted items for Prove Mode

---

# Level System (Classic GMAT)

Level 1 — Orientation (structure + mechanics; no grinding)
Level 2 — Foundations (atom rebuild; untimed correctness)
Level 3 — Recognition (classification + trap spotting; fast)
Level 4 — Easy Mastery (fast + accurate; no careless errors)
Level 5 — Medium Control (timed, efficient, consistent)
Level 6 — Strategy & Abandonment (guessing discipline; ROI)
Level 7 — Hard Exposure (composure + correct process)
Level 8 — Consistency (full sections; endurance + drift control)
Level 9 — Elite Execution (750–800 reliability; trap anticipation)
Level 10 — Test-Day Operator (no learning; pure performance)

Progression is blocked until all prerequisite gates are satisfied.

---

# UI Requirements (Minimal Web UI)
- keyboard-first
- timer + pace indicator always visible
- one-click error classification
- short reflection prompts (fast to complete)
- session summary + next steps
- simple dashboards:
  - readiness score
  - weakness heatmap
  - timing drift report
  - error-type trends
