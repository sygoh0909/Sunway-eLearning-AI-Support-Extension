import { useState, useRef, useEffect } from 'react'
import { URGENCY_CONFIG } from '../utils/types'
import type { SummarisedAnnouncement, Urgency } from '../utils/types'

interface Props {
  announcement: SummarisedAnnouncement
  onUrgencyChange?: (id: string, urgency: Urgency) => void
}

export default function AnnouncementCard({ announcement, onUrgencyChange }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showUrgencyPicker, setShowUrgencyPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowUrgencyPicker(false)
      }
    }
    if (showUrgencyPicker) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showUrgencyPicker])

  const cleanText = (text: string) => {
    if (!text) return ''
    return text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()
  }

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === 'Unknown') return 'No date'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'No date'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getUrgency = (): Urgency | null => {
    if (announcement.deadlines.length === 0) return null
    const urgencies = announcement.deadlines.map(d => d.urgency)
    if (urgencies.includes('soon')) return 'soon'
    if (urgencies.includes('upcoming')) return 'upcoming'
    if (urgencies.includes('overdue')) return 'overdue'
    return null
  }

  const urgency = getUrgency()

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-2.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <h3 className="text-xs font-semibold text-gray-900 line-clamp-2">{announcement.title}</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
              <div className="flex items-center gap-1">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>{announcement.courseName}</span>
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{announcement.dateType === 'due' ? 'Due: ' : ''}{formatDate(announcement.date)}</span>
              </div>
            </div>
          </div>
          {urgency && (
            <div className="relative flex-shrink-0" ref={pickerRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowUrgencyPicker(!showUrgencyPicker) }}
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border cursor-pointer hover:opacity-80 transition-opacity ${URGENCY_CONFIG[urgency].color}`}
              >
                {URGENCY_CONFIG[urgency].label}
              </button>
              {showUrgencyPicker && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50 min-w-[100px]">
                  {(Object.keys(URGENCY_CONFIG) as Urgency[]).map(opt => (
                    <button
                      key={opt}
                      onClick={(e) => {
                        e.stopPropagation()
                        onUrgencyChange?.(announcement.id, opt)
                        setShowUrgencyPicker(false)
                      }}
                      className={`w-full px-2.5 py-1 text-left text-[11px] flex items-center gap-1.5 hover:bg-gray-50 ${opt === urgency ? 'font-semibold' : ''}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${URGENCY_CONFIG[opt].dotColor}`} />
                      {URGENCY_CONFIG[opt].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded p-2 mb-1.5 border border-blue-100">
          <div className="flex items-start gap-1.5">
            <svg className="w-3 h-3 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-medium text-blue-900 mb-0.5">Summary</p>
              <p className="text-[11px] text-gray-700 leading-relaxed">{cleanText(announcement.summary)}</p>
            </div>
          </div>

          {/* Key Info rows */}
          {announcement.keyInfo && Object.keys(announcement.keyInfo).length > 0 && (
            <div className="mt-1.5 pt-1.5 border-t border-blue-100 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
              {announcement.keyInfo.date && (
                <>
                  <span className="text-[10px] font-semibold text-blue-700 whitespace-nowrap">Date</span>
                  <span className="text-[10px] text-gray-700">{announcement.keyInfo.date}</span>
                </>
              )}
              {announcement.keyInfo.time && (
                <>
                  <span className="text-[10px] font-semibold text-blue-700 whitespace-nowrap">Time</span>
                  <span className="text-[10px] text-gray-700">{announcement.keyInfo.time}</span>
                </>
              )}
              {announcement.keyInfo.location && (
                <>
                  <span className="text-[10px] font-semibold text-blue-700 whitespace-nowrap">Location</span>
                  <span className="text-[10px] text-gray-700">{announcement.keyInfo.location}</span>
                </>
              )}
              {announcement.keyInfo.registrationFee && (
                <>
                  <span className="text-[10px] font-semibold text-blue-700 whitespace-nowrap">Reg. Fee</span>
                  <span className="text-[10px] text-gray-700">{announcement.keyInfo.registrationFee}</span>
                </>
              )}
              {announcement.keyInfo.registrationDeadline && (
                <>
                  <span className="text-[10px] font-semibold text-blue-700 whitespace-nowrap">Reg. By</span>
                  <span className="text-[10px] text-gray-700">{announcement.keyInfo.registrationDeadline}</span>
                </>
              )}
              {announcement.keyInfo.speakers && announcement.keyInfo.speakers.length > 0 && (
                <>
                  <span className="text-[10px] font-semibold text-blue-700 whitespace-nowrap">Speaker(s)</span>
                  <span className="text-[10px] text-gray-700">{announcement.keyInfo.speakers.join(', ')}</span>
                </>
              )}
              {announcement.keyInfo.dress && (
                <>
                  <span className="text-[10px] font-semibold text-blue-700 whitespace-nowrap">Dress</span>
                  <span className="text-[10px] text-gray-700">{announcement.keyInfo.dress}</span>
                </>
              )}
              {announcement.keyInfo.contact && (
                <>
                  <span className="text-[10px] font-semibold text-blue-700 whitespace-nowrap">Contact</span>
                  <span className="text-[10px] text-gray-700">{announcement.keyInfo.contact}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Original Content (Expandable) */}
        <div className="mb-1.5">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-[11px] font-medium text-gray-600 hover:text-gray-900"
          >
            <svg className={`w-2.5 h-2.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span>{isExpanded ? 'Hide' : 'Show'} original</span>
          </button>

          {isExpanded && (
            <div className="bg-gray-50 rounded p-2 mt-1.5 border border-gray-200">
              <p className="text-[11px] text-gray-700 whitespace-pre-line leading-relaxed">{cleanText(announcement.body)}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1.5 border-t border-gray-100 gap-2">
          <div className="text-[11px] text-gray-600 truncate flex-1 min-w-0">
            <svg className="w-2.5 h-2.5 inline mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>{announcement.courseName}</span>
          </div>
          <a
            href={announcement.linkUrl || `https://elearn.sunway.edu.my/ultra/courses/${announcement.courseId}/announcements/announcement-detail?courseId=${announcement.courseId}&announcementId=${announcement.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-blue-600 text-white text-[11px] font-medium rounded hover:bg-blue-700 transition-colors flex-shrink-0"
          >
            <span>View</span>
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}
