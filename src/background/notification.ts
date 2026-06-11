import type { Deadline } from '../utils/types'

export function sendDeadlineNotification(deadline: Deadline): void {
  const dueDate = new Date(deadline.dueDate)
  const formatted = dueDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  const isOverdue = deadline.urgency === 'overdue'

  chrome.notifications.create(`deadline-${deadline.id}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('public/favicon.svg'),
    title: `${isOverdue ? 'OVERDUE' : 'Due Soon'}: ${deadline.task}`,
    message: `${deadline.courseName} — due ${formatted}`,
    priority: isOverdue ? 2 : 1,
  })
}

chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith('deadline-')) {
    chrome.action.openPopup()
  }
})
