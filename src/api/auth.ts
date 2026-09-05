import { apiClient } from './client'
import type {
  AuthLoginRequest,
  AuthMessageResponse,
  AuthRegisterRequest,
  AuthResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '../types/auth'

export async function login(body: AuthLoginRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('auth/login', body)
  return data
}

/**
 * Registro público. El rol lo decide siempre el backend a partir del
 * código de invitación: sin código -> CITIZEN; con código válido -> el rol
 * de la invitación (OPERATOR / MUNICIPAL_ADMIN / SUPER_ADMIN). Usado por
 * AcceptInvitationPage para dar de alta a administradores invitados.
 */
export async function register(body: AuthRegisterRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('auth/register', body)
  return data
}

/** Paso 1 de recuperación de contraseña: solicita el código por email. */
export async function forgotPassword(body: ForgotPasswordRequest): Promise<AuthMessageResponse> {
  const { data } = await apiClient.post<AuthMessageResponse>('auth/forgot-password', body)
  return data
}

/** Paso 2 de recuperación de contraseña: cambia la contraseña con el código recibido. */
export async function resetPassword(body: ResetPasswordRequest): Promise<AuthMessageResponse> {
  const { data } = await apiClient.post<AuthMessageResponse>('auth/reset-password', body)
  return data
}
