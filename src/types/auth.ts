import type { User } from './user'

export interface AuthLoginRequest {
  email: string
  password: string
}

export interface AuthResponse {
  user: User
  token: string
}
