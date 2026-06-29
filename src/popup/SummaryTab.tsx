import { useEffect, useState } from 'react'
import { storageGet } from '../utils/storage'
import type { SummarisedAnnouncement } from '../utils/types'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import AnnouncementCard from '../components/AnnouncementCard'

export default function SummaryTab() {
  const [announcements, setAnnouncements] = useState<SummarisedAnnouncement[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [lastFetched, setLastFetched] = useState<number | null>(null)

  useEffect(() => {
    loadAnnouncements()
  }, [])

  async function loadAnnouncements() {
    try {   
      setLoading(true)
      const data = await storageGet('summarised')
      const fetched = await storageGet('lastFetched')
      setAnnouncements(data ?? [])
      setLastFetched(fetched)
    } catch {
      setError('Failed to load announcements')
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    setError('')
    try {
      const response = await chrome.runtime.sendMessage({ type: 'TRIGGER_SCRAPE', data: null })
      if (response?.success) {
        await loadAnnouncements()
      } else {
        setError(response?.error ?? 'Scrape failed. Make sure you are logged into eLearn.')
      }
    } catch {
      setError('Failed to connect. Make sure you are logged into eLearn.')
    } finally {
      setRefreshing(false)
    }
  }

  const filtered = filter === 'all'
    ? announcements
    : announcements.filter(a => a.courseName === filter)

  const courses = [...new Set(announcements.map(a => a.courseName))]

  if (loading) return <LoadingSpinner />
  if (error && announcements.length === 0) return <ErrorMessage message={error} />

  return (
    <div className="space-y-3">
      {/* Refresh bar */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {lastFetched
            ? `Updated ${new Date(lastFetched).toLocaleTimeString()}`
            : 'Not yet fetched'}
        </span>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
        >
          <svg className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      {announcements.length === 0 ? (
        <div className="text-center py-8">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 className="text-sm font-medium text-gray-900 mb-1">No announcements yet</h3>
          <p className="text-xs text-gray-500 mb-3">Log in to eLearn and click Refresh to fetch announcements</p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {refreshing ? 'Fetching...' : 'Fetch Announcements'}
          </button>
        </div>
      ) : (
        <>
          {/* Filter bar */}
          {courses.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                  filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                All ({announcements.length})
              </button>
              {courses.map(course => (
                <button
                  key={course}
                  onClick={() => setFilter(course)}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                    filter === course ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  {course}
                </button>
              ))}
            </div>
          )}

          {/* Announcement list */}
          {filtered.map(announcement => (
            <AnnouncementCard key={announcement.id} announcement={announcement} />
          ))}
        </>
      )}
    </div>
  )
}