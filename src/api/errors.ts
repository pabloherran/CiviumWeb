import { isAxiosError } from 'axios'

/**
 * Extrae un mensaje de error apto para el usuario final a partir de una
 * excepción capturada en una llamada a la API.
 *
 * Desde que el backend homogeneiza todas las respuestas de error a
 * `{"error": "..."}` (ver Application.kt del backend), axios ya trae ese
 * mensaje parseado en `err.response.data.error`. Si no está disponible —
 * sin conexión, backend caído, formato inesperado — se usa el `fallback`
 * pasado por quien llama, específico de cada pantalla/acción. Nunca se
 * muestra un código HTTP en crudo.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const backendMessage = err.response?.data?.error
    if (typeof backendMessage === 'string' && backendMessage.trim().length > 0) {
      return backendMessage
    }
    if (!err.response) {
      return 'No se ha podido conectar con el servidor. Comprueba tu conexión.'
    }
  }
  return fallback
}
