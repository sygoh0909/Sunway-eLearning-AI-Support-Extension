import type { Deadline, AnnouncementCategory } from './types'

const DATE_PATTERNS = [
  // "due/deadline/submit/submission/register [date]: ..." patterns
  /(?:due|deadline|submit|submission|register)\s*(?:date)?[:\s]*(\d{1,2}[\s/-]\w+[\s/-]\d{2,4})/gi,
  /(?:due|deadline|submit|submission|register)\s*(?:date)?[:\s]*(\w+\s+\d{1,2},?\s*\d{2,4})/gi,
  /(?:due|deadline|submit|submission|register)\s*(?:date)?[:\s]*(\d{4}-\d{2}-\d{2})/gi,
  /(?:due|deadline|submit|submission|register)\s*(?:date)?[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})/gi,
  // "by/before/b4/bf [date]" patterns
  /(?:by|before|b4|bf)\s+(\d{1,2}[\s/-]\w+[\s/-]\d{2,4})/gi,
  /(?:by|before|b4|bf)\s+(\w+\s+\d{1,2},?\s*\d{2,4})/gi,
  /(?:by|before|b4|bf)\s+(\d{4}-\d{2}-\d{2})/gi,
  /(?:by|before|b4|bf)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/gi,
  // "on/from [date]" patterns
  /(?:on|from)\s+(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{2,4})/gi,
  /(?:on|from)\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{2,4})/gi,
  /(?:on|from)\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{2,4})/gi,
  /(?:on|from)\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s*\d{2,4})/gi,
  // Ordinal date formats: "11th June 2025", "June 11th 2025", "11th June"
  /(\d{1,2}(?:st|nd|rd|th)\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*(?:\s+\d{2,4})?)/gi,
  /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{2,4})?)/gi,
  // Standalone date formats (Month Day Year or Day Month Year)
  /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{2,4})/gi,
  /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s*\d{2,4}/gi,
  // "latest by" / "no later than" patterns
  /(?:latest\s+by|no\s+later\s+than)\s+(\d{1,2}[\s/-]\w+[\s/-]\d{2,4})/gi,
  /(?:latest\s+by|no\s+later\s+than)\s+(\w+\s+\d{1,2},?\s*\d{2,4})/gi,
  // DD/MM/YYYY or MM/DD/YYYY standalone (less reliable, try last)
  /(\d{1,2}\/\d{1,2}\/\d{2,4})/gi,
]

const TASK_PATTERNS = [
  /(?:submit|complete|upload|hand\s*in|turn\s*in|finish|register)\s+(?:your\s+)?(?:for\s+)?(.+?)(?:\s+(?:by|before|b4|bf|due|on))/gi,
  /(.+?)\s+(?:is\s+)?(?:due|deadline)/gi,
  /(?:assignment|quiz|test|exam|project|report|presentation|lab|event|seminar|competition)[\s:]+(.+?)(?:\s+(?:by|before|b4|due))/gi,
]

const ACTION_KEYWORDS = /\b(submit|deadline|due|register|attend|join|complete|sign\s*up|enrol|participate|hand\s*in|upload|exam|test|quiz|presentation|competition|event|seminar|meeting|group|grouping|form\s+group)\b/i

function toLocalIsoDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDate(dateStr: string): string | null {
  // Strip ordinal suffixes: "11th" → "11", "3rd" → "3"
  const cleaned = dateStr.trim().replace(/(\d+)(?:st|nd|rd|th)/gi, '$1')
  const parsed = new Date(cleaned)
  if (!isNaN(parsed.getTime())) {
    return toLocalIsoDate(parsed)
  }

  const withYear = cleaned.match(/\d{4}/) ? cleaned : `${cleaned} ${new Date().getFullYear()}`
  const retry = new Date(withYear)
  if (!isNaN(retry.getTime())) {
    // If the resulting date is more than 2 months in the past, try next year
    const now = new Date()
    if (retry.getTime() < now.getTime() - 60 * 24 * 60 * 60 * 1000) {
      const nextYear = new Date(`${cleaned} ${new Date().getFullYear() + 1}`)
      if (!isNaN(nextYear.getTime())) {
        return toLocalIsoDate(nextYear)
      }
    }
    return toLocalIsoDate(retry)
  }

  return null
}

function extractTaskDescription(text: string, dateMatch: RegExpExecArray): string {
  const matchIndex = dateMatch.index ?? 0
  const contextStart = Math.max(0, matchIndex - 150)
  const context = text.slice(contextStart, matchIndex).trim()

  for (const pattern of TASK_PATTERNS) {
    pattern.lastIndex = 0
    const taskMatch = pattern.exec(context)
    if (taskMatch?.[1]) {
      const task = taskMatch[1].trim()
      if (task.length > 5 && task.length < 100) return task
    }
  }

  const sentences = context.split(/[.!?\n]/).filter(s => s.trim().length > 5)
  if (sentences.length > 0) {
    const last = sentences[sentences.length - 1].trim()
    if (last.length < 100) return last
  }

  return 'Assignment/Submission'
}

export async function extractDeadlines(text: string, courseId = '', courseName = ''): Promise<Deadline[]> {
  const deadlines: Deadline[] = []
  const seenDates = new Set<string>()

  for (const pattern of DATE_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = pattern.exec(text)) !== null) {
      const rawDate = match[1] ?? match[0]
      const isoDate = parseDate(rawDate)
      if (!isoDate || seenDates.has(isoDate)) continue
      seenDates.add(isoDate)

      const task = extractTaskDescription(text, match)
      const urgency = scoreUrgency(isoDate)

      deadlines.push({
        id: `dl-${courseId}-${isoDate}-${deadlines.length}`,
        courseId,
        courseName,
        task,
        dueDate: isoDate,
        urgency,
      })
    }
  }

  // If no dates found but text mentions actionable keywords, mark as upcoming
  if (deadlines.length === 0 && ACTION_KEYWORDS.test(text)) {
    const sentences = text.split(/[.!?\n]/).filter(s => s.trim().length > 5)
    const actionSentence = sentences.find(s => ACTION_KEYWORDS.test(s))
    if (actionSentence) {
      const task = actionSentence.trim().slice(0, 80)
      deadlines.push({
        id: `dl-${courseId}-nodate-0`,
        courseId,
        courseName,
        task,
        dueDate: '',
        urgency: 'upcoming',
      })
    }
  }

  return deadlines
}

export function scoreUrgency(dueDate: string): 'overdue' | 'soon' | 'upcoming' {
  if (!dueDate) return 'upcoming'

  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(23, 59, 59, 999)

  const diffMs = due.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays < 0) return 'overdue'
  if (diffDays <= 3) return 'soon'
  return 'upcoming'
}

const DEADLINE_KEYWORDS = /\b(submit|submission|hand\s*in|turn\s*in|upload|assignment|coursework|group\s*(?:ing|work|project|formation)|form\s+group|team\s+formation|discussion\s+(?:board|post|forum)|requires?\s+submission|project|deadline|due\s*date)\b/i
const EVENT_KEYWORDS = /\b(intern(?:ship)?|industrial\s+training|register|registration|event|workshop|seminar|competition|tournament|webinar|conference|talk|ceremony|trip|excursion|sign\s*up|enrol|career|recruit|hiring|job\s+fair|networking|co-?curricular|club|society|volunteer|committee|gathering|rsvp|election|council|festival|orientation|open\s+day|booth|charity|donate|donation|sponsor|ticket|cultural|sport|match|marathon|hackathon|bootcamp|campaign|concert|performance|exhibition|showcase|pickleball|badminton|football|basketball|run|walk)\b/i

// Keywords that confirm it's actual coursework with a due submission
const COURSEWORK_KEYWORDS = /\b(assignment\s*\d*\s*due|grouping\s*due|group\s*(?:ing|work|project|formation)|form\s+group|team\s+formation|discussion\s+(?:board|post|forum)|lab\s+report|project\s+report|submission|hand\s*in|turn\s*in|upload|assignment|coursework|due\s*date|deadline)\b/i

// Non-subject sources — these are not real course modules
const NON_SUBJECT_SOURCE = /\b(faculty|school\s+of|department\s+of|career|student\s+council|susc|student\s+affairs|alumni|fet\s+career|student\s+life|library|administration|registrar|finance|scholarship|bursary|housing|hostel|residential|counselling|wellness|health)\b/i

const ADMINISTRATIVE_KEYWORDS = /\b(policy|regulation|fee|payment|schedule\s+change|timetable\s+change|system\s+maintenance|portal|office\s+hours|academic\s+calendar|grading|transcript|enrollment|withdrawal|administrative|notice|update|memo|circular|registrar|finance|IT\s+support|password\s+reset)\b/i

// TF-IDF-inspired keyword scoring for categorisation
interface CategoryKeywordSet {
  pattern: RegExp
  keywords: string[]
}

const CATEGORY_KEYWORD_SETS: Record<string, CategoryKeywordSet> = {
  Deadline: {
    pattern: DEADLINE_KEYWORDS,
    keywords: [
      'submit', 'submission', 'hand in', 'turn in', 'upload', 'assignment', 'coursework',
      'group work', 'group project', 'group formation', 'grouping', 'form group',
      'team formation', 'discussion board', 'discussion post', 'discussion forum',
      'requires submission', 'project', 'deadline', 'due date'
    ],
  },
  Event: {
    pattern: EVENT_KEYWORDS,
    keywords: [
      'internship', 'industrial training', 'register', 'registration', 'event', 'workshop',
      'seminar', 'competition', 'tournament', 'webinar', 'conference', 'talk', 'ceremony',
      'trip', 'excursion', 'sign up', 'enrol', 'career', 'recruit', 'hiring', 'job fair',
      'networking', 'co-curricular', 'club', 'society', 'volunteer', 'committee', 'gathering',
      'rsvp', 'election', 'council', 'festival', 'orientation', 'open day', 'booth', 'charity',
      'donate', 'donation', 'sponsor', 'ticket', 'cultural', 'sport', 'match', 'marathon',
      'hackathon', 'bootcamp', 'campaign', 'concert', 'performance', 'exhibition', 'showcase'
    ],
  },
  Administrative: {
    pattern: ADMINISTRATIVE_KEYWORDS,
    keywords: [
      'policy', 'regulation', 'fee', 'payment', 'schedule change', 'timetable change',
      'system maintenance', 'portal', 'office hours', 'academic calendar', 'grading',
      'transcript', 'enrollment', 'withdrawal', 'administrative', 'notice', 'update',
      'memo', 'circular', 'registrar', 'finance', 'IT support', 'password reset'
    ],
  },
  Academic: {
    pattern: /\b(lecture|tutorial|class|module|syllabus|textbook|reading|chapter|topic|notes|slides|material|revision|study|exam\s+tips|learning\s+outcome|course\s+outline|assessment|marks|grade|result|attendance|schedule|timetable|lab|practical)\b/i,
    keywords: [
      'lecture', 'tutorial', 'class', 'module', 'syllabus', 'textbook', 'reading',
      'chapter', 'topic', 'notes', 'slides', 'material', 'revision', 'study',
      'exam tips', 'learning outcome', 'course outline', 'assessment', 'marks',
      'grade', 'result', 'attendance', 'schedule', 'timetable', 'lab', 'practical'
    ],
  },
}

// Compute IDF-like weight: rarer keywords get higher weight
// We use log(total_categories / categories_containing_keyword) as a proxy
function computeKeywordIdf(keyword: string): number {
  const totalCategories = 4
  let containingCategories = 0
  for (const cat of Object.values(CATEGORY_KEYWORD_SETS)) {
    if (cat.keywords.some(k => k === keyword || keyword.includes(k) || k.includes(keyword))) {
      containingCategories++
    }
  }
  if (containingCategories === 0) return 1
  return Math.log(totalCategories / containingCategories) + 1
}

function computeCategoryScore(text: string, titleText: string, category: string): number {
  const catSet = CATEGORY_KEYWORD_SETS[category]
  if (!catSet) return 0

  let score = 0
  const textLower = text.toLowerCase()
  const titleLower = titleText.toLowerCase()

  for (const keyword of catSet.keywords) {
    const keywordLower = keyword.toLowerCase()
    const idf = computeKeywordIdf(keywordLower)

    // Count occurrences in body (TF component)
    const bodyRegex = new RegExp(`\\b${keywordLower.replace(/\s+/g, '\\s+')}\\b`, 'gi')
    const bodyMatches = textLower.match(bodyRegex)
    const bodyTf = bodyMatches ? bodyMatches.length : 0

    // Count occurrences in title (weighted 3x higher)
    const titleMatches = titleLower.match(bodyRegex)
    const titleTf = titleMatches ? titleMatches.length : 0

    // TF-IDF score: title matches weighted 3x, body matches weighted 1x
    score += (titleTf * 3 + bodyTf) * idf
  }

  return score
}

export function categorizeAnnouncement(title: string, body: string, courseName = ''): AnnouncementCategory {
  const text = `${title} ${body}`
  const titleText = title
  const courseNameLower = courseName.toLowerCase()

  // Non-subject sources strongly bias toward Administrative
  const fromNonSubject = NON_SUBJECT_SOURCE.test(courseNameLower)

  // Compute TF-IDF-like scores for each category
  const scores: Record<string, number> = {
    Deadline: computeCategoryScore(text, titleText, 'Deadline'),
    Event: computeCategoryScore(text, titleText, 'Event'),
    Administrative: computeCategoryScore(text, titleText, 'Administrative'),
    Academic: computeCategoryScore(text, titleText, 'Academic'),
  }

  // Non-subject source boost for Administrative
  if (fromNonSubject) {
    scores['Administrative'] += 5
  }

  // Coursework keywords strongly confirm Deadline
  if (COURSEWORK_KEYWORDS.test(text)) {
    scores['Deadline'] += 3
  }

  // Find highest scoring category
  let bestCategory: AnnouncementCategory = 'Academic'
  let bestScore = -1

  for (const [category, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score
      bestCategory = category as AnnouncementCategory
    }
  }

  // If all scores are 0, default to Academic
  if (bestScore === 0) return 'Academic'

  return bestCategory
}

export function computePriorityScore(announcement: {
  title: string
  body: string
  date: string
  dateType?: string
  courseName: string
  deadlines?: { dueDate: string; urgency: string }[]
}): number {
  let score = 0
  const text = `${announcement.title} ${announcement.body}`.toLowerCase()

  // Temporal proximity scoring
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  let closestDays = Infinity
  let isOverdue = false

  // Check deadlines array for due dates
  if (announcement.deadlines && announcement.deadlines.length > 0) {
    for (const dl of announcement.deadlines) {
      if (dl.dueDate) {
        const due = new Date(dl.dueDate)
        due.setHours(0, 0, 0, 0)
        const diffMs = due.getTime() - now.getTime()
        const diffDays = diffMs / (1000 * 60 * 60 * 24)
        if (diffDays < closestDays) closestDays = diffDays
        if (dl.urgency === 'overdue') isOverdue = true
      }
    }
  }

  // Also check announcement date if it's a due date
  if (announcement.dateType === 'due' && announcement.date) {
    const due = new Date(announcement.date)
    due.setHours(0, 0, 0, 0)
    const diffMs = due.getTime() - now.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    if (diffDays < closestDays) closestDays = diffDays
    if (diffDays < 0) isOverdue = true
  }

  // Temporal proximity points
  if (closestDays !== Infinity) {
    if (closestDays <= 1) score += 4
    else if (closestDays <= 3) score += 3
    else if (closestDays <= 7) score += 2
    else if (closestDays <= 14) score += 1
  }

  // Already overdue bonus
  if (isOverdue) score += 1

  // Category weight
  const category = categorizeAnnouncement(announcement.title, announcement.body, announcement.courseName)
  if (category === 'Deadline') score += 3
  else if (category === 'Event' && announcement.date) score += 2
  else if (category === 'Academic') score += 1
  // Administrative = +0

  // Action-required keywords
  if (/\b(submit|register|sign\s*up|attend)\b/i.test(text)) score += 1

  // Urgency keywords
  if (/\b(urgent|mandatory|compulsory|asap|immediately|last\s+chance|final\s+reminder)\b/i.test(text)) score += 2

  // Cap at 10
  return Math.min(score, 10)
}
