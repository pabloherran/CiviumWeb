import type { IncidentStatus } from '../types/incident'
import { STATUS_LABELS } from '../utils/labels'

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{STATUS_LABELS[status]}</span>
}
