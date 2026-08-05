import { useState } from 'react'
import { URGENCY_CONFIG } from '../utils/types'
import type { AnnouncementCategory, Urgency } from '../utils/types'

export type FilterState = 'include' | 'exclude'

interface Props {
  courses: string[]
  courseFilters: Record<string, FilterState>
  onCourseFilterChange: (filters: Record<string, FilterState>) => void
  categories: AnnouncementCategory[]
  categoryFilters: Record<string, FilterState>
  onCategoryFilterChange: (filters: Record<string, FilterState>) => void
  urgencyFilters: Record<string, FilterState>
  onUrgencyFilterChange: (filters: Record<string, FilterState>) => void
  dateFrom: string
  dateTo: string
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
}

const URGENCY_OPTIONS = (Object.keys(URGENCY_CONFIG) as Urgency[]).map(value => ({
  value,
  label: URGENCY_CONFIG[value].label,
  color: URGENCY_CONFIG[value].color,
}))

const CATEGORY_COLORS: Record<AnnouncementCategory, string> = {
  Deadline: 'bg-red-50 text-red-700 border-red-200',
  Academic: 'bg-blue-50 text-blue-700 border-blue-200',
  Event: 'bg-purple-50 text-purple-700 border-purple-200',
  Administrative: 'bg-gray-50 text-gray-700 border-gray-200',
}

function cycleFilter(current: FilterState | undefined): FilterState | undefined {
  if (!current) return 'include'
  if (current === 'include') return 'exclude'
  return undefined
}

export default function FilterPanel({
  courses, courseFilters, onCourseFilterChange,
  categories, categoryFilters, onCategoryFilterChange,
  urgencyFilters, onUrgencyFilterChange,
  dateFrom, dateTo, onDateFromChange, onDateToChange
}: Props) {
  const [isExpanded, setIsExpanded] = useState(false)

  const activeFilterCount = Object.keys(courseFilters).length
    + Object.keys(urgencyFilters).length
    + Object.keys(categoryFilters).length
    + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)

  function toggleUrgency(urgency: Urgency) {
    const next = cycleFilter(urgencyFilters[urgency])
    const updated = { ...urgencyFilters }
    if (next) {
      updated[urgency] = next
    } else {
      delete updated[urgency]
    }
    onUrgencyFilterChange(updated)
  }

  function toggleCategory(category: AnnouncementCategory) {
    const next = cycleFilter(categoryFilters[category])
    const updated = { ...categoryFilters }
    if (next) {
      updated[category] = next
    } else {
      delete updated[category]
    }
    onCategoryFilterChange(updated)
  }

  function toggleCourse(course: string) {
    const next = cycleFilter(courseFilters[course])
    const updated = { ...courseFilters }
    if (next) {
      updated[course] = next
    } else {
      delete updated[course]
    }
    onCourseFilterChange(updated)
  }

  function clearAll() {
    onCourseFilterChange({})
    onCategoryFilterChange({})
    onUrgencyFilterChange({})
    onDateFromChange('')
    onDateToChange('')
  }

  function setQuickDateFilter(filter: 'today' | 'week' | 'month') {
    const today = new Date()
    const formatDate = (date: Date) => date.toISOString().split('T')[0]

    if (filter === 'today') {
      onDateFromChange(formatDate(today))
      onDateToChange(formatDate(today))
    } else if (filter === 'week') {
      const day = today.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
      const daysFromMonday = day === 0 ? 6 : day - 1
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - daysFromMonday)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      onDateFromChange(formatDate(weekStart))
      onDateToChange(formatDate(weekEnd))
    } else {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      onDateFromChange(formatDate(start))
      onDateToChange(formatDate(end))
    }
  }

  function getButtonStyle(state: FilterState | undefined, activeColor: string): string {
    if (state === 'include') return activeColor
    if (state === 'exclude') return 'bg-gray-200 text-gray-500 border-gray-400 line-through'
    return 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
  }

  function getIcon(state: FilterState | undefined): string {
    if (state === 'include') return '✓ '
    if (state === 'exclude') return '✕ '
    return ''
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="text-xs font-medium text-gray-900">Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
              {activeFilterCount}
            </span>
          )}
        </div>
        <svg className={`w-3.5 h-3.5 text-gray-600 transition-transform ${isExpanded ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100">
          <div className="px-3 py-2.5 space-y-3">
            {/* Urgency filter */}
            <div>
              <h3 className="text-[11px] font-medium text-gray-900 mb-1.5">Urgency</h3>
              <div className="flex flex-wrap gap-1.5">
                {URGENCY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => toggleUrgency(opt.value)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                      getButtonStyle(urgencyFilters[opt.value], opt.color)
                    }`}
                  >
                    {getIcon(urgencyFilters[opt.value])}{opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Type/Category filter */}
            <div>
              <h3 className="text-[11px] font-medium text-gray-900 mb-1.5">Type</h3>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors ${
                      getButtonStyle(categoryFilters[cat], CATEGORY_COLORS[cat])
                    }`}
                  >
                    {getIcon(categoryFilters[cat])}{cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Courses */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-[11px] font-medium text-gray-900">Courses</h3>
                {Object.keys(courseFilters).length > 0 && (
                  <button
                    onClick={() => onCourseFilterChange({})}
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {courses.map(course => (
                  <button
                    key={course}
                    onClick={() => toggleCourse(course)}
                    className="flex items-center gap-1.5 w-full text-left group"
                  >
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${
                      courseFilters[course] === 'include' ? 'bg-blue-600 border-blue-600 text-white' :
                      courseFilters[course] === 'exclude' ? 'bg-red-100 border-red-400 text-red-600' :
                      'border-gray-300 bg-white'
                    }`}>
                      {courseFilters[course] === 'include' && '✓'}
                      {courseFilters[course] === 'exclude' && '✕'}
                    </span>
                    <span className={`text-[11px] group-hover:text-gray-900 ${
                      courseFilters[course] === 'exclude' ? 'text-gray-400 line-through' : 'text-gray-700'
                    }`}>{course}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div>
              <h3 className="text-[11px] font-medium text-gray-900 mb-1.5">Date range</h3>
              <div className="grid grid-cols-2 gap-2 mb-1.5">
                <div>
                  <label className="text-[10px] text-gray-600 mb-0.5 block">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => onDateFromChange(e.target.value)}
                    className="w-full text-[11px] px-1.5 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-600 mb-0.5 block">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => onDateToChange(e.target.value)}
                    className="w-full text-[11px] px-1.5 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setQuickDateFilter('today')}
                  className="text-[11px] px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={() => setQuickDateFilter('week')}
                  className="text-[11px] px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  This Week
                </button>
                <button
                  onClick={() => setQuickDateFilter('month')}
                  className="text-[11px] px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  This Month
                </button>
              </div>
            </div>

            {/* Clear all */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearAll}
                className="w-full text-[11px] py-1.5 border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
