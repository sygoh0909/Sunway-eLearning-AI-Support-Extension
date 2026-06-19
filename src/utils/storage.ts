import type {
  Course,
  Announcement,
  Deadline,
  SummarisedAnnouncement,
  AppSettings
} from './types'

export interface StorageSchema {
  courses: Course[]
  announcements: Announcement[]
  summarised: SummarisedAnnouncement[]
  assignmentDeadlines: Deadline[]
  lastFetched: number
  settings: AppSettings
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

// extracted as a named constant so getSettings() and initStorage() share one source of truth
const DEFAULT_SETTINGS: AppSettings = {
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.2',
  refreshInterval: 60,
  notificationsEnabled: true,
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

