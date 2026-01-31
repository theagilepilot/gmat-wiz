# GMAT Ascension — Implementation Plan

A step-by-step guide for building the local-first GMAT training system with gamification, adaptive difficulty, and reflection-first error logging.

---

## Phase 1: Project Foundation

### Step 1.1: Initialize Project Structure
- **Task**: Set up Node.js project with essential configuration files and folder structure
- **Files**:
  - `package.json`: Node.js manifest with scripts and dependencies
  - `.env.example`: Template for environment variables (OpenAI API key)
  - `.gitignore`: Ignore node_modules, .env, SQLite DB, study-docs
  - `tsconfig.json`: TypeScript configuration (strict mode)
  - `src/index.ts`: Application entry point
  - `src/config/index.ts`: Environment and app configuration loader
  - `README.md`: Setup and usage instructions
- **Step Dependencies**: None
- **User Instructions**: 
  - Run `npm install` after step completes
  - Copy `.env.example` to `.env` and add OpenAI API key

### Step 1.2: Set Up Express Server & Static File Serving
- **Task**: Create Express server with middleware, static file serving for the web UI, and basic health check endpoint
- **Files**:
  - `src/server.ts`: Express app configuration and middleware setup
  - `src/routes/index.ts`: Route aggregator
  - `src/routes/health.ts`: Health check endpoint
  - `src/middleware/errorHandler.ts`: Global error handling middleware
  - `src/middleware/requestLogger.ts`: Request logging middleware
  - `public/index.html`: Base HTML shell for the web UI
  - `public/css/main.css`: Base styles (minimal, keyboard-first design)
  - `public/js/app.js`: Frontend JavaScript entry point
- **Step Dependencies**: Step 1.1
- **User Instructions**: Run `npm run dev` to start development server

### Step 1.3: SQLite Database Setup
- **Task**: Initialize SQLite database connection with better-sqlite3 and create migration system
- **Files**:
  - `src/db/connection.ts`: Database connection singleton
  - `src/db/migrations/index.ts`: Migration runner
  - `src/db/migrations/001_initial_schema.ts`: Base tables migration
  - `src/db/seed/index.ts`: Seed data runner
  - `data/.gitkeep`: Ensure data directory exists (DB stored here)
- **Step Dependencies**: Step 1.1
- **User Instructions**: Database file auto-created at `data/gmat-ascension.db`

---

## Phase 2: Core Data Models & Schema

### Step 2.1: User Progress & Settings Schema
- **Task**: Create tables for user profile, settings, current level, and overall progress tracking
- **Files**:
  - `src/db/migrations/002_user_progress.ts`: User progress tables
  - `src/models/UserProgress.ts`: TypeScript interfaces and DB access methods
  - `src/services/UserProgressService.ts`: Business logic for progress tracking
- **Step Dependencies**: Step 1.3
- **User Instructions**: None

**Schema Design:**
```sql
user_profile: id, created_at, current_level, total_xp, study_streak_days
user_settings: id, daily_goal_minutes, preferred_sections, hints_enabled
level_progress: id, level_number, status (locked/active/completed), unlocked_at, completed_at
```

### Step 2.2: Skill Atom Taxonomy Schema
- **Task**: Create hierarchical skill taxonomy tables (Section → Topic → Subtopic → Atom)
- **Files**:
  - `src/db/migrations/003_skill_atoms.ts`: Taxonomy tables
  - `src/models/SkillAtom.ts`: TypeScript interfaces
  - `src/services/SkillAtomService.ts`: Taxonomy query methods
  - `src/types/taxonomy.ts`: Shared taxonomy type definitions
- **Step Dependencies**: Step 1.3
- **User Instructions**: None

**Schema Design:**
```sql
sections: id, name (Quant/Verbal/IR/AWA), description
topics: id, section_id, name, description, sort_order
subtopics: id, topic_id, name, description, sort_order
atoms: id, subtopic_id, name, description, difficulty_tier, prerequisite_atoms
```

### Step 2.3: Question & Attempt Schema
- **Task**: Create tables for questions (AI-generated and vetted), attempts, and attempt metadata
- **Files**:
  - `src/db/migrations/004_questions.ts`: Question and attempt tables
  - `src/models/Question.ts`: Question interfaces and DB methods
  - `src/models/Attempt.ts`: Attempt interfaces and DB methods
  - `src/types/question.ts`: Question type definitions (enums, interfaces)
- **Step Dependencies**: Step 2.2
- **User Instructions**: None

**Schema Design:**
```sql
questions: id, atom_ids (JSON), section, question_type, difficulty_rating, 
           stem, choices (JSON), correct_answer, explanation, trap_notes,
           fastest_method, time_budget_seconds, source (ai/vetted), 
           validation_status, created_at

attempts: id, question_id, started_at, ended_at, time_spent_seconds,
          user_answer, is_correct, outcome_type (clean_win/incorrect/slow/inefficient),
          mode (build/prove), hints_used, level_at_attempt
```

### Step 2.4: Error Log & Reflection Schema
- **Task**: Create tables for error classification, reflections, and micro-rules
- **Files**:
  - `src/db/migrations/005_error_logs.ts`: Error log tables
  - `src/models/ErrorLog.ts`: Error log interfaces and methods
  - `src/types/errors.ts`: Error type enums and definitions
  - `src/services/ErrorLogService.ts`: Error analysis and suggestions
- **Step Dependencies**: Step 2.3
- **User Instructions**: None

**Schema Design:**
```sql
error_logs: id, attempt_id, error_type (concept_gap/recognition/decision/execution/timing/abandonment),
            user_reflection, correct_approach_summary, micro_rule, suggested_by_system, created_at

error_type_definitions: id, error_type, description, typical_signals, remediation_hint
```

### Step 2.5: ELO Ratings Schema
- **Task**: Create tables for tracking ELO ratings per section, question type, and atom cluster
- **Files**:
  - `src/db/migrations/006_elo_ratings.ts`: ELO rating tables
  - `src/models/EloRating.ts`: Rating interfaces and methods
  - `src/services/EloService.ts`: ELO calculation engine
  - `src/types/elo.ts`: ELO-related type definitions
- **Step Dependencies**: Step 2.2
- **User Instructions**: None

**Schema Design:**
```sql
elo_ratings: id, scope_type (section/question_type/atom_cluster), scope_id, 
             current_rating, peak_rating, games_played, last_updated

rating_history: id, elo_rating_id, old_rating, new_rating, question_id, 
                attempt_id, timestamp
```

### Step 2.6: Spaced Repetition & Scheduling Schema
- **Task**: Create tables for spaced repetition queue and training block scheduling
- **Files**:
  - `src/db/migrations/007_scheduling.ts`: Scheduling tables
  - `src/models/Schedule.ts`: Schedule interfaces and methods
  - `src/types/schedule.ts`: Schedule type definitions
- **Step Dependencies**: Step 2.3, Step 2.5
- **User Instructions**: None

**Schema Design:**
```sql
review_queue: id, atom_id, next_review_at, interval_days, ease_factor, 
              repetitions, last_reviewed_at

training_blocks: id, date, block_order, mode (build/prove), goal, 
                 win_condition, estimated_minutes, atom_ids (JSON), 
                 status (pending/active/completed), started_at, completed_at

mastery_gates: id, level_number, gate_type, requirement_json, description
```

---

## Phase 3: Skill Atom Taxonomy Seeding

### Step 3.1: Quantitative Section Atoms
- **Task**: Seed complete Quantitative section taxonomy with all topics, subtopics, and atoms
- **Files**:
  - `src/db/seed/quant-taxonomy.ts`: Quant section seed data
  - `src/db/seed/data/quant-atoms.json`: JSON data for Quant atoms
- **Step Dependencies**: Step 2.2
- **User Instructions**: Run `npm run seed` to populate taxonomy

**Coverage:**
- Arithmetic (fractions, decimals, percentages, ratios, number properties)
- Algebra (linear equations, quadratics, inequalities, functions, exponents)
- Geometry (lines/angles, triangles, circles, coordinate geometry, 3D)
- Word Problems (rate/work, mixtures, profit/loss, sets, statistics)
- Data Sufficiency (unique question type patterns)

### Step 3.2: Verbal Section Atoms
- **Task**: Seed complete Verbal section taxonomy
- **Files**:
  - `src/db/seed/verbal-taxonomy.ts`: Verbal section seed data
  - `src/db/seed/data/verbal-atoms.json`: JSON data for Verbal atoms
- **Step Dependencies**: Step 2.2
- **User Instructions**: Run `npm run seed` to populate taxonomy

**Coverage:**
- Sentence Correction (subject-verb, modifiers, parallelism, idioms, tense)
- Critical Reasoning (strengthen, weaken, assumption, inference, evaluate)
- Reading Comprehension (main idea, detail, inference, tone, structure)

### Step 3.3: IR and AWA Section Atoms
- **Task**: Seed Integrated Reasoning and AWA taxonomies
- **Files**:
  - `src/db/seed/ir-taxonomy.ts`: IR section seed data
  - `src/db/seed/awa-taxonomy.ts`: AWA section seed data
  - `src/db/seed/data/ir-atoms.json`: JSON data for IR atoms
  - `src/db/seed/data/awa-atoms.json`: JSON data for AWA atoms
- **Step Dependencies**: Step 2.2
- **User Instructions**: Run `npm run seed` to populate taxonomy

**Coverage (IR):**
- Graphics Interpretation
- Two-Part Analysis
- Table Analysis
- Multi-Source Reasoning

**Coverage (AWA):**
- Argument Analysis structure
- Common logical flaws
- Essay organization

### Step 3.4: Level System & Mastery Gates Seeding
- **Task**: Seed level definitions and mastery gate requirements
- **Files**:
  - `src/db/seed/levels.ts`: Level definitions and gates seed data
  - `src/db/seed/data/levels.json`: JSON data for level configurations
  - `src/db/seed/data/mastery-gates.json`: JSON data for gate requirements
- **Step Dependencies**: Step 2.6
- **User Instructions**: Run `npm run seed` to populate levels

**Gate Examples:**
- Level 2 → 3: 80% accuracy on all foundation atoms (untimed)
- Level 4 → 5: 90% accuracy on easy questions, < 5% careless errors
- Level 7 → 8: Complete 3 full sections with score variance < 10%

---

## Phase 4: Core API Routes

### Step 4.1: User Progress API
- **Task**: Create REST endpoints for user progress, level status, and settings
- **Files**:
  - `src/routes/user.ts`: User-related endpoints
  - `src/controllers/UserController.ts`: Request handlers for user routes
- **Step Dependencies**: Step 2.1
- **User Instructions**: None

**Endpoints:**
- `GET /api/user/profile` - Get current user profile and level
- `PUT /api/user/settings` - Update user settings
- `GET /api/user/progress` - Get detailed progress by section/level
- `GET /api/user/stats` - Get aggregate statistics

### Step 4.2: Taxonomy API
- **Task**: Create endpoints for browsing and querying skill atom taxonomy
- **Files**:
  - `src/routes/taxonomy.ts`: Taxonomy endpoints
  - `src/controllers/TaxonomyController.ts`: Request handlers
- **Step Dependencies**: Step 3.1, Step 3.2, Step 3.3
- **User Instructions**: None

**Endpoints:**
- `GET /api/taxonomy/sections` - List all sections
- `GET /api/taxonomy/section/:id/topics` - Get topics for section
- `GET /api/taxonomy/atoms` - Query atoms with filters
- `GET /api/taxonomy/atom/:id` - Get atom details with prerequisites

### Step 4.3: Question API
- **Task**: Create endpoints for fetching questions and submitting attempts
- **Files**:
  - `src/routes/questions.ts`: Question endpoints
  - `src/controllers/QuestionController.ts`: Request handlers
  - `src/services/QuestionService.ts`: Question selection logic
- **Step Dependencies**: Step 2.3, Step 4.2
- **User Instructions**: None

**Endpoints:**
- `GET /api/questions/next` - Get next question based on scheduler
- `GET /api/questions/:id` - Get specific question (no answer until attempt)
- `POST /api/questions/:id/attempt` - Submit answer and timing data
- `GET /api/questions/:id/explanation` - Get explanation (only after attempt + reflection)

### Step 4.4: Error Log API
- **Task**: Create endpoints for error classification and reflection submission
- **Files**:
  - `src/routes/errors.ts`: Error log endpoints
  - `src/controllers/ErrorController.ts`: Request handlers
- **Step Dependencies**: Step 2.4, Step 4.3
- **User Instructions**: None

**Endpoints:**
- `POST /api/attempts/:id/classify` - Submit error classification
- `POST /api/attempts/:id/reflect` - Submit reflection
- `GET /api/attempts/:id/suggestions` - Get auto-suggested error types
- `GET /api/errors/history` - Get error log history with filters

### Step 4.5: Scheduler API
- **Task**: Create endpoints for daily guidance and training block management
- **Files**:
  - `src/routes/scheduler.ts`: Scheduler endpoints
  - `src/controllers/SchedulerController.ts`: Request handlers
  - `src/services/SchedulerService.ts`: Daily plan generation logic
- **Step Dependencies**: Step 2.6, Step 4.1
- **User Instructions**: None

**Endpoints:**
- `GET /api/scheduler/today` - Get today's recommended training blocks
- `POST /api/scheduler/block/:id/start` - Start a training block
- `POST /api/scheduler/block/:id/complete` - Complete a training block
- `GET /api/scheduler/blocking-gates` - Get current mastery gates blocking progress

### Step 4.6: Dashboard API
- **Task**: Create endpoints for analytics and dashboard data
- **Files**:
  - `src/routes/dashboard.ts`: Dashboard endpoints
  - `src/controllers/DashboardController.ts`: Request handlers
  - `src/services/AnalyticsService.ts`: Analytics calculation service
- **Step Dependencies**: Step 2.5, Step 4.4
- **User Instructions**: None

**Endpoints:**
- `GET /api/dashboard/readiness` - Get overall readiness score
- `GET /api/dashboard/weakness-heatmap` - Get weakness data by atom
- `GET /api/dashboard/timing-report` - Get timing statistics and drift
- `GET /api/dashboard/error-trends` - Get error type trends over time

---

## Phase 5: AI Question Generation

### Step 5.1: OpenAI Client Setup
- **Task**: Create OpenAI API client wrapper with error handling and rate limiting
- **Files**:
  - `src/services/ai/OpenAIClient.ts`: OpenAI API wrapper
  - `src/services/ai/types.ts`: AI service type definitions
  - `src/services/ai/prompts/base.ts`: Base prompt templates
- **Step Dependencies**: Step 1.1
- **User Instructions**: Ensure `OPENAI_API_KEY` is set in `.env`

### Step 5.2: Question Generator Prompts
- **Task**: Create specialized prompts for each question type with GMAT-specific constraints
- **Files**:
  - `src/services/ai/prompts/quant.ts`: Quantitative question prompts
  - `src/services/ai/prompts/verbal.ts`: Verbal question prompts
  - `src/services/ai/prompts/ir.ts`: IR question prompts
  - `src/services/ai/prompts/awa.ts`: AWA prompt generation
  - `src/services/ai/QuestionGenerator.ts`: Generator orchestration
- **Step Dependencies**: Step 5.1
- **User Instructions**: None

**Prompt Includes:**
- Section/question type/target difficulty
- Target atom(s) and prerequisites
- Fastest valid method constraints
- Timing budget target
- GMAT style requirements
- Trap archetype instructions (for medium/hard)

### Step 5.3: Question Validator Pipeline
- **Task**: Create validation system to verify AI-generated questions meet GMAT standards
- **Files**:
  - `src/services/ai/validators/AnswerValidator.ts`: Verify unambiguous correct answer
  - `src/services/ai/validators/DistractorValidator.ts`: Check distractor quality
  - `src/services/ai/validators/DifficultyValidator.ts`: Verify difficulty alignment
  - `src/services/ai/validators/TimingValidator.ts`: Check solvability in budget
  - `src/services/ai/QuestionValidator.ts`: Validator pipeline orchestrator
- **Step Dependencies**: Step 5.2
- **User Instructions**: None

**Validation Criteria:**
- One unambiguous correct answer
- Distractors plausible + trap-aligned
- Difficulty matches target
- Solvable within budget using intended method
- Explanation coherent
- Trap notes present for medium/hard

### Step 5.4: Generation API & Caching
- **Task**: Create endpoints for triggering generation and managing question pool
- **Files**:
  - `src/routes/generate.ts`: Generation endpoints
  - `src/controllers/GenerateController.ts`: Request handlers
  - `src/services/QuestionPoolService.ts`: Pool management and caching
  - `src/db/migrations/008_question_pool.ts`: Pool tracking table
- **Step Dependencies**: Step 5.3, Step 4.3
- **User Instructions**: None

**Endpoints:**
- `POST /api/generate/question` - Generate new question for atoms
- `GET /api/generate/pool-status` - Get question pool statistics
- `POST /api/generate/batch` - Pre-generate questions for upcoming sessions

---

## Phase 6: ELO & Adaptive Difficulty Engine

### Step 6.1: ELO Calculation Engine
- **Task**: Implement ELO rating calculation with GMAT-specific adjustments
- **Files**:
  - `src/services/elo/EloCalculator.ts`: Core ELO math
  - `src/services/elo/constants.ts`: ELO configuration constants
  - `src/services/elo/types.ts`: ELO type definitions
- **Step Dependencies**: Step 2.5
- **User Instructions**: None

**Features:**
- K-factor adjustment based on games played
- Separate ratings per scope (section, question type, atom cluster)
- Provisional rating handling for new areas
- Anti-grind: diminishing returns on repeated easy items

### Step 6.2: Adaptive Question Selection
- **Task**: Implement question selection algorithm based on ELO and learning objectives
- **Files**:
  - `src/services/elo/QuestionSelector.ts`: Selection algorithm
  - `src/services/elo/DifficultyMatcher.ts`: Match questions to user level
- **Step Dependencies**: Step 6.1, Step 5.4
- **User Instructions**: None

**Selection Logic:**
- 60% near current rating (±50 points)
- 20% slight stretch (+50-100 points)
- 15% weakness targeting (blocked gates, error clusters)
- 5% random exploration

### Step 6.3: Mastery Gate Evaluation
- **Task**: Implement gate checking logic for level progression
- **Files**:
  - `src/services/progression/GateEvaluator.ts`: Gate requirement checker
  - `src/services/progression/LevelManager.ts`: Level state management
  - `src/services/progression/types.ts`: Progression type definitions
- **Step Dependencies**: Step 3.4, Step 6.1
- **User Instructions**: None

**Gate Types:**
- Accuracy threshold (% correct on atom set)
- Consistency threshold (variance limits)
- Volume requirement (minimum attempts)
- Timing threshold (% within budget)
- Error-free streak requirement

---

## Phase 7: Frontend - Core UI Components

### Step 7.1: UI Framework & Layout
- **Task**: Set up base UI layout, navigation, and keyboard handling
- **Files**:
  - `public/index.html`: Updated with app structure
  - `public/css/main.css`: Enhanced base styles
  - `public/css/variables.css`: CSS custom properties (colors, spacing)
  - `public/css/components.css`: Reusable component styles
  - `public/js/app.js`: App initialization and routing
  - `public/js/utils/keyboard.js`: Keyboard shortcut handler
  - `public/js/utils/api.js`: API client wrapper
- **Step Dependencies**: Step 1.2
- **User Instructions**: None

**Design Principles:**
- Minimal, focused interface
- Dark mode default (less eye strain for long sessions)
- Large touch targets + keyboard shortcuts
- Timer always visible

### Step 7.2: Dashboard View
- **Task**: Create main dashboard showing readiness score, daily plan, and quick stats
- **Files**:
  - `public/js/views/Dashboard.js`: Dashboard view component
  - `public/css/views/dashboard.css`: Dashboard-specific styles
  - `public/js/components/ReadinessGauge.js`: Readiness score display
  - `public/js/components/DailyPlan.js`: Today's training blocks
  - `public/js/components/QuickStats.js`: Key metrics summary
- **Step Dependencies**: Step 7.1, Step 4.6
- **User Instructions**: None

### Step 7.3: Training Block View
- **Task**: Create training block interface with question queue and progress
- **Files**:
  - `public/js/views/TrainingBlock.js`: Training block view
  - `public/css/views/training.css`: Training view styles
  - `public/js/components/BlockHeader.js`: Block goal and progress
  - `public/js/components/QuestionQueue.js`: Question queue indicator
- **Step Dependencies**: Step 7.1, Step 4.5
- **User Instructions**: None

### Step 7.4: Question Attempt View
- **Task**: Create the core question display with timer, choices, and answer submission
- **Files**:
  - `public/js/views/Question.js`: Question view component
  - `public/css/views/question.css`: Question view styles
  - `public/js/components/Timer.js`: Countdown timer with pace indicator
  - `public/js/components/QuestionStem.js`: Question text display
  - `public/js/components/ChoiceList.js`: Answer choices (keyboard navigable)
  - `public/js/components/SubmitBar.js`: Submit and hint controls
- **Step Dependencies**: Step 7.3, Step 4.3
- **User Instructions**: None

**Keyboard Shortcuts:**
- A/B/C/D/E: Select answer choice
- Enter: Submit answer
- H: Request hint (Build mode only)
- Space: Pause timer (Build mode only)

### Step 7.5: Outcome & Error Classification View
- **Task**: Create post-answer flow for outcome logging and error classification
- **Files**:
  - `public/js/views/Outcome.js`: Outcome classification view
  - `public/css/views/outcome.css`: Outcome view styles
  - `public/js/components/OutcomeSelector.js`: Correct/Incorrect/Slow buttons
  - `public/js/components/ErrorClassifier.js`: Error type selection
  - `public/js/components/SuggestedErrors.js`: Auto-suggested error display
- **Step Dependencies**: Step 7.4, Step 4.4
- **User Instructions**: None

### Step 7.6: Reflection & Explanation View
- **Task**: Create reflection prompts and explanation reveal interface
- **Files**:
  - `public/js/views/Reflection.js`: Reflection view component
  - `public/css/views/reflection.css`: Reflection view styles
  - `public/js/components/ReflectionPrompts.js`: Structured reflection inputs
  - `public/js/components/Explanation.js`: Explanation display
  - `public/js/components/TrapNotes.js`: Trap archetype callouts
  - `public/js/components/MicroRule.js`: "Next time" rule input
- **Step Dependencies**: Step 7.5, Step 4.4
- **User Instructions**: None

**Reflection Flow:**
1. User classifies error type (if not clean win)
2. User answers 1-3 reflection prompts
3. App reveals explanation + fastest method + trap notes
4. User optionally saves micro-rule

---

## Phase 8: Frontend - Advanced Views

### Step 8.1: Analytics Dashboard
- **Task**: Create detailed analytics views with heatmaps and charts
- **Files**:
  - `public/js/views/Analytics.js`: Analytics view component
  - `public/css/views/analytics.css`: Analytics view styles
  - `public/js/components/WeaknessHeatmap.js`: Atom weakness visualization
  - `public/js/components/TimingChart.js`: Timing trend chart
  - `public/js/components/ErrorTrends.js`: Error type trend display
  - `public/js/utils/charts.js`: Simple chart rendering utilities
- **Step Dependencies**: Step 7.1, Step 4.6
- **User Instructions**: None

### Step 8.2: Level Progress View
- **Task**: Create level overview with mastery gates and unlock requirements
- **Files**:
  - `public/js/views/Levels.js`: Level progress view
  - `public/css/views/levels.css`: Level view styles
  - `public/js/components/LevelCard.js`: Individual level display
  - `public/js/components/GateList.js`: Gate requirements list
  - `public/js/components/ProgressBar.js`: Gate progress indicator
- **Step Dependencies**: Step 7.1, Step 4.5
- **User Instructions**: None

### Step 8.3: Error Log Browser
- **Task**: Create browsable history of errors with filters and search
- **Files**:
  - `public/js/views/ErrorLog.js`: Error log browser view
  - `public/css/views/errorlog.css`: Error log view styles
  - `public/js/components/ErrorFilters.js`: Filter by type/atom/date
  - `public/js/components/ErrorCard.js`: Individual error display
  - `public/js/components/MicroRuleList.js`: Saved micro-rules list
- **Step Dependencies**: Step 7.1, Step 4.4
- **User Instructions**: None

### Step 8.4: Session Summary View
- **Task**: Create end-of-session summary with results and next steps
- **Files**:
  - `public/js/views/SessionSummary.js`: Session summary view
  - `public/css/views/summary.css`: Summary view styles
  - `public/js/components/SessionStats.js`: Session statistics
  - `public/js/components/XPGain.js`: XP earned display
  - `public/js/components/NextSteps.js`: Recommended next actions
- **Step Dependencies**: Step 7.6, Step 4.6
- **User Instructions**: None

### Step 8.5: Settings View
- **Task**: Create settings page for user preferences and app configuration
- **Files**:
  - `public/js/views/Settings.js`: Settings view component
  - `public/css/views/settings.css`: Settings view styles
  - `public/js/components/SettingsForm.js`: Settings form inputs
  - `public/js/components/DataManagement.js`: Export/reset data options
- **Step Dependencies**: Step 7.1, Step 4.1
- **User Instructions**: None

---

## Phase 9: Scheduler & Daily Guidance

### Step 9.1: Scheduler Core Algorithm
- **Task**: Implement the daily plan generation algorithm
- **Files**:
  - `src/services/scheduler/DailyPlanner.ts`: Main planning algorithm
  - `src/services/scheduler/BlockGenerator.ts`: Training block creation
  - `src/services/scheduler/PriorityScorer.ts`: Atom priority scoring
  - `src/services/scheduler/types.ts`: Scheduler type definitions
- **Step Dependencies**: Step 6.3, Step 4.5
- **User Instructions**: None

**Priority Factors:**
1. Blocking gates (highest priority)
2. Weakness clusters (errors + low ELO)
3. Spaced repetition due items
4. Section balance
5. Time since last practice

### Step 9.2: Spaced Repetition Engine
- **Task**: Implement SM-2 based spaced repetition for review scheduling
- **Files**:
  - `src/services/scheduler/SpacedRepetition.ts`: SM-2 algorithm
  - `src/services/scheduler/ReviewQueue.ts`: Review queue management
- **Step Dependencies**: Step 9.1
- **User Instructions**: None

### Step 9.3: Anti-Grind Mechanics
- **Task**: Implement systems to prevent XP farming and ensure genuine learning
- **Files**:
  - `src/services/scheduler/AntiGrind.ts`: Anti-grind rule engine
  - `src/services/scheduler/Cooldowns.ts`: Cooldown management
- **Step Dependencies**: Step 9.1
- **User Instructions**: None

**Anti-Grind Rules:**
- Diminishing XP for repeated same-atom questions
- Cooldown period after completing gate attempts
- Minimum variety requirement per session
- Streak bonuses only for diverse success

---

## Phase 10: Local RAG System

### Step 10.1: Document Ingestion
- **Task**: Create system to ingest study documents from local folder
- **Files**:
  - `src/services/rag/DocumentLoader.ts`: File system loader
  - `src/services/rag/TextExtractor.ts`: Extract text from PDF/DOC/TXT
  - `src/services/rag/ChunkSplitter.ts`: Split documents into chunks
  - `src/db/migrations/009_rag_documents.ts`: Document storage table
  - `study-docs/.gitkeep`: Create study docs folder
- **Step Dependencies**: Step 1.3
- **User Instructions**: 
  - Place study documents in `study-docs/` folder
  - Supported formats: .txt, .md, .pdf, .docx

### Step 10.2: Vector Embedding & Search
- **Task**: Create embedding generation and similarity search for RAG
- **Files**:
  - `src/services/rag/EmbeddingService.ts`: Generate embeddings via OpenAI
  - `src/services/rag/VectorStore.ts`: Simple vector storage and search
  - `src/services/rag/Retriever.ts`: Retrieve relevant chunks for context
- **Step Dependencies**: Step 10.1, Step 5.1
- **User Instructions**: None

### Step 10.3: RAG-Augmented Generation
- **Task**: Integrate RAG context into question generation and explanations
- **Files**:
  - `src/services/ai/RAGIntegration.ts`: RAG context injection
  - `src/services/ai/prompts/rag-templates.ts`: RAG-aware prompt templates
- **Step Dependencies**: Step 10.2, Step 5.2
- **User Instructions**: None

**RAG Usage:**
- Augment explanations with user's study notes
- Enhance concept refreshers
- Inform remediation drill generation

---

## Phase 11: Timing System

### Step 11.1: Timer Service
- **Task**: Create backend timing service with level-aware budgets
- **Files**:
  - `src/services/timing/TimerService.ts`: Timer state management
  - `src/services/timing/BudgetCalculator.ts`: Level-based budget calculation
  - `src/services/timing/constants.ts`: Timing constants by level
- **Step Dependencies**: Step 2.1
- **User Instructions**: None

**Timing by Level:**
- L1-2: No strict timing, learning focus
- L3-4: 1.5x standard budget
- L5-6: Standard budget, warnings at 80%
- L7-8: Standard budget, strict enforcement
- L9-10: Test-realistic pacing

### Step 11.2: Timing Analytics
- **Task**: Create timing analysis and drift detection
- **Files**:
  - `src/services/timing/TimingAnalytics.ts`: Timing statistics
  - `src/services/timing/DriftDetector.ts`: Late-section drift detection
  - `src/services/timing/AbandonmentTracker.ts`: Abandonment latency tracking
- **Step Dependencies**: Step 11.1, Step 2.3
- **User Instructions**: None

**Metrics:**
- Median time per question type
- Time variance
- Late-section drift (time increase in later questions)
- Abandonment latency (time before strategic guess)

---

## Phase 12: Testing & Quality Assurance

### Step 12.1: Backend Unit Tests
- **Task**: Create unit tests for core services and algorithms
- **Files**:
  - `tests/unit/services/EloCalculator.test.ts`: ELO calculation tests
  - `tests/unit/services/SchedulerService.test.ts`: Scheduler tests
  - `tests/unit/services/GateEvaluator.test.ts`: Gate evaluation tests
  - `tests/unit/services/SpacedRepetition.test.ts`: SR algorithm tests
  - `jest.config.js`: Jest configuration
- **Step Dependencies**: Step 6.1, Step 9.1
- **User Instructions**: Run `npm test` to execute tests

### Step 12.2: API Integration Tests
- **Task**: Create integration tests for API endpoints
- **Files**:
  - `tests/integration/api/user.test.ts`: User API tests
  - `tests/integration/api/questions.test.ts`: Question API tests
  - `tests/integration/api/scheduler.test.ts`: Scheduler API tests
  - `tests/integration/api/errors.test.ts`: Error log API tests
  - `tests/setup.ts`: Test setup and fixtures
- **Step Dependencies**: Step 4.1 through Step 4.6
- **User Instructions**: Run `npm run test:integration`

### Step 12.3: AI Validation Tests
- **Task**: Create tests for question validation pipeline
- **Files**:
  - `tests/unit/ai/QuestionValidator.test.ts`: Validator tests
  - `tests/unit/ai/prompts.test.ts`: Prompt template tests
  - `tests/fixtures/questions/`: Sample questions for testing
- **Step Dependencies**: Step 5.3
- **User Instructions**: Run `npm test`

### Step 12.4: End-to-End Flow Tests
- **Task**: Create E2E tests for critical user flows
- **Files**:
  - `tests/e2e/questionFlow.test.ts`: Complete question attempt flow
  - `tests/e2e/levelProgression.test.ts`: Level unlock flow
  - `tests/e2e/dailyPlan.test.ts`: Daily guidance flow
  - `playwright.config.ts`: Playwright configuration
- **Step Dependencies**: Step 7.6, Step 8.4
- **User Instructions**: Run `npm run test:e2e`

---

## Phase 13: Polish & Production Readiness

### Step 13.1: Error Handling & Edge Cases
- **Task**: Add comprehensive error handling throughout the application
- **Files**:
  - `src/middleware/errorHandler.ts`: Enhanced error handling
  - `src/utils/errors.ts`: Custom error classes
  - `src/utils/validation.ts`: Input validation utilities
  - `public/js/utils/errorDisplay.js`: Frontend error display
- **Step Dependencies**: All previous steps
- **User Instructions**: None

### Step 13.2: Performance Optimization
- **Task**: Optimize database queries and frontend performance
- **Files**:
  - `src/db/migrations/010_indexes.ts`: Database indexes
  - `src/db/queries/optimized.ts`: Optimized query helpers
  - `public/js/utils/cache.js`: Frontend caching utilities
- **Step Dependencies**: All previous steps
- **User Instructions**: None

### Step 13.3: Documentation
- **Task**: Create comprehensive documentation for setup and usage
- **Files**:
  - `README.md`: Updated with full setup and usage guide
  - `docs/ARCHITECTURE.md`: System architecture overview
  - `docs/API.md`: API endpoint documentation
  - `docs/LEVELS.md`: Level system and gates documentation
  - `docs/CONTRIBUTING.md`: Development guidelines
- **Step Dependencies**: All previous steps
- **User Instructions**: Review documentation before first use

### Step 13.4: Production Scripts
- **Task**: Create production build and deployment scripts
- **Files**:
  - `scripts/build.ts`: Production build script
  - `scripts/migrate.ts`: Database migration script
  - `scripts/seed.ts`: Data seeding script
  - `scripts/backup.ts`: Database backup script
  - `package.json`: Updated scripts section
- **Step Dependencies**: All previous steps
- **User Instructions**: Run `npm run build` for production

---

## Phase 14: Future-Proofing (Design Only)

### Step 14.1: Vetted Bank Import Schema Design
- **Task**: Design schema and interfaces for future PDF/DOC question import
- **Files**:
  - `docs/VETTED_BANK_DESIGN.md`: Design document for vetted bank feature
  - `src/types/vettedBank.ts`: Type definitions (interface only)
  - `src/db/migrations/011_vetted_bank_placeholder.ts`: Placeholder migration
- **Step Dependencies**: Step 2.3
- **User Instructions**: None (design only, not implemented)

### Step 14.2: Multi-User Design
- **Task**: Document multi-user architecture for future expansion
- **Files**:
  - `docs/MULTI_USER_DESIGN.md`: Multi-user design document
- **Step Dependencies**: None
- **User Instructions**: None (design only)

---

# Summary

## Build Order Overview

| Phase | Focus | Steps | Est. Complexity |
|-------|-------|-------|-----------------|
| 1 | Project Foundation | 1.1 - 1.3 | Low |
| 2 | Data Models | 2.1 - 2.6 | Medium |
| 3 | Taxonomy Seeding | 3.1 - 3.4 | Medium |
| 4 | Core API | 4.1 - 4.6 | Medium |
| 5 | AI Generation | 5.1 - 5.4 | High |
| 6 | ELO Engine | 6.1 - 6.3 | High |
| 7 | Core UI | 7.1 - 7.6 | Medium |
| 8 | Advanced UI | 8.1 - 8.5 | Medium |
| 9 | Scheduler | 9.1 - 9.3 | High |
| 10 | RAG System | 10.1 - 10.3 | Medium |
| 11 | Timing System | 11.1 - 11.2 | Medium |
| 12 | Testing | 12.1 - 12.4 | Medium |
| 13 | Polish | 13.1 - 13.4 | Low |
| 14 | Future Design | 14.1 - 14.2 | Low |

## Key Technical Decisions

1. **SQLite over PostgreSQL**: Simpler local deployment, no server setup
2. **Vanilla JS over React**: Minimal dependencies, faster load, keyboard-first
3. **TypeScript backend**: Type safety for complex ELO and scheduling logic
4. **OpenAI for both generation and RAG embeddings**: Single API dependency
5. **SM-2 for spaced repetition**: Well-proven, simple to implement

## Critical Path

The following steps are on the critical path and block significant subsequent work:

1. **Step 2.2 (Skill Atoms)** → Blocks all content organization
2. **Step 3.1-3.4 (Taxonomy Seeding)** → Blocks question generation
3. **Step 5.3 (Validator Pipeline)** → Blocks reliable AI question use
4. **Step 6.1 (ELO Engine)** → Blocks adaptive difficulty
5. **Step 7.4-7.6 (Question Flow UI)** → Blocks core user experience

## Risk Areas

1. **AI Question Quality**: Validation pipeline must be robust; expect iteration
2. **ELO Calibration**: May need tuning after real usage data
3. **Mastery Gate Balance**: Gates must be challenging but achievable
4. **RAG Retrieval Quality**: Depends on quality of user-provided documents

## Estimated Timeline

- **MVP (Phases 1-7)**: 3-4 weeks
- **Full Feature Set (Phases 8-11)**: 2-3 additional weeks
- **Testing & Polish (Phases 12-13)**: 1-2 weeks
- **Total**: 6-9 weeks for complete implementation

---

*This plan is designed to be executed sequentially, with each step building on previous work. Steps within the same phase can often be parallelized if multiple developers are available.*
