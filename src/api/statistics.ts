import { apiClient } from './client'
import type { Statistics, StatisticsFilters } from '../types/statistics'

/**
 * Los filtros son acumulables: cada categoría/estado/municipio seleccionado
 * se manda como parámetro de query repetido (mismo formato que espera
 * StatisticsRoutes.kt en el backend), no como una lista separada por comas.
 */
export async function getStatistics(filters: StatisticsFilters): Promise<Statistics> {
  const params = new URLSearchParams()
  filters.categories?.forEach((c) => params.append('category', c))
  filters.statuses?.forEach((s) => params.append('status', s))
  filters.municipalityIds?.forEach((m) => params.append('municipalityId', m))
  if (filters.granularity) params.set('granularity', filters.granularity)

  const { data } = await apiClient.get<Statistics>('estadisticas', { params })
  return data
}