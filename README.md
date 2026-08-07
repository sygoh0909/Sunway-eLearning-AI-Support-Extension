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

### 2. AI-Powered Text Summarisation & Key Info Extraction

> `src/utils/ai.ts`

Provides two complementary NLP systems for understanding announcement content:

#### Extractive Summary (First Meaningful Sentence)

Extracts the first substantive sentence from announcement bodies as the summary:

- **HTML stripping**: Removes all tags, decodes HTML entities (`&nbsp;`, `&amp;`, etc.)
- **Emoji boundary splitting**: Splits text at emoji characters to separate structured data (📅 date 🕜 time 📍 venue) from prose
- **Noise filtering**: Removes greetings ("Dear students..."), sign-offs ("Thank you..."), filler phrases ("Please be informed that..."), and short fragments
- **Smart truncation**: Caps at 200 characters with word-boundary-aware trimming
- Results are cached in Chrome storage — only new announcements are processed

#### Structured Key Info Extraction (Regex NLP Pipeline)

Extracts structured metadata fields from announcement text using a cascading multi-strategy pattern matching system:

| Field | Extraction Strategy |
|-------|-------------------|
| **Date** | Labels (`Date:`, `held on:`), emoji prefixes (`📅`, `📌`), bare date patterns — supports ordinal suffixes (`25th`), day-of-week prefixes (`Friday, 24 July`), and formats: DD Month YYYY, Month DD YYYY, DD/MM/YYYY |
| **Time** | Labels (`Time:`, `starts at:`), all 24 clock-face emojis (`🕐`–`🕧`), bare time ranges (`9:00 AM – 12:00 PM`) |
| **Location/Platform** | Labels (`Venue:`, `Location:`, `Platform:`, `Mode:`), emoji prefixes (`📍`, `💻`) — handles both physical venues and virtual platforms (Microsoft Teams, Zoom) |
| **Registration Fee** | Labels (`Registration fee:`, `Entry fee:`, `Admission:`), `💰` emoji with fee-related sublabel — explicitly excludes prize/win contexts to avoid false positives |
| **Registration Deadline** | Labels (`Register by:`, `Registration Deadline:`, `Submission Deadline:`, `Nomination Deadline:`), `📝`/`📌` emojis, "extended until" phrasing — extracts just the date with optional time suffix and parenthetical day |
| **Speakers** | Labels (`Speaker:`, `Keynote:`, `Presenter:`), supports Malaysian/academic honorifics (Dr., Ir., Prof., Ts., Engr., Assoc.) |
| **Dress Code** | Labels (`Dress code:`, `Attire:`) — word-boundary matching to avoid false positives from "Address" |
| **Contact** | Smart extraction prioritising actionable info: emails (`user@domain.com`), phone numbers (`+60...`), or name+email combos (`Dr. Name (email)`) — avoids capturing noisy sentence fragments |

Key design decisions:
- **Emoji-aware line splitting**: Text is split into logical lines at emoji boundaries (`\p{Extended_Pictographic}`), so emoji-delimited structured data (common in Sunway announcements) doesn't bleed across fields
- **Cascading fallback strategy**: Each field tries label-based matching first (most specific), then emoji-prefixed matching, then bare pattern matching (least specific)
- **Unicode-aware capture groups**: All captures stop at emoji boundaries (`[^\p{Extended_Pictographic}...]`) to prevent over-extraction in emoji-dense text
- **Lookahead-based field boundaries**: Location captures use lazy matching with lookaheads for field-starting keywords (`registration`, `deadline`, `fee`, etc.) to prevent bleed-through in non-emoji text
- **Word-boundary keyword matching**: Venue keywords (`room`, `hall`, `venue`) require `\b` word boundaries to prevent false matches inside compound words like "classroom" or "Townhall"
- **False-positive prevention**: Registration fee skips prize/win contexts and requires fee-related labels; dress code requires word boundaries; date captures are tightly scoped to date patterns only; contact extracts structured data (email/phone) rather than raw text
- **Date range support**: Handles ranges like "25 May – 5 June 2026" or "13–17 July 2026" using en-dash/hyphen separators

#### TextRank Algorithm (Internal Component)

The codebase also includes a **TextRank** graph-based ranking implementation for advanced sentence scoring:

- **Tokenisation & stop-word removal**: Cleans text and removes 80+ common English stop words
- **TF-based cosine similarity**: Builds a sentence similarity matrix using term frequency vectors
- **Graph ranking**: 30 iterations with damping factor 0.85
- **Domain-specific sentence boosting**: Weighted scoring for dates (+1.5), deadlines (+2.0), academic terms (+1.5), events (+1.2), venues (+0.8), actions (+1.0), urgency (+1.2)
- **Position bias**: First 3 sentences get a positional boost
- **Length penalty**: Short sentences without key signals are down-weighted

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
- **Preferred notification hour**: Choose what hour of the day to receive notifications (e.g., 8:00 AM) — only sends within the selected hour window
- **Priority-based delivery**: Sorts all eligible deadlines by days remaining — most urgent first
- **Spam prevention**: Maximum 5 notifications per check cycle; won't re-notify the same deadline within 12 hours
- **Clear messaging**: Shows days remaining (e.g., "3 days left: Assignment 2") with urgent indicators for <=1 day items
- **Click-through navigation**: Clicking a notification opens the relevant eLearn page — reuses an existing eLearn tab if open, or creates a new one
- **Automatic urgency refresh**: Checks every 60 minutes via Chrome Alarms API and updates urgency scores for both announcement deadlines and assignment deadlines
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
- **AI summary cards**: Each announcement shows a blue AI-generated summary box with structured key info fields (date, time, venue, fee, deadline, speakers, dress code, contact)
- **Clickable urgency tags**: Click any urgency badge (Soon / Upcoming / Past) to manually override the auto-computed urgency level — dropdown picker with all options, persisted across sessions via Chrome storage
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
- Preferred notification hour (select any hour from 12:00 AM to 11:00 PM)

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
│   ├── AnnouncementCard.tsx  # Card with clickable urgency badge, AI summary, key info, expandable body
│   ├── FilterPanel.tsx       # Collapsible multi-filter UI with tri-state toggles
│   ├── UrgencyBadge.tsx      # Urgency status badge component
│   ├── LoadingSpinner.tsx    # Loading state indicator
│   └── ErrorMessage.tsx      # Error display component
└── utils/
    ├── ai.ts                 # TextRank summarisation engine with caching
    ├── deadlines.ts          # TF-IDF classifier, priority scoring, date extraction
    ├── scraper.ts            # Blackboard REST API scraper with concurrency control
    ├── storage.ts            # Typed Chrome storage helpers with schema (includes urgency overrides)
    └── types.ts              # TypeScript interfaces and shared constants
```

---

## AI/NLP Components Summary

| Component | Technique | Location | Purpose |
|-----------|-----------|----------|---------|
| Text Summarisation | First meaningful sentence extraction with noise filtering | `src/utils/ai.ts` | Generate concise one-sentence summaries |
| Key Info Extraction | Cascading regex NLP with emoji-aware splitting | `src/utils/ai.ts` | Extract structured fields (date, time, venue, fee, deadline, speakers, dress, contact) |
| Categorisation | TF-IDF weighted keyword scoring | `src/utils/deadlines.ts` | Classify into Deadline/Event/Academic/Administrative |
| Priority Scoring | Multi-signal heuristic system | `src/utils/deadlines.ts` | Score urgency 1-10 for ranking and notifications |
| Deadline Extraction | NLP pattern matching + date parsing | `src/utils/deadlines.ts` | Detect due dates and associated tasks from text |
| TextRank Engine | Graph-based sentence ranking (PageRank-inspired) | `src/utils/ai.ts` | Domain-specific sentence importance scoring |

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
