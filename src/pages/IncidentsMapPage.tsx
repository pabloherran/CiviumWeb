import { GoogleMap, InfoWindowF, MarkerF, useJsApiLoader } from '@react-google-maps/api'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getIncidents } from '../api/incidents'
import type { Incident } from '../types/incident'
import { CATEGORY_LABELS } from '../utils/labels'

const containerStyle = { width: '100%', height: '100%' }
const SPAIN_CENTER = { lat: 40.4168, lng: -3.7038 }

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''

export function IncidentsMapPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlightedId = searchParams.get('incidentId')

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'civium-google-map',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  })

  const [items, setItems] = useState<Incident[]>([])
  const [selected, setSelected] = useState<Incident | null>(null)

  useEffect(() => {
    getIncidents('OPEN').then(setItems).catch(() => setItems([]))
  }, [])

  const markers = useMemo(
    () => items.filter((inc) => inc.latitude != null && inc.longitude != null),
    [items],
  )

  const center = useMemo(() => {
    const highlighted = markers.find((m) => m.id === highlightedId)
    if (highlighted) return { lat: highlighted.latitude!, lng: highlighted.longitude! }
    if (markers.length > 0) {
      const avgLat = markers.reduce((sum, m) => sum + (m.latitude ?? 0), 0) / markers.length
      const avgLng = markers.reduce((sum, m) => sum + (m.longitude ?? 0), 0) / markers.length
      return { lat: avgLat, lng: avgLng }
    }
    return SPAIN_CENTER
  }, [markers, highlightedId])

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="card card-disabled">
        <h2>Mapa no disponible</h2>
        <p className="hint">
          Falta configurar <code>VITE_GOOGLE_MAPS_API_KEY</code> en el archivo <code>.env</code>{' '}
          para poder mostrar el mapa. Consulta el README del proyecto.
        </p>
      </div>
    )
  }

  if (loadError) return <div className="form-error">No se ha podido cargar Google Maps.</div>
  if (!isLoaded) return <p className="hint">Cargando mapa…</p>

  return (
    <div className="map-page">
      <div className="page-header">
        <h1>Mapa de incidencias abiertas</h1>
        <p className="page-subtitle">{markers.length} incidencias con ubicación</p>
      </div>
      <div className="map-container">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={markers.length > 0 ? 12 : 5.5}
        >
          {markers.map((inc) => (
            <MarkerF
              key={inc.id}
              position={{ lat: inc.latitude!, lng: inc.longitude! }}
              onClick={() => setSelected(inc)}
            />
          ))}

          {selected && (
            <InfoWindowF
              position={{ lat: selected.latitude!, lng: selected.longitude! }}
              onCloseClick={() => setSelected(null)}
            >
              <div className="map-info-window">
                <strong>{selected.title}</strong>
                <div>{CATEGORY_LABELS[selected.category]}</div>
                <button
                  className="btn-link"
                  onClick={() => navigate(`/incidencias/${selected.id}`)}
                >
                  Ver detalle →
                </button>
              </div>
            </InfoWindowF>
          )}
        </GoogleMap>
      </div>
    </div>
  )
}
