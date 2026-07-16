import { useEffect, useState } from 'react'
import { storageGet } from '../utils/storage'
import { scoreUrgency } from '../utils/deadlines'
import type { Deadline } from '../utils/types'
import UrgencyBadge from '../components/UrgencyBadge'
import LoadingSpinner from '../components/LoadingSpinner'

export default function DeadlineTab() {
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDeadlines()
  }, [])

  async function loadDeadlines() {
    try {
      const summarised = await storageGet('summarised')
      const assignmentDeadlines: Deadline[] = (await storageGet('assignmentDeadlines')) ?? []
      const announcementDeadlines = (summarised ?? []).flatMap(a => a.deadlines)

      // Merge and deduplicate (assignment deadlines take priority)
      const seen = new Set<string>()
      const allDeadlines: Deadline[] = []

      for (const d of assignmentDeadlines) {
        const key = `${d.courseId}-${d.dueDate}-${d.task}`
        if (!seen.has(key)) {
          seen.add(key)
          d.urgency = d.dueDate ? scoreUrgency(d.dueDate) : 'upcoming'
          allDeadlines.push(d)
        }
      }
      for (const d of announcementDeadlines) {
        const key = `${d.courseId}-${d.dueDate}-${d.task}`
        if (!seen.has(key)) {
          seen.add(key)
          d.urgency = d.dueDate ? scoreUrgency(d.dueDate) : 'upcoming'
          allDeadlines.push(d)
        }
      }

      // Sort: items with no date go last, otherwise by date
      allDeadlines.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      })
      setDeadlines(allDeadlines)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'No date specified'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const getDaysLeft = (dueDate: string) => {
    if (!dueDate) return 'Check announcement'
    const now = new Date()
    const due = new Date(dueDate)
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return `${Math.abs(diff)}d overdue`
    if (diff === 0) return 'Due today'
    return `${diff}d left`
  }

  if (loading) return <LoadingSpinner />

  if (deadlines.length === 0) {
    return (
      <div className="text-center py-8">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <h3 className="text-sm font-medium text-gray-900 mb-1">No deadlines tracked</h3>
        <p className="text-xs text-gray-500">Deadlines will appear after announcements are fetched</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {deadlines.map(deadline => (
        <div
          key={deadline.id}
          className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{deadline.task}</p>
              <p className="text-xs text-gray-500 mt-0.5">{deadline.courseName}</p>
            </div>
            <UrgencyBadge urgency={deadline.urgency} />
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">{formatDate(deadline.dueDate)}</span>
            <span className={`text-xs font-medium ${
              deadline.urgency === 'soon' ? 'text-red-600' :
              deadline.urgency === 'upcoming' ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {getDaysLeft(deadline.dueDate)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}