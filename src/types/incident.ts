export type IncidentStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'

export type IncidentCategory =
  | 'SIDEWALKS'
  | 'ROADWAY'
  | 'SIGNAGE'
  | 'STREET_FURNITURE'
  | 'PARKS_AND_GARDENS'
  | 'FOUNTAINS_AND_IRRIGATION'
  | 'WASTE_CONTAINERS'
  | 'GRAFFITI'
  | 'LIGHTING'
  | 'TRANSPORT'
  | 'ACCESSIBILITY'
  | 'PUBLIC_BUILDINGS'
  | 'OTHER'

/**
 * Incidencia tal y como la devuelve el backend (GET /incidencias, /incidencias/{id}).
 * Mismos campos que IncidentDto en la app Android.
 */
export interface Incident {
  id: string
  title: string
  description: string
  category: IncidentCategory
  status: IncidentStatus
  createdAt?: number | null
  createdBy: string
  resolvedBy?: string | null
  latitude?: number | null
  longitude?: number | null
  reportPhotoUrl?: string | null
  resolutionPhotoUrl?: string | null
  resolutionNote?: string | null
  municipalityId?: string | null
  /** Id del operario asignado, o null/undefined si no está asignada. */
  assignedTo?: string | null
  /** Nombre del operario asignado, resuelto por el backend para no tener que cruzarlo aquí. */
  assignedToName?: string | null
}

export interface ResolveIncidentRequest {
  resolved: boolean
  resolutionNote?: string
}

export interface IncidentFilters {
  status?: IncidentStatus
  category?: IncidentCategory
  municipalityId?: string
}

export interface AssignIncidentRequest {
  operatorId: string
}
