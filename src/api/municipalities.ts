import { apiClient } from './client'
import type { Municipality, Province } from '../types/municipality'

export async function getProvinces(): Promise<Province[]> {
  const { data } = await apiClient.get<Province[]>('provincias')
  return data
}

export async function searchMunicipalities(
  provincia: string,
  query: string,
  limit = 50,
): Promise<Municipality[]> {
  const { data } = await apiClient.get<Municipality[]>('municipios', {
    params: { provincia, query, limit, mode: 'prefix' },
  })
  return data
}
