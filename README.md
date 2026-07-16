# Sunway E-Learn Assistant

A Chrome extension that aggregates announcements, assignments, and deadlines from Sunway University's eLearn (Blackboard) platform, enhanced with AI-powered natural language processing for smart summarisation, categorisation, and priority scoring.

All AI features run **locally and instantly** — no external API calls, no model downloads, no internet dependency for processing.

---

## Features

### 1. Automated Announcement & Deadline Scraping

Scrapes data directly from eLearn's Blackboard REST API using the user's authenticated session:

- Fetches all enrolled courses via `/users/me/memberships`
- Retrieves announcements per course (announcements API + content items fallback)
- Extracts assignment deadlines from gradebook columns (paginated)
- Walks course content folders recursively to discover assignments, quizzes, and discussions
- Detects eLearn links embedded in announcement bodies and resolves their due dates
- Deduplicates deadlines across multiple sources (gradebook, content items, linked assessments)
- Runs with concurrency control (3 parallel requests) to avoid rate limiting
- Creates announcement cards for assignments that don't have matching announcements

### 2. AI-Powered Text Summarisation (TextRank Algorithm)

> `src/utils/ai.ts`

Implements the **TextRank algorithm** — a graph-based unsupervised NLP technique inspired by Google's PageRank — to extract the most important sentences from announcement bodies:

- **Tokenisation & stop-word removal**: Cleans text and removes 80+ common English stop words
- **TF-based cosine similarity**: Builds a sentence similarity matrix using term frequency vectors
- **Graph ranking**: Runs 30 iterations of the TextRank algorithm with damping factor 0.85 to converge on sentence importance scores
- **Domain-specific sentence boosting**: Applies weighted scoring for:
  - Date/time patterns (+1.5 for dates, +0.8 for times/days)
  - Deadline keywords like "submit by", "due date" (+2.0)
  - Academic keywords like "assignment", "quiz", "exam" (+1.5)
  - Event keywords like "workshop", "seminar" (+1.2)
  - Location signals like "venue", "room", "hall" (+0.8)
  - Action-required phrases like "register", "submit" (+1.0)
  - Urgency signals like "mandatory", "ASAP" (+1.2)
- **Position bias**: First 3 sentences get a positional boost (lead bias)
- **Length penalty**: Short sentences without key signals are down-weighted
- **Noise filtering**: Removes greetings ("Dear students..."), sign-offs ("Thank you..."), and filler phrases ("Please be informed that...") before processing
- Results are cached in Chrome storage — only new announcements are processed

### 3. AI-Powered Smart Categorisation (TF-IDF Keyword Classifier)

> `src/utils/deadlines.ts` — `categorizeAnnouncement()`

Classifies each announcement into one of 4 categories using a **TF-IDF-inspired weighted keyword scoring system**:

| Category | Examples |
|----------|----------|
| **Deadline** | Assignments, submissions, coursework, group projects, discussion posts |
| **Event** | Workshops, seminars, competitions, career fairs, co-curricular activities |
| **Academic** | Lectures, tutorials, class materials, exam info, grades, timetables |
| **Administrative** | Policy changes, fee notices, system maintenance, portal updates, circulars |

How the classifier works:

- **TF (Term Frequency)**: Counts keyword occurrences in the announcement text
- **IDF (Inverse Document Frequency)**: Keywords unique to one category receive higher weight using `log(total_categories / categories_containing_keyword) + 1`
- **Title weighting**: Keywords found in the title are weighted **3x** higher than body matches
- **Source-based boosting**: Announcements from non-subject sources (faculty offices, student affairs, career centre) receive a +5 Administrative boost
- **Coursework confirmation**: Specific coursework patterns (e.g., "assignment due", "submission deadline", "form group") add +3 to Deadline score
- Returns the highest-scoring category, defaulting to Academic if all scores are 0

### 4. AI-Powered Urgency/Priority Scoring (Heuristic AI System)

> `src/utils/deadlines.ts` — `computePriorityScore()`

Assigns each announcement a priority score from **1 to 10** using a multi-signal heuristic scoring system that combines temporal, categorical, and linguistic signals:

| Signal | Points |
|--------|--------|
| Due in <= 1 day | +4 |
| Due in <= 3 days | +3 |
| Due in <= 7 days | +2 |
| Due in <= 14 days | +1 |
| Category: Deadline | +3 |
| Category: Event (with date) | +2 |
| Category: Academic | +1 |
| Action keywords (submit, register, sign up, attend) | +1 |
| Urgency keywords (mandatory, ASAP, last chance, final reminder, compulsory) | +2 |
| Already overdue | +1 |

Score is capped at 10. Higher scores indicate items requiring immediate attention.

### 5. Intelligent Deadline Extraction (NLP Pattern Matching)

> `src/utils/deadlines.ts` — `extractDeadlines()`

Parses announcement text to detect and extract deadlines using advanced pattern matching:

- **15+ regex patterns** covering date formats: DD/MM/YYYY, "January 1, 2025", "1st March", ordinal dates ("11th June"), ISO 8601, day names, week numbers
- **Context-aware task extraction**: Looks backward from the date match to identify what is due (e.g., "Submit your assignment by 15 June" -> task: "your assignment")
- **Smart year inference**: Adds current year to dates without one; bumps to next year if date is >2 months in the past
- **Action keyword fallback**: Marks announcements as actionable even without explicit dates if they contain keywords like "submit", "register", "attend"
- **Urgency scoring**: Assigns `overdue` (<0 days), `soon` (<=3 days), or `upcoming` (>3 days)

### 6. Smart Notification System

> `src/background/deadlineTracker.ts` and `src/background/notification.ts`

- **User-configurable timing**: Choose to receive notifications 1 day, 3 days, 1 week, or 2 weeks before deadlines (multiple selections allowed)
- **Priority-based delivery**: Sorts all eligible deadlines by days remaining — most urgent first
- **Spam prevention**: Maximum 5 notifications per check cycle; won't re-notify the same deadline within 12 hours
- **Clear messaging**: Shows days remaining (e.g., "3 days left: Assignment 2") with urgent indicators for <=1 day items
- **Automatic urgency refresh**: Checks every 60 minutes via Chrome Alarms API and updates urgency scores
- **Old entry cleanup**: Automatically removes notification records older than 30 days

### 7. Popup Dashboard

> `src/popup/App.tsx` and related components

- **Full-text search**: Across title, body, course name, and AI-generated summary
- **Multi-axis filtering** with tri-state toggle (include / exclude / neutral):
  - By course
  - By category (Deadline / Academic / Event / Administrative)
  - By urgency (Soon / Upcoming / Past)
  - By date range (from/to)
- **Smart sorting**: Announcements sorted by urgency priority (soon -> upcoming -> overdue -> no deadline), then by date
- **AI summary cards**: Each announcement shows a blue AI-generated summary box
- **Expandable original content**: Click to reveal the full announcement body
- **Direct eLearn links**: "View" button links to the original announcement/assessment page
- **Auto-refresh**: Automatically scrapes if data is stale (>5 minutes)
- **Window mode**: Pop out to a separate window for larger viewing

### 8. Sidebar Overlay

> `src/content/sidebar.ts`

- Injects a slide-out sidebar directly on the eLearn page
- Toggle button fixed to the right edge of the screen with smooth animation
- Full extension functionality accessible without leaving eLearn
- Preserves the original page layout and interactions

### 9. Settings & Customisation

> `src/popup/SettingsTab.tsx`

- Auto-refresh interval (configurable, minimum 5 minutes)
- Notification master toggle with granular control:
  - Deadline reminders on/off
  - New announcements on/off
  - Urgent items only mode
- Reminder timing selection (1 day / 3 days / 1 week / 2 weeks) — multiple allowed

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS 3 |
| Build | Vite 5 + @crxjs/vite-plugin |
| Extension | Chrome Manifest V3 (Service Worker) |
| AI/NLP | Custom TextRank, TF-IDF classifier, heuristic scoring — all local |
| Storage | Chrome Storage API (local) |
| Styling | Tailwind CSS + PostCSS + Autoprefixer |

---

## Project Structure

```
src/
├── background/
│   ├── index.ts              # Service worker: message routing, scrape orchestration
│   ├── deadlineTracker.ts    # Smart notification scheduler with priority sorting
│   └── notification.ts       # Chrome notification builder with days-remaining display
├── content/
│   ├── index.ts              # Content script: login detection, scrape/summarise handlers
│   ├── sidebar.ts            # Sidebar iframe injection with animated toggle
│   └── courseDetector.ts     # Course page detection utilities
├── popup/
│   ├── index.html            # Popup HTML shell
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Main dashboard: search, filters, sorting, cards
│   ├── DeadlineTab.tsx       # Dedicated deadline view with merged sources
│   ├── SettingsTab.tsx       # Notification & refresh preferences
│   └── SummaryTab.tsx        # Summary overview tab
├── components/
│   ├── AnnouncementCard.tsx  # Card with urgency badge, AI summary, expandable body
│   ├── FilterPanel.tsx       # Collapsible multi-filter UI with tri-state toggles
│   ├── UrgencyBadge.tsx      # Urgency status badge component
│   ├── LoadingSpinner.tsx    # Loading state indicator
│   └── ErrorMessage.tsx      # Error display component
└── utils/
    ├── ai.ts                 # TextRank summarisation engine with caching
    ├── deadlines.ts          # TF-IDF classifier, priority scoring, date extraction
    ├── scraper.ts            # Blackboard REST API scraper with concurrency control
    ├── storage.ts            # Typed Chrome storage helpers with schema
    └── types.ts              # TypeScript interfaces and shared constants
```

---

## AI/NLP Components Summary

| Component | Technique | Location | Purpose |
|-----------|-----------|----------|---------|
| Text Summarisation | TextRank (graph-based ranking) | `src/utils/ai.ts` | Extract key sentences from announcements |
| Categorisation | TF-IDF weighted keyword scoring | `src/utils/deadlines.ts` | Classify into Deadline/Event/Academic/Administrative |
| Priority Scoring | Multi-signal heuristic system | `src/utils/deadlines.ts` | Score urgency 1-10 for ranking and notifications |
| Deadline Extraction | NLP pattern matching + date parsing | `src/utils/deadlines.ts` | Detect due dates and associated tasks from text |
| Sentence Boosting | Domain-specific feature weighting | `src/utils/ai.ts` | Prioritise sentences with dates, actions, urgency |

---

## Installation

### Prerequisites

- Node.js 18+
- npm
- Google Chrome

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/sygoh0909/sunway-extension.git
cd sunway-extension

# 2. Install dependencies
npm install

# 3. Build the extension
npm run build

# 4. Load into Chrome
#    - Open chrome://extensions/
#    - Enable Developer mode (top-right toggle)
#    - Click "Load unpacked"
#    - Select the dist/ folder
```

5. Navigate to [eLearn](https://elearn.sunway.edu.my) and log in
6. Click the extension icon to open the popup

---

## Usage

1. Log into [elearn.sunway.edu.my](https://elearn.sunway.edu.my)
2. The extension automatically scrapes announcements on page load
3. Click the extension icon to open the popup dashboard
4. Use filters and search to find relevant announcements
5. Each card shows an AI-generated summary with urgency indicators
6. Configure notification preferences in Settings (gear icon)
7. Use the sidebar toggle on the right edge of eLearn for quick access

---

## Development

```bash
npm run dev    # Start dev server with HMR
npm run watch  # Build with file watching
npm run build  # Production build
```

After building, reload the extension at `chrome://extensions/` to pick up changes.

---

## Team

| Member | Responsibility |
|--------|---------------|
| SY | AI/NLP engine (TextRank summariser, deadline extraction, TF-IDF classifier, priority scoring), service worker orchestration |
| SM | Data scraping (Blackboard API integration, content script, sidebar, course detection, types) |
| JY | Notification system (deadline tracker, Chrome notifications, alarm scheduling) |
| Pei | Frontend UI (popup dashboard, components, filters, settings, styling) |

---

## License

Private project for Sunway University coursework.
