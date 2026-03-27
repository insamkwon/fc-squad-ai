# FC Squad AI

AI-powered FC Online squad recommendation and player database with natural language chat interface, FUTBIN-style formation visualization, and budget-aware squad building.

## Features

- **Player Database** — 41K+ players with bilingual search (Korean/English)
- **AI Chat Interface** — Natural language squad requests via Gemini AI
- **Formation Visualization** — SVG football pitch with player cards, stats, and chemistry lines
- **Budget-Aware Building** — Generate squads within budget constraints (억/억 units)
- **Player Comparison** — Compare up to 3 players side-by-side
- **Mobile Responsive** — Touch-optimized UI for mobile browsers

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite (better-sqlite3) for local dev, JSON export for serverless
- **AI**: Google Gemini 2.0 Flash (with rule-based fallback)
- **Deployment**: Vercel (serverless)

## Getting Started

### Prerequisites

- Node.js >= 20.11.0
- npm >= 10.0.0

### Installation

```bash
npm install
npm run seed    # Seed database from data/details.csv
npm run dev     # Start development server
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build   # Seeds DB, exports JSON, builds Next.js
npm start       # Start production server
```

## Deploy to Vercel

### Option 1: Vercel Dashboard (Recommended)

1. Push code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repository
4. Configure environment variables (optional):
   - `GOOGLE_GENERATIVE_AI_KEY` — Gemini API key (falls back to rule-based parser)
   - `NEXON_API_KEY` — Nexon FC Online Open API key
   - `NEXON_APP_ID` — Default: `258842`
5. Click **Deploy**

The build command automatically:
1. Seeds the player database from `data/details.csv`
2. Exports player data to `data/players.json` for serverless runtime
3. Builds the Next.js application

### Option 2: Vercel CLI

```bash
vercel login
vercel --prod
```

### Build Architecture

- **Build time**: SQLite database seeded from CSV → JSON export
- **Runtime**: JSON file read via `fs.readFileSync` (no native modules needed)
- **Fallback**: If JSON not available, tries SQLite, then mock data

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_GENERATIVE_AI_KEY` | No | Gemini API key for AI parsing |
| `NEXON_API_KEY` | No | Nexon FC Online Open API key |
| `NEXON_APP_ID` | No | Nexon app ID (default: 258842) |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/                # API routes (chat, players, squad, crawl)
│   ├── chat/               # AI chat page
│   ├── compare/            # Player comparison page
│   ├── players/            # Player database page
│   └── squad-builder/      # Squad builder page
├── components/             # React components
│   ├── chat/               # Chat UI components
│   ├── filters/            # Search filter components
│   ├── formation/          # SVG pitch and formation components
│   ├── player/             # Player card components
│   ├── squad/              # Squad building components
│   └── ui/                 # Shared UI components
├── lib/                    # Business logic
│   ├── ai/                 # Gemini client and squad parser
│   ├── price-crawl/        # Price crawling engine
│   └── squad-generator/    # Squad generation algorithms
├── db/                     # Database schema and seed logic
├── hooks/                  # React hooks
├── types/                  # TypeScript type definitions
└── constants/              # Constants and defaults
```

## Data Source

Player data sourced from [fconline-player-search details.csv](https://github.com/fconline-player-search/details.csv) (MIT license).

## License

MIT
