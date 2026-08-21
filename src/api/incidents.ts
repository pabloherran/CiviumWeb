import { apiClient } from './client'
import type { Incident, IncidentStatus, ResolveIncidentRequest } from '../types/incident'

export async function getIncidents(status?: IncidentStatus): Promise<Incident[]> {
  const { data } = await apiClient.get<Incident[]>('incidencias', {
    params: status ? { status } : undefined,
  })
  return data
}

export async function getIncidentById(id: string): Promise<Incident> {
  const { data } = await apiClient.get<Incident>(`incidencias/${id}`)
  return data
}

export async function setIncidentResolved(
  id: string,
  body: ResolveIncidentRequest,
): Promise<Incident> {
  const { data } = await apiClient.patch<Incident>(`incidencias/${id}/status`, body)
  return data
}

export async function deleteIncident(id: string): Promise<void> {
  await apiClient.delete(`incidencias/${id}`)
}
