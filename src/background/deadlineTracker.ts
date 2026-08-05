import { storageGet, storageSet, getSettings } from '../utils/storage'
import { scoreUrgency } from '../utils/deadlines'
import { sendDeadlineNotification } from './notification'
import type { Deadline, NotificationTiming } from '../utils/types'

const TIMING_TO_DAYS: Record<NotificationTiming, number> = {
  '1day': 1,
  '3days': 3,
  '1week': 7,
  '2weeks': 14,
}

function getDaysUntilDue(dueDate: string): number {
  if (!dueDate) return Infinity
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  return (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
}

function shouldNotify(dueDate: string, timings: NotificationTiming[]): boolean {
  const daysLeft = getDaysUntilDue(dueDate)
  if (daysLeft < 0) return false

  for (const timing of timings) {
    const threshold = TIMING_TO_DAYS[timing]
    if (daysLeft <= threshold) return true
  }
  return false
}

export function setupDeadlineAlarm(): void {
  chrome.alarms.create('check-deadlines', { periodInMinutes: 60 })
}

export async function checkAndSendDeadlineNotifications(force = false): Promise<void> {
  const settings = await getSettings()

  if (!force) {
    if (!settings.notificationsEnabled || !settings.notificationTypes.deadlineReminders) return
    if (settings.notificationTiming.length === 0) return
    const currentHour = new Date().getHours()
    if (currentHour !== settings.notificationHour) return
  }

  const timings = settings.notificationTiming
  const notified: Record<string, number> = (await storageGet('notifiedDeadlines')) ?? {}
  const now = Date.now()

  const allDeadlines: Deadline[] = []

  const summarised = await storageGet('summarised')
  let summarisedUpdated = false

  if (summarised && summarised.length > 0) {
    for (const announcement of summarised) {
      for (const deadline of announcement.deadlines) {
        if (!deadline.dueDate) continue
        const newUrgency = scoreUrgency(deadline.dueDate)
        if (newUrgency !== deadline.urgency) {
          deadline.urgency = newUrgency
          summarisedUpdated = true
        }
        allDeadlines.push(deadline)
      }
    }
    if (summarisedUpdated) {
      await storageSet('summarised', summarised)
    }
  }

  const assignmentDeadlines = await storageGet('assignmentDeadlines')
  let assignmentsUpdated = false

  if (assignmentDeadlines && assignmentDeadlines.length > 0) {
    for (const deadline of assignmentDeadlines) {
      if (!deadline.dueDate) continue
      const newUrgency = scoreUrgency(deadline.dueDate)
      if (newUrgency !== deadline.urgency) {
        deadline.urgency = newUrgency
        assignmentsUpdated = true
      }
      allDeadlines.push(deadline)
    }
    if (assignmentsUpdated) {
      await storageSet('assignmentDeadlines', assignmentDeadlines)
    }
  }

  const eligible = allDeadlines
    .filter(dl => shouldNotify(dl.dueDate, timings))
    .filter(dl => {
      if (force) return true
      const lastNotified = notified[dl.id]
      if (lastNotified && (now - lastNotified) < 12 * 60 * 60 * 1000) return false
      return true
    })

  eligible.sort((a, b) => getDaysUntilDue(a.dueDate) - getDaysUntilDue(b.dueDate))

  const toNotify = eligible.slice(0, 5)

  for (const deadline of toNotify) {
    await sendDeadlineNotification(deadline, force)
    notified[deadline.id] = now
  }

  const cutoff = now - 30 * 24 * 60 * 60 * 1000
  for (const id of Object.keys(notified)) {
    if (notified[id] < cutoff) delete notified[id]
  }

  await storageSet('notifiedDeadlines', notified)
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'check-deadlines') return
  await checkAndSendDeadlineNotifications()
})
