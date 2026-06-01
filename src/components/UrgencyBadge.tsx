import type { Deadline } from '../utils/types'

interface Props { urgency: Deadline['urgency'] }

export default function UrgencyBadge({ urgency }: Props) {
  const styles = {
    overdue: 'bg-red-100 text-red-700',
    soon: 'bg-yellow-100 text-yellow-700',
    upcoming: 'bg-green-100 text-green-700',
  }
  const labels = {
    overdue: '🔴 Overdue',
    soon: '🟡 Due Soon',
    upcoming: '🟢 Upcoming',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[urgency]}`}>
      {labels[urgency]}
    </span>
  )
}