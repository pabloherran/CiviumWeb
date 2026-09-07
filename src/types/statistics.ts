import type { IncidentCategory, IncidentStatus } from './incident'

export type StatsGranularity = 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'YEARLY'

export interface CategoryCount {
  category: IncidentCategory
  count: number
}

export interface StatusCount {
  status: IncidentStatus
  count: number
}

export interface PeriodCount {
  label: string
  periodStart: number
  count: number
}

export interface OperatorRanking {
  operatorId: string
  operatorName: string
  municipalityId?: string | null
  resolvedCount: number
}

/** Respuesta de GET /estadisticas. */
export interface Statistics {
  totalCount: number
  resolvedCount: number
  openCount: number
  inProgressCount: number
  /** Null si no hay ninguna incidencia resuelta con la que calcularlo. */
  avgResolutionDays?: number | null
  byCategory: CategoryCount[]
  byStatus: StatusCount[]
  resolvedByPeriod: PeriodCount[]
  operatorRanking: OperatorRanking[]
}

export interface StatisticsFilters {
  categories?: IncidentCategory[]
  statuses?: IncidentStatus[]
  /** Solo tiene efecto para SUPER_ADMIN — un MUNICIPAL_ADMIN siempre ve el suyo. */
  municipalityIds?: string[]
  granularity?: StatsGranularity
}