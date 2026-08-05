import type {
  Course,
  Announcement,
  Deadline,
  SummarisedAnnouncement,
  AppSettings,
} from './types'

export interface StorageSchema {
  courses: Course[]
  announcements: Announcement[]
  summarised: SummarisedAnnouncement[]
  assignmentDeadlines: Deadline[]
  lastFetched: number
  settings: AppSettings
  notifiedDeadlines: Record<string, number>
  urgencyOverrides: Record<string, 'overdue' | 'soon' | 'upcoming'>
}

const DEFAULT_SETTINGS: AppSettings = {
  refreshInterval: 60,
  notificationsEnabled: true,
  notificationTiming: ['1week'],
  notificationTypes: {
    deadlineReminders: true,
    newAnnouncements: true,
    urgentOnly: false,
  },
  notificationHour: 8,
}

export async function storageGet<K extends keyof StorageSchema>(
  key: K
): Promise<StorageSchema[K] | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] ?? null)
    })
  })
}

export async function storageSet<K extends keyof StorageSchema>(
  key: K,
  value: StorageSchema[K]
): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve)
  })
}

export async function getSettings(): Promise<AppSettings> {
  const saved = await storageGet('settings')
  return { ...DEFAULT_SETTINGS, ...saved }
}

export async function initStorage(): Promise<void> {
  const existing = await storageGet('settings')
  if (!existing) {
    await storageSet('settings', DEFAULT_SETTINGS)
  }
}
