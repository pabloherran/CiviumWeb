import { apiClient } from './client'
import type {
  CreateInvitationRequest,
  DeleteUserResponse,
  Invitation,
  MunicipalityDeletionResponse,
  User,
} from '../types/user'

export async function listUsers(municipalityId?: string): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('admin/users', {
    params: municipalityId ? { municipalityId } : undefined,
  })
  return data
}

export async function setUserActive(id: string, active: boolean): Promise<void> {
  await apiClient.patch(`admin/users/${id}/active`, { active })
}

/**
 * Borrado individual. SUPER_ADMIN puede borrar cualquier OPERATOR/MUNICIPAL_ADMIN;
 * un MUNICIPAL_ADMIN solo puede borrar OPERATOR de su propio municipio (el
 * backend aplica esa regla; aquí no hace falta repetirla porque el listado
 * que ve cada rol ya viene filtrado en consecuencia).
 */
export async function deleteUser(id: string): Promise<DeleteUserResponse> {
  const { data } = await apiClient.delete<DeleteUserResponse>(`admin/users/${id}`)
  return data
}

/**
 * Baja completa de un municipio: borra TODOS sus operarios y administradores
 * municipales de una vez. Solo SUPER_ADMIN. Doble confirmación exigida por
 * el backend: `confirmIne` debe coincidir exactamente con `ine`.
 */
export async function deleteMunicipalityUsers(
  ine: string,
  confirmIne: string,
): Promise<MunicipalityDeletionResponse> {
  const { data } = await apiClient.delete<MunicipalityDeletionResponse>(
    `admin/municipalities/${ine}/users`,
    { data: { confirmIne } },
  )
  return data
}

export async function listInvitations(municipalityId?: string): Promise<Invitation[]> {
  const { data } = await apiClient.get<Invitation[]>('admin/invitations', {
    params: municipalityId ? { municipalityId } : undefined,
  })
  return data
}

export async function createInvitation(body: CreateInvitationRequest): Promise<Invitation> {
  const { data } = await apiClient.post<Invitation>('admin/invitations', body)
  return data
}

export async function deleteInvitation(id: string): Promise<void> {
  await apiClient.delete(`admin/invitations/${id}`)
}

/**
 * Municipios "cliente": los que tienen al menos un MUNICIPAL_ADMIN activo
 * ahora mismo. Se calcula al vuelo en el backend contra la tabla de
 * usuarios (no hay tabla ni flag propios que mantener sincronizados).
 * Solo SUPER_ADMIN puede llamarlo.
 */
export async function getClientMunicipalities(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>('admin/municipios-cliente')
  return data
}