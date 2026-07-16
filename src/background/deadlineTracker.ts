import { storageGet, storageSet, getSettings } from '../utils/storage'
import { scoreUrgency } from '../utils/deadlines'
import { sendDeadlineNotification } from './notification'

export function setupDeadlineAlarm(): void {
  chrome.alarms.create('check-deadlines', { periodInMinutes: 60 })
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'check-deadlines') return

  const settings = await getSettings()

  // Check announcement-extracted deadlines
  const summarised = await storageGet('summarised')
  let summarisedUpdated = false

  if (summarised && summarised.length > 0) {
    for (const announcement of summarised) {
      for (const deadline of announcement.deadlines) {
        if (!deadline.dueDate) continue
        const newUrgency = scoreUrgency(deadline.dueDate)

        if (newUrgency !== deadline.urgency) {
          const oldUrgency = deadline.urgency
          deadline.urgency = newUrgency

          if (
            settings.notificationsEnabled &&
            (newUrgency === 'soon' || newUrgency === 'overdue') &&
            oldUrgency === 'upcoming'
          ) {
            sendDeadlineNotification(deadline)
          }

          summarisedUpdated = true
        }
      }
    }

    if (summarisedUpdated) {
      await storageSet('summarised', summarised)
    }
  }

  // Check gradebook assignment deadlines
  const assignmentDeadlines = await storageGet('assignmentDeadlines')
  let assignmentsUpdated = false

  if (assignmentDeadlines && assignmentDeadlines.length > 0) {
    for (const deadline of assignmentDeadlines) {
      if (!deadline.dueDate) continue
      const newUrgency = scoreUrgency(deadline.dueDate)

      if (newUrgency !== deadline.urgency) {
        const oldUrgency = deadline.urgency
        deadline.urgency = newUrgency

        if (
          settings.notificationsEnabled &&
          (newUrgency === 'soon' || newUrgency === 'overdue') &&
          oldUrgency === 'upcoming'
        ) {
          sendDeadlineNotification(deadline)
        }

        assignmentsUpdated = true
      }
    }

    if (assignmentsUpdated) {
      await storageSet('assignmentDeadlines', assignmentDeadlines)
    }
  }
})
