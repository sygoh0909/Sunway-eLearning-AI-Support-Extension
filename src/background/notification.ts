import type { Deadline } from '../utils/types'
import { getSettings } from '../utils/storage'

function getDaysUntilDue(dueDate: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export async function sendDeadlineNotification(deadline: Deadline, force = false): Promise<void> {
  if (!force) {
    const settings = await getSettings()
    if (!settings.notificationsEnabled || !settings.notificationTypes.deadlineReminders) return
  }

  const daysLeft = getDaysUntilDue(deadline.dueDate)

  let timeLabel: string
  if (daysLeft <= 0) timeLabel = 'TODAY'
  else if (daysLeft === 1) timeLabel = 'Tomorrow'
  else timeLabel = `${daysLeft} days left`

  const dueDate = new Date(deadline.dueDate)
  const formatted = dueDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const isUrgent = daysLeft <= 1

  const notifId = `deadline-${deadline.id}`
  if (deadline.linkUrl) notificationLinks.set(notifId, deadline.linkUrl)

  chrome.notifications.create(notifId, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('public/icon128.png'),
    title: `${isUrgent ? '⚠️ ' : ''}${timeLabel}: ${deadline.task}`,
    message: `${deadline.courseName} — due ${formatted}`,
    priority: isUrgent ? 2 : 1,
  })
}

const notificationLinks = new Map<string, string>()

chrome.notifications.onClicked.addListener((notificationId) => {
  if (!notificationId.startsWith('deadline-')) return
  const url = notificationLinks.get(notificationId)
  if (url) {
    chrome.tabs.query({ url: 'https://elearn.sunway.edu.my/*' }, (tabs) => {
      if (tabs.length > 0 && tabs[0].id) {
        chrome.tabs.update(tabs[0].id, { url, active: true })
        chrome.windows.update(tabs[0].windowId!, { focused: true })
      } else {
        chrome.tabs.create({ url })
      }
    })
    notificationLinks.delete(notificationId)
  } else {
    chrome.action.openPopup()
  }
})
