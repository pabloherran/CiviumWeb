import { apiClient } from './client'
import type {
  AssignIncidentRequest,
  Incident,
  IncidentStatus,
  ResolveIncidentRequest,
} from '../types/incident'

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

/**
 * Asigna (o reasigna) la incidencia a un operario. Solo MUNICIPAL_ADMIN/SUPER_ADMIN;
 * el backend valida que el operario pertenezca al municipio de la incidencia.
 * La incidencia pasa a "En resolución" (IN_PROGRESS).
 */
export async function assignIncident(id: string, operatorId: string): Promise<Incident> {
  const body: AssignIncidentRequest = { operatorId }
  const { data } = await apiClient.post<Incident>(`incidencias/${id}/assign`, body)
  return data
}

/** Quita la asignación: la incidencia vuelve a "Abierta". */
export async function unassignIncident(id: string): Promise<Incident> {
  const { data } = await apiClient.delete<Incident>(`incidencias/${id}/assign`)
  return data
}
