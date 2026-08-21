import { apiClient } from './client'
import type { CreateInvitationRequest, Invitation, User } from '../types/user'

export async function listUsers(municipalityId?: string): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('admin/users', {
    params: municipalityId ? { municipalityId } : undefined,
  })
  return data
}

export async function setUserActive(id: string, active: boolean): Promise<void> {
  await apiClient.patch(`admin/users/${id}/active`, { active })
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
