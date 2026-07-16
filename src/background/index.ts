import { initStorage, storageSet, storageGet, getSettings } from '../utils/storage'
import { setupDeadlineAlarm } from './deadlineTracker'
import './notification'
import type { ChromeMessage } from '../utils/types'

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Sunway Extension] Installed')
  await initStorage()
  setupDeadlineAlarm()
})

chrome.runtime.onMessage.addListener((message: ChromeMessage, sender, sendResponse) => {
  if (message.type === 'TRIGGER_SCRAPE') {
    handleScrape(sender.tab?.id).then((result) => sendResponse(result))
    return true
  }

  if (message.type === 'SCRAPE_RESULT') {
    handleScrapeResult(message.data as any).then((result) => sendResponse(result))
    return true
  }

  if (message.type === 'SUMMARISED_READY') {
    setupDeadlineAlarm()
    sendResponse({ success: true })
  }
  return false
})

async function findElearnTabId(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ url: 'https://elearn.sunway.edu.my/*' })
  return tabs.length > 0 ? (tabs[0].id ?? null) : null
}

async function handleScrape(senderTabId?: number) {
  try {
    const tabId = senderTabId ?? await findElearnTabId()
    if (!tabId) {
      return { success: false, error: 'Please open eLearn in a tab first and make sure you are logged in.' }
    }

    console.log('[Sunway Extension] Sending DO_SCRAPE to tab', tabId)
    const response = await chrome.tabs.sendMessage(tabId, { type: 'DO_SCRAPE', data: null })
    console.log('[Sunway Extension] Scrape response:', JSON.stringify(response).slice(0, 200))

    if (!response?.success) {
      return { success: false, error: response?.error ?? 'Scrape failed from content script.' }
    }

    const { courses, announcements, assignmentDeadlines } = response.data
    console.log(`[Sunway Extension] Got ${courses.length} courses, ${announcements.length} announcements, ${(assignmentDeadlines ?? []).length} assignment deadlines`)

    return await handleScrapeResult(response.data)
  } catch (e) {
    console.error('[Sunway Extension] Scrape failed:', e)
    return { success: false, error: 'Failed to connect to eLearn tab. Make sure you are logged in.' }
  }
}

async function handleScrapeResult(data: { courses: any[]; announcements: any[]; assignmentDeadlines?: any[] }) {
  try {
    if (!data || !data.courses || !data.announcements) {
      return { success: false, error: 'No data received from content script.' }
    }

    const { courses, announcements, assignmentDeadlines } = data

    if (courses.length > 0) {
      await storageSet('courses', courses)
    }

    if (assignmentDeadlines && assignmentDeadlines.length > 0) {
      await storageSet('assignmentDeadlines', assignmentDeadlines)
    }

    if (announcements.length > 0) {
      await storageSet('announcements', announcements)

      // Summarise in the eLearn tab so window.ai (Chrome Built-in AI) is available
      const tabId = await findElearnTabId()
      let summarised = null
      if (tabId) {
        try {
          const res = await chrome.tabs.sendMessage(tabId, { type: 'DO_SUMMARISE', data: announcements })
          if (res?.success) summarised = res.data
        } catch {}
      }

      // Fallback: import summarise dynamically if tab is unavailable
      if (!summarised) {
        const { summarise } = await import('../utils/ai')
        summarised = await summarise(announcements)
      }

      await storageSet('summarised', summarised)
      await storageSet('lastFetched', Date.now())
      setupDeadlineAlarm()
      return { success: true, count: announcements.length }
    }

    return { success: true, count: 0 }
  } catch (e) {
    console.error('[Sunway Extension] Processing failed:', e)
    return { success: false, error: String(e) }
  }
}

async function setupPeriodicScrape() {
  const settings = await getSettings()
  chrome.alarms.create('periodic-scrape', { periodInMinutes: settings.refreshInterval })
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'periodic-scrape') {
    await handleScrape()
  }
})

setupPeriodicScrape()

export {}

