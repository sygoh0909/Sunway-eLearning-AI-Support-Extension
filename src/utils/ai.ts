import type { Announcement, SummarisedAnnouncement } from './types'
import { storageGet } from './storage'

export const OLLAMA_MODEL = 'llama3.1:8b'
export const OLLAMA_DEFAULT_URL = 'http://localhost:11434'

export async function getOllamaUrl(): Promise<string> {
  const settings = await storageGet('settings')
  return settings?.ollamaUrl ?? OLLAMA_DEFAULT_URL
}

export async function summarise(
  announcements: Announcement[]
): Promise<SummarisedAnnouncement[]> {
  // TODO: Feature 1 implementation
  return []
}
