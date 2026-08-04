import type { Deadline } from '../utils/types'

const ICON_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAC8ElEQVR4nO2d223DMBAEZbeVzlhAOktdzk8EBIklkeJrjzvzb4C6HS5pG7C3DQAAABx5bIvz+fF61bw+fT2WntFSD1cbtqMUoR9kVOArCxFu4SqhryJDiMWqhx5ZBukFRg0+kgiSC1sl+AgiSC1o1eCVRZBYiEvwiiI8Zy/ANXyVZ384P7wSs9pgSgMQvs5MhgtA+FqzGVY7BK95JAxpAMLXnVl3AQhfe3ZdBSB8/Rl2E4DwY8yyiwCEH2emzQUg/H70mG1TAQi/P61n3EwAwh9Hy1k3EYDwx9Nq5tO/DYS5VAvA7p9Hi9lXCUD486nN4LYAhK9DTRbcAcy5JQC7X4+7mRQLQPi63MmGI8CcIgHY/fqUZkQDmJMtALs/DiVZ0QDmZAnA7o9HbmY0gDmXArD745KTHQ1gDgKYcyoA9R+fqwxpAHMQwJxDAaj/dTjLkgYwBwHMQQBz3grA+b8eR5nSAOYggDkIYA4CmPNPAC6A6/IuWxrAHAQwBwHMQQBzEMAcBDAHAcxBAHMQwBwEMAcBzEEAcxDAHAQwBwHMeSr+ny304V22NIA5CGAOApiDAOa8FYCL4HocZUoDmIMA5iCAOYcCcA9Yh7MsaQBzEMCcUwE4BuJzlSENYA4CmHMpAMdAXHKyowHMyRKAFohHbmY0gDnZAtACcSjJigYwp0gAWkCf0oxoAHOKBaAFdLmTza0GQAI97mbCEWDObQFoAR1qsqhqACSYT20G1UcAEsyjxey5A5jTRABaYDytZt6sAZBgHC1n3fQIQIJ+tJ5x8zsAEvSjx2y7XAKRIM5Mu70LQIIYs+z6NhAJ9GfY/XMAJNCe3ZAPgpBAd2bDfxKOv6XT2izDPwqmDbRmM+W7ACTQmcn0XwV1PxLS5F9mfboPwP3Zpy/AsQ2SQPA7MgtxECEJBb8jt6AVRUiCwe/ILmwFEZJw8DvyC4wmQwoQ+m9CLVZVhhQs9N+EXfhMIVLgwP+yzIP0kiItFDYAAADA9sM3Q/Yc63/Jx+cAAAAASUVORK5CYII='

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
    iconUrl: ICON_DATA_URL,
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
