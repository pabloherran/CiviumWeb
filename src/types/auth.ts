import type { User } from './user'

export interface AuthLoginRequest {
  email: string
  password: string
}

export interface AuthRegisterRequest {
  email: string
  name: string
  password: string
  invitationCode?: string
}

export interface AuthResponse {
  user: User
  token: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  email: string
  code: string
  newPassword: string
}

/**
 * Respuesta genérica de los endpoints de auth que no devuelven sesión
 * (forgot-password, reset-password). El backend homogeneiza los mensajes de
 * éxito a {"message": "..."} y los de error a {"error": "..."} (ver
 * Application.kt del backend); ambos campos son opcionales aquí para poder
 * usar el mismo tipo con cualquiera de los dos casos.
 */
export interface AuthMessageResponse {
  message?: string
  error?: string
}
