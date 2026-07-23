import { useState, useEffect } from 'react'
import { storageGet, storageSet } from '../utils/storage'
import type { SummarisedAnnouncement, AnnouncementCategory, Urgency } from '../utils/types'
import { categorizeAnnouncement, scoreUrgency } from '../utils/deadlines'
import AnnouncementCard from '../components/AnnouncementCard'
import FilterPanel from '../components/FilterPanel'
import type { FilterState } from '../components/FilterPanel'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import SettingsTab from './SettingsTab'

type View = 'main' | 'settings'

export default function App() {
  const [view, setView] = useState<View>('main')
  const [announcements, setAnnouncements] = useState<SummarisedAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastFetched, setLastFetched] = useState<number | null>(null)
  const [isSidebar, setIsSidebar] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [courseFilters, setCourseFilters] = useState<Record<string, FilterState>>({})
  const [categoryFilters, setCategoryFilters] = useState<Record<string, FilterState>>({})
  const [urgencyFilters, setUrgencyFilters] = useState<Record<string, FilterState>>({})
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [urgencyOverrides, setUrgencyOverrides] = useState<Record<string, Urgency>>({})

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const mode = params.get('mode')
    setIsSidebar(mode === 'sidebar' || mode === 'window')
    loadAndAutoRefresh()
  }, [])

  async function loadAndAutoRefresh() {
    try {
      setLoading(true)
      const data = await storageGet('summarised')
      const fetched = await storageGet('lastFetched')
      const overrides = (await storageGet('urgencyOverrides')) ?? {}
      setUrgencyOverrides(overrides)
      if (data) {
        for (const a of data) {
          for (const d of a.deadlines) {
            d.urgency = overrides[a.id] ?? (d.dueDate ? scoreUrgency(d.dueDate) : 'upcoming')
          }
        }
      }
      setAnnouncements(data ?? [])
      setLastFetched(fetched)

      const isEmpty = !data || data.length === 0
      const isStale = fetched ? (Date.now() - fetched > 5 * 60 * 1000) : true
      if (isEmpty || isStale) {
        setRefreshing(true)
        try {
          const response = await chrome.runtime.sendMessage({ type: 'TRIGGER_SCRAPE', data: null })
          if (response?.success) {
            await reloadFromStorage()
          }
        } catch {}
        setRefreshing(false)
      }
    } catch {
      setError('Failed to load announcements')
    } finally {
      setLoading(false)
    }
  }

  async function reloadFromStorage() {
    const data = await storageGet('summarised')
    const fetched = await storageGet('lastFetched')
    const overrides = (await storageGet('urgencyOverrides')) ?? {}
    setUrgencyOverrides(overrides)
    if (data) {
      for (const a of data) {
        for (const d of a.deadlines) {
          d.urgency = overrides[a.id] ?? (d.dueDate ? scoreUrgency(d.dueDate) : 'upcoming')
        }
      }
    }
    setAnnouncements(data ?? [])
    setLastFetched(fetched)
  }

  async function handleUrgencyChange(announcementId: string, newUrgency: Urgency) {
    const updated = { ...urgencyOverrides, [announcementId]: newUrgency }
    setUrgencyOverrides(updated)
    await storageSet('urgencyOverrides', updated)
    setAnnouncements(prev => prev.map(a => {
      if (a.id !== announcementId) return a
      return { ...a, deadlines: a.deadlines.map(d => ({ ...d, urgency: newUrgency })) }
    }))
  }

  async function handleRefresh() {
    setRefreshing(true)
    setError('')
    try {
      const response = await chrome.runtime.sendMessage({ type: 'TRIGGER_SCRAPE', data: null })
      if (response?.success) {
        await reloadFromStorage()
      } else {
        setError(response?.error ?? 'Scrape failed. Make sure you are logged into eLearn.')
      }
    } catch {
      setError('Failed to connect. Make sure you are logged into eLearn.')
    } finally {
      setRefreshing(false)
    }
  }

  function handleOpenWindow() {
    chrome.windows.create({
      url: chrome.runtime.getURL('src/popup/index.html?mode=window'),
      type: 'normal',
      width: 600,
      height: 800,
    })
  }

  const courses = [...new Set(announcements.map(a => a.courseName))]
  const allCategories: AnnouncementCategory[] = ['Deadline', 'Academic', 'Event', 'Administrative']

  const filtered = announcements.filter(a => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matches = a.title.toLowerCase().includes(q)
        || a.body.toLowerCase().includes(q)
        || a.courseName.toLowerCase().includes(q)
        || a.summary?.toLowerCase().includes(q)
      if (!matches) return false
    }

    if (Object.keys(courseFilters).length > 0) {
      const state = courseFilters[a.courseName]
      if (state === 'exclude') return false
      const hasIncludes = Object.values(courseFilters).some(v => v === 'include')
      if (hasIncludes && state !== 'include') return false
    }

    if (Object.keys(categoryFilters).length > 0) {
      const category = categorizeAnnouncement(a.title, a.body, a.courseName)
      const state = categoryFilters[category]
      if (state === 'exclude') return false
      const hasIncludes = Object.values(categoryFilters).some(v => v === 'include')
      if (hasIncludes && state !== 'include') return false
    }

    if (Object.keys(urgencyFilters).length > 0) {
      let effective: string | null = null
      if (a.deadlines.length > 0) {
        const urgencies = a.deadlines.map(d => d.urgency)
        effective = urgencies.includes('soon') ? 'soon'
          : urgencies.includes('upcoming') ? 'upcoming'
          : 'overdue'
      }
      if (!effective) {
        const hasIncludes = Object.values(urgencyFilters).some(v => v === 'include')
        if (hasIncludes) return false
      } else {
        const state = urgencyFilters[effective]
        if (state === 'exclude') return false
        const hasIncludes = Object.values(urgencyFilters).some(v => v === 'include')
        if (hasIncludes && state !== 'include') return false
      }
    }

    if (dateFrom || dateTo) {
      const announcementDate = new Date(a.date).getTime()
      if (isNaN(announcementDate)) return false
      if (dateFrom) {
        const from = new Date(dateFrom).getTime()
        if (announcementDate < from) return false
      }
      if (dateTo) {
        const to = new Date(dateTo + 'T23:59:59').getTime()
        if (announcementDate > to) return false
      }
    }
    return true
  }).sort((a, b) => {
    const getP = (item: SummarisedAnnouncement) => {
      if (item.deadlines.length === 0) return 3
      const urgencies = item.deadlines.map(d => d.urgency)
      if (urgencies.includes('soon')) return 0
      if (urgencies.includes('upcoming')) return 1
      if (urgencies.includes('overdue')) return 2
      return 3
    }
    const pa = getP(a), pb = getP(b)
    if (pa !== pb) return pa - pb
    const da = new Date(a.date).getTime() || 0
    const db = new Date(b.date).getTime() || 0
    return db - da
  })

  const params = new URLSearchParams(window.location.search)
  const isWindow = params.get('mode') === 'window'

  const containerClass = isSidebar && !isWindow
    ? 'w-full h-screen flex flex-col bg-gray-50'
    : isWindow
      ? 'w-full h-screen flex flex-col bg-gray-50 overflow-auto'
      : 'w-[380px] min-h-[480px] max-h-[600px] flex flex-col bg-gray-50 resize overflow-auto'

  if (loading) return (
    <div className={containerClass}>
      <LoadingSpinner />
    </div>
  )

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-3 py-2.5 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-gray-900">E-Learn Assistant</h1>
            <p className="text-[11px] text-gray-600">AI-powered announcements</p>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-50"
              title="Refresh"
            >
              <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => setView(view === 'settings' ? 'main' : 'settings')}
              className={`p-1 rounded hover:bg-gray-100 ${view === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-gray-600'}`}
              title="Settings"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {!isWindow && (
              <button
                onClick={handleOpenWindow}
                className="p-1 rounded hover:bg-gray-100 text-gray-600"
                title="Open in full window"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {view === 'main' && (
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1 relative">
              <svg className="w-3 h-3 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 rounded hover:bg-gray-200 text-gray-500 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-[11px] text-gray-700">
            <span className="font-medium">{filtered.length}</span> of <span className="font-medium">{announcements.length}</span>
          </p>
          {lastFetched && (
            <span className="text-[11px] text-gray-500">
              Updated {new Date(lastFetched).toLocaleTimeString()}
            </span>
          )}
          {!lastFetched && (
            <span className="text-[11px] text-gray-500">Not yet fetched</span>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-3">
          {view === 'settings' ? (
            <SettingsTab onClose={() => setView('main')} />
          ) : (
            <>
              {error && <ErrorMessage message={error} />}

              {/* Filter Panel */}
              {courses.length > 0 && (
                <FilterPanel
                  courses={courses}
                  courseFilters={courseFilters}
                  onCourseFilterChange={setCourseFilters}
                  categories={allCategories}
                  categoryFilters={categoryFilters}
                  onCategoryFilterChange={setCategoryFilters}
                  urgencyFilters={urgencyFilters}
                  onUrgencyFilterChange={setUrgencyFilters}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  onDateFromChange={setDateFrom}
                  onDateToChange={setDateTo}
                />
              )}

              {/* Announcements */}
              {announcements.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-6 text-center border border-gray-200">
                  <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">No announcements yet</h3>
                  <p className="text-xs text-gray-600 mb-3">Log in to eLearn and click Refresh to fetch announcements</p>
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {refreshing ? 'Fetching...' : 'Fetch Announcements'}
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm p-6 text-center border border-gray-200">
                  <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <h3 className="text-sm font-medium text-gray-900 mb-1">No announcements found</h3>
                  <p className="text-xs text-gray-600">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map(announcement => (
                    <AnnouncementCard key={announcement.id} announcement={announcement} onUrgencyChange={handleUrgencyChange} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
