import type { IncidentCategory, IncidentStatus } from '../types/incident'
import type { InvitationStatus, UserRole } from '../types/user'

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  SIDEWALKS: 'Aceras',
  ROADWAY: 'Calzada',
  SIGNAGE: 'Señalización',
  STREET_FURNITURE: 'Mobiliario urbano',
  PARKS_AND_GARDENS: 'Parques y jardines',
  FOUNTAINS_AND_IRRIGATION: 'Fuentes y regadíos',
  WASTE_CONTAINERS: 'Contenedores y basuras',
  GRAFFITI: 'Pintadas',
  LIGHTING: 'Alumbrado',
  TRANSPORT: 'Transporte',
  ACCESSIBILITY: 'Accesibilidad',
  PUBLIC_BUILDINGS: 'Edificios públicos',
  OTHER: 'Otros',
}

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  OPEN: 'Abierta',
  RESOLVED: 'Resuelta',
}

export const ROLE_LABELS: Record<UserRole, string> = {
  CITIZEN: 'Ciudadano',
  OPERATOR: 'Operario',
  MUNICIPAL_ADMIN: 'Administrador municipal',
  SUPER_ADMIN: 'Superadministrador',
}

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  PENDING: 'Pendiente',
  USED: 'Utilizada',
  EXPIRED: 'Caducada',
}

export function formatDate(timestamp?: number | null): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
