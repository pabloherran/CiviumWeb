import { GoogleMap, InfoWindowF, MarkerF, useJsApiLoader } from '@react-google-maps/api'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getIncidents } from '../api/incidents'
import type { Incident, IncidentStatus } from '../types/incident'
import { CATEGORY_LABELS, STATUS_LABELS } from '../utils/labels'

const containerStyle = { width: '100%', height: '100%' }
const SPAIN_CENTER = { lat: 40.4168, lng: -3.7038 }

/**
 * El mapa muestra incidencias activas (abiertas + en resolución) — las
 * resueltas se descartan en el cliente (ver useEffect más abajo). Con dos
 * estados mezclados en el mismo mapa, cada uno lleva un color de marcador
 * distinto para no confundirlos (mismo criterio que StatusBadge en el
 * listado: ámbar para abierta, azul para en resolución).
 */
const MARKER_ICONS: Partial<Record<IncidentStatus, string>> = {
  OPEN: 'https://maps.google.com/mapfiles/ms/icons/orange-dot.png',
  IN_PROGRESS: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
}

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
    // Se guarda la lista completa tal cual (sin descartar resueltas aquí):
    // el filtro de "solo activas" se aplica más abajo, solo para decidir
    // qué marcadores normales se pintan — así la incidencia que venga de
    // ?incidentId= se puede seguir encontrando aunque esté resuelta.
    getIncidents()
      .then(setItems)
      .catch(() => setItems([]))
  }, [])

  // Marcadores "normales": incidencias activas (abiertas + en resolución),
  // igual que antes. Las resueltas no se pintan aquí como puntos de color.
  const markers = useMemo(
    () =>
      items.filter(
        (inc) => inc.status !== 'RESOLVED' && inc.latitude != null && inc.longitude != null,
      ),
    [items],
  )

  // La incidencia concreta que trae la URL (?incidentId=), sea cual sea su
  // estado — se busca en la lista completa, no en `markers`, precisamente
  // para que una incidencia resuelta también se encuentre.
  const highlighted = useMemo(
    () =>
      items.find(
        (inc) => inc.id === highlightedId && inc.latitude != null && inc.longitude != null,
      ) ?? null,
    [items, highlightedId],
  )

  // Si la incidencia destacada también está en `markers` (activa), se
  // quita de ahí para no pintar dos pines superpuestos en el mismo punto.
  const regularMarkers = useMemo(
    () => markers.filter((m) => m.id !== highlighted?.id),
    [markers, highlighted],
  )

  const center = useMemo(() => {
    if (highlighted) return { lat: highlighted.latitude!, lng: highlighted.longitude! }
    if (markers.length > 0) {
      const avgLat = markers.reduce((sum, m) => sum + (m.latitude ?? 0), 0) / markers.length
      const avgLng = markers.reduce((sum, m) => sum + (m.longitude ?? 0), 0) / markers.length
      return { lat: avgLat, lng: avgLng }
    }
    return SPAIN_CENTER
  }, [markers, highlighted])

  // Zoom cercano (16, mismo nivel que ya usa Android para un único punto)
  // cuando venimos a ver una incidencia concreta; si no, el criterio de
  // siempre según cuántas incidencias activas hay.
  const zoom = highlighted ? 16 : markers.length > 0 ? 12 : 5.5

  // Abre automáticamente su ventana de información al llegar, para
  // confirmar de un vistazo que es la incidencia correcta.
  useEffect(() => {
    if (highlighted) setSelected(highlighted)
  }, [highlighted])

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
        <h1>Mapa de incidencias activas</h1>
        <p className="page-subtitle">{markers.length} incidencias con ubicación</p>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '4px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#f5a623',
                display: 'inline-block',
              }}
            />
            Abierta
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#4a90d9',
                display: 'inline-block',
              }}
            />
            En resolución
          </span>
        </div>
      </div>
      <div className="map-container">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={zoom}
        >
          {regularMarkers.map((inc) => (
            <MarkerF
              key={inc.id}
              position={{ lat: inc.latitude!, lng: inc.longitude! }}
              icon={MARKER_ICONS[inc.status]}
              onClick={() => setSelected(inc)}
            />
          ))}

          {highlighted && (
            // Sin `icon`: el pin rojo grande por defecto de Google, para
            // que se distinga a simple vista de los puntos de color del
            // resto — es "la incidencia a la que has venido a ver".
            <MarkerF
              key={highlighted.id}
              position={{ lat: highlighted.latitude!, lng: highlighted.longitude! }}
              zIndex={999}
              onClick={() => setSelected(highlighted)}
            />
          )}

          {selected && (
            <InfoWindowF
              position={{ lat: selected.latitude!, lng: selected.longitude! }}
              onCloseClick={() => setSelected(null)}
            >
              <div className="map-info-window">
                <strong>{selected.title}</strong>
                <div>{CATEGORY_LABELS[selected.category]}</div>
                <div>{STATUS_LABELS[selected.status]}</div>
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
