import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://api.civium.app/'

export const TOKEN_STORAGE_KEY = 'civium_portal_token'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Si el token caduca o es inválido, el backend responde 401: limpiamos la
// sesión local y forzamos vuelta al login. Evitamos hacerlo en la propia
// llamada de login (para poder mostrar "credenciales incorrectas").
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const url: string = error?.config?.url ?? ''
    if (status === 401 && !url.includes('auth/login')) {
      localStorage.removeItem(TOKEN_STORAGE_KEY)
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)
