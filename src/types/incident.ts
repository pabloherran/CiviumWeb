export type IncidentStatus = 'OPEN' | 'RESOLVED'

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
 *
 * `assignedTo` / `assignedToName` NO existen todavía en el backend: se dejan
 * aquí ya tipados (opcionales) para no tener que tocar este modelo cuando se
 * implemente el reparto de incidencias a operarios (ver README, sección
 * "Roadmap"). Hasta entonces siempre llegarán como `undefined`.
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
  /** Preparado para el futuro reparto de trabajo. Aún no lo envía el backend. */
  assignedTo?: string | null
  /** Preparado para el futuro reparto de trabajo. Aún no lo envía el backend. */
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
