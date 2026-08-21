import { useEffect, useState } from 'react'
import { apiClient } from '../api/client'

interface AuthenticatedImageProps {
  /** Ruta relativa que devuelve el backend, p. ej. "/uploads/{id}/123.jpg". */
  src: string
  alt: string
  className?: string
}

/**
 * <img> para fotos de incidencias.
 *
 * El endpoint /uploads/... exige JWT (misma razón por la que la app Android
 * no usa un simple <img>/AsyncImage con la URL a pelo, sino que descarga el
 * bitmap a mano añadiendo "Authorization: Bearer ..." — ver
 * loadBitmapWithAuth en IncidentDetailScreen.kt). Un <img src="..."> del
 * navegador no puede mandar cabeceras, así que pedimos el binario con axios
 * (que ya añade el token vía interceptor) y lo mostramos como blob: URL.
 */
export function AuthenticatedImage({ src, alt, className }: AuthenticatedImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    let currentUrl: string | null = null
    setError(false)
    setObjectUrl(null)

    apiClient
      .get(src, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return
        currentUrl = URL.createObjectURL(res.data)
        setObjectUrl(currentUrl)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })

    return () => {
      cancelled = true
      if (currentUrl) URL.revokeObjectURL(currentUrl)
    }
  }, [src])

  if (error) return <p className="hint">No se ha podido cargar la foto.</p>
  if (!objectUrl) return <p className="hint">Cargando foto…</p>

  return <img className={className} src={objectUrl} alt={alt} />
}
