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
