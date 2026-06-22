import { useState } from 'react'
import type { SummarisedAnnouncement } from '../utils/types'
import UrgencyBadge from './UrgencyBadge'

interface Props {
  announcement: SummarisedAnnouncement
}

export default function AnnouncementCard({ announcement }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{announcement.title}</h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 mt-1">
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                {announcement.courseName}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(announcement.date)}
              </span>
            </div>
          </div>
          {announcement.deadlines.length > 0 && (
            <UrgencyBadge urgency={announcement.deadlines[0].urgency} />
          )}
        </div>

        {/* AI Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-md p-2.5 mb-2 border border-blue-100">
          <div className="flex items-start gap-1.5">
            <svg className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-blue-900 mb-0.5">AI Summary</p>
              <p className="text-xs text-gray-700 leading-relaxed">{announcement.summary}</p>
            </div>
          </div>
        </div>

        {/* Original Content (Expandable) */}
        <div className="mb-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-700 hover:text-gray-900"
          >
            <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span>{isExpanded ? 'Hide' : 'Show'} original</span>
          </button>

          {isExpanded && (
            <div className="bg-gray-50 rounded-md p-2.5 mt-2 border border-gray-200">
              <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{announcement.body}</p>
            </div>
          )}
        </div>

        {/* Deadlines */}
        {announcement.deadlines.length > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-900 mb-1">Deadlines:</p>
            {announcement.deadlines.map(d => (
              <div key={d.id} className="flex items-center justify-between text-xs py-0.5">
                <span className="text-gray-700">{d.task}</span>
                <span className="text-gray-500">{formatDate(d.dueDate)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
