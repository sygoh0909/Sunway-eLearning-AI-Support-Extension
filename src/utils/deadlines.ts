import type { Deadline } from './types'

export async function extractDeadlines(text: string): Promise<Deadline[]> {
  // TODO: Feature 2 implementation
  return []
}

export function scoreUrgency(dueDate: string): 'overdue' | 'soon' | 'upcoming' {
  const now = new Date()
  const due = new Date(dueDate)
  const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (diffHours < 0) return 'overdue'
  if (diffHours <= 72) return 'soon'
  return 'upcoming'
}
