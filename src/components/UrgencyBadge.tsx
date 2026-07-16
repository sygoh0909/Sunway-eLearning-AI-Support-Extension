import { URGENCY_CONFIG } from '../utils/types'
import type { Urgency } from '../utils/types'

interface Props { urgency: Urgency }

export default function UrgencyBadge({ urgency }: Props) {
  const { label, color } = URGENCY_CONFIG[urgency]
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {label}
    </span>
  )
}