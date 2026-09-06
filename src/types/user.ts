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

/** Respuesta de DELETE /admin/users/{id}. */
export interface DeleteUserResponse {
  deleted: boolean
  municipalityId?: string | null
  /**
   * Admins que quedan en el municipio tras el borrado. Solo viene informado
   * cuando el usuario borrado era MUNICIPAL_ADMIN. Si llega a 0 y quedan
   * `orphanOperators`, conviene ofrecer dar de baja el municipio completo.
   */
  remainingAdmins?: number | null
  orphanOperators?: number | null
  /**
   * Incidencias EN_PROGRESO que se quedan sin operario asignado tras el
   * borrado. Solo viene informado cuando el usuario borrado era OPERATOR
   * (hallazgo 1.5 de la revisión MVP).
   */
  orphanedIncidents?: number | null
}

/** Respuesta de DELETE /admin/municipalities/{ine}/users. */
export interface MunicipalityDeletionResponse {
  deletedUsers?: string | null
  municipalityId?: string | null
}
