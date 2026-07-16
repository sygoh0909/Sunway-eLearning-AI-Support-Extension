import type { Deadline } from '../utils/types'

function getDaysUntilDue(dueDate: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function sendDeadlineNotification(deadline: Deadline): void {
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

  chrome.notifications.create(`deadline-${deadline.id}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('public/favicon.svg'),
    title: `${isUrgent ? '⚠️ ' : ''}${timeLabel}: ${deadline.task}`,
    message: `${deadline.courseName} — due ${formatted}`,
    priority: isUrgent ? 2 : 1,
  })
}

chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith('deadline-')) {
    chrome.action.openPopup()
  }
})
