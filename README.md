# GMAT Ascension

A local-first GMAT training system that gamifies skill acquisition while enforcing mastery gates. It adapts difficulty (ELO-like), trains GMAT performance as a muscle, and uses reflection-first error logging.

## Target: 750-800 in 4 months

## Features

- 🎯 **Daily Guidance** - App tells you exactly what to work on
- 🧠 **Adaptive Difficulty** - ELO-based question selection
- 🔒 **Mastery Gates** - No progression with known weaknesses
- 📝 **Error Logging** - Reflection-first approach with smart categorization
- ⏱️ **Timing Discipline** - Level-appropriate time pressure
- 🤖 **AI Generation** - OpenAI-powered question creation with validation
- 📚 **RAG Support** - Use your own study materials

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-your-key-here
```

### 3. Initialize Database

```bash
npm run migrate
npm run seed
```

### 4. Start the App

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

### 5. Open Browser

Navigate to `http://localhost:3000`

## Level System

| Level | Name | Focus |
|-------|------|-------|
| 1 | Orientation | GMAT structure and mechanics |
| 2 | Foundations | Core math, grammar, argument fundamentals |
| 3 | Recognition | Classify question types and spot traps |
| 4 | Easy Mastery | Fast + accurate on easy questions |
| 5 | Medium Control | Consistent on medium with timing |
| 6 | Strategy | Fastest approach selection, strategic guessing |
| 7 | Hard Exposure | Composure on hard questions |
| 8 | Consistency | Full section performance |
| 9 | Elite Execution | 750-800 reliability |
| 10 | Test-Day Operator | Pure performance mode |

## Training Modes

### Build Mode (Learning)
- Hints allowed (XP penalty)
- Lenient timing
- Detailed explanations

### Prove Mode (Gating)
- No hints
- Strict timing
- Determines level advancement

## Error Types

When you make a mistake, you'll classify it as:

- **Concept Gap** - Missing fundamental knowledge
- **Recognition Failure** - Didn't identify problem type
- **Decision Error** - Chose wrong approach
- **Execution Error** - Made calculation/grammar mistake
- **Timing Error** - Ran out of time
- **Abandonment Failure** - Gave up too early/late

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| A-E | Select answer choice |
| Enter | Submit answer |
| H | Request hint (Build mode) |
| Space | Pause timer (Build mode) |
| Esc | Exit current view |

## Project Structure

```
gmat-ascension/
├── src/
│   ├── config/        # Configuration management
│   ├── db/            # Database connection and migrations
│   ├── middleware/    # Express middleware
│   ├── models/        # Data models and DB access
│   ├── routes/        # API routes
│   ├── services/      # Business logic
│   └── types/         # TypeScript type definitions
├── public/
│   ├── css/           # Styles
│   ├── js/            # Frontend JavaScript
│   └── index.html     # Main HTML file
├── data/              # SQLite database (gitignored)
├── study-docs/        # Your study materials for RAG
└── tests/             # Test files
```

## Optional: RAG with Study Documents

Place your GMAT study materials in the `study-docs/` folder:
- PDF files
- Word documents  
- Text/Markdown files

The AI will use these to enhance explanations and generate contextually relevant questions.

## Requirements

- Node.js 18+
- OpenAI API key (for AI features)

## License

MIT
