export type UserRole = 'CITIZEN' | 'OPERATOR' | 'MUNICIPAL_ADMIN' | 'SUPER_ADMIN'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  municipalityId?: string | null
  active: boolean
}

export type InvitationStatus = 'PENDING' | 'USED' | 'EXPIRED'

export interface Invitation {
  id: string
  code: string
  email: string
  roleToGrant: UserRole
  municipalityId: string
  createdAt: number
  expiresAt: number
  status: InvitationStatus
}

export interface CreateInvitationRequest {
  email: string
  /** Solo lo usa SUPER_ADMIN; un MUNICIPAL_ADMIN siempre invita OPERATOR. */
  roleToGrant?: UserRole
  /** Obligatorio solo para SUPER_ADMIN. */
  municipalityId?: string
}
