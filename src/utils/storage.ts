import type {
  Course,
  Announcement,
  SummarisedAnnouncement,
  AppSettings
} from './types'

export interface StorageSchema {
  courses: Course[]
  announcements: Announcement[]
  summarised: SummarisedAnnouncement[]
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

export async function initStorage(): Promise<void> {
  const existing = await storageGet('settings')
  if (!existing) {
    await storageSet('settings', {
      ollamaUrl: 'http://localhost:11434',
      refreshInterval: 60,
    })
  }
}

