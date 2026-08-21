import { apiClient } from './client'
import type { AuthLoginRequest, AuthResponse } from '../types/auth'

export async function login(body: AuthLoginRequest): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('auth/login', body)
  return data
}
