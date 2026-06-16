import type { Deadline } from './types'

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
  // "on/from [date]" patterns (with year)
  /(?:on|from)\s+(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{2,4})/gi,
  /(?:on|from)\s+(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{2,4})/gi,
  /(?:on|from)\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}(?:st|nd|rd|th)?,?\s*\d{2,4})/gi,
  /(?:on|from)\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s*\d{2,4})/gi,
  // "on/from [date]" patterns (without year)
  /(?:on|from)\s+(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*)/gi,
  /(?:on|from)\s+((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2}(?:st|nd|rd|th)?)/gi,
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

// parse date helper
function parseDate(dateStr: string): string | null {
  // Strip ordinal suffixes: "11th" → "11", "3rd" → "3"
  const cleaned = dateStr.trim().replace(/(\d+)(?:st|nd|rd|th)/gi, '$1')
  const parsed = new Date(cleaned)
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2020) {
    return parsed.toISOString().split('T')[0]
  }

  const currentYear = new Date().getFullYear()
  const withYear = cleaned.match(/\d{4}/) ? cleaned : `${cleaned} ${currentYear}`
  const retry = new Date(withYear)
  if (!isNaN(retry.getTime())) {
    // If the resulting date is more than 2 months in the past, try next year
    const now = new Date()
    if (retry.getTime() < now.getTime() - 60 * 24 * 60 * 60 * 1000) {
      const nextYear = new Date(`${cleaned} ${currentYear + 1}`)
      if (!isNaN(nextYear.getTime())) {
        return nextYear.toISOString().split('T')[0]
      }
    }
    return retry.toISOString().split('T')[0]
  }

  // Try "Month Day Year" / "Day Month Year" explicitly
  const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
  const parts = cleaned.split(/[\s,/-]+/).filter(Boolean)
  let month = -1, day = -1, year = currentYear
  for (const p of parts) {
    const monthIdx = monthNames.findIndex(m => p.toLowerCase().startsWith(m))
    if (monthIdx >= 0) { month = monthIdx; continue }
    const num = parseInt(p)
    if (!isNaN(num)) {
      if (num > 31) { year = num < 100 ? 2000 + num : num }
      else if (day < 0) { day = num }
    }
  }
  if (month >= 0 && day > 0) {
    const result = new Date(year, month, day)
    if (!isNaN(result.getTime())) {
      const now = new Date()
      if (result.getTime() < now.getTime() - 60 * 24 * 60 * 60 * 1000) {
        const nextYearResult = new Date(year + 1, month, day)
        return nextYearResult.toISOString().split('T')[0]
      }
      return result.toISOString().split('T')[0]
    }
  }

  return null
}

// extract task description helper
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

export async function extractDeadlines(text: string): Promise<Deadline[]> {
  // TODO: Feature 2 implementation
  return []
}

export function scoreUrgency(dueDate: string): 'overdue' | 'soon' | 'upcoming' {
  if (!dueDate) return 'upcoming'
  // empty string used for deadlines with no date found
  
  const now = new Date()
  now.setHours(0, 0, 0, 0) // compare from start of today, not current time
  const due = new Date(dueDate)
  due.setHours(23, 59, 59, 999) // give the full day — something due "today" is not yet overdue

  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

  if (diffDays < 0) return 'overdue'
  if (diffDays <= 3) return 'soon' // ≤3 days = soon
  return 'upcoming'
}
