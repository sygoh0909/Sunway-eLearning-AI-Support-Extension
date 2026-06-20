import { storageGet, storageSet, getSettings } from '../utils/storage'
import { scoreUrgency } from '../utils/deadlines'
import { sendDeadlineNotification } from './notification'

export function setupDeadlineAlarm(): void {
  chrome.alarms.create('check-deadlines', { periodInMinutes: 60 })
}