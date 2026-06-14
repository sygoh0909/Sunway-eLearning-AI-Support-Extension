import type { Deadline } from './types'

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
