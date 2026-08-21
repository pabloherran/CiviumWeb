import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getIncidentById } from '../api/incidents'
import { AuthenticatedImage } from '../components/AuthenticatedImage'
import { StatusBadge } from '../components/StatusBadge'
import type { Incident } from '../types/incident'
import { CATEGORY_LABELS, formatDate } from '../utils/labels'

/**
 * Detalle de incidencia: SOLO lectura para MUNICIPAL_ADMIN/SUPER_ADMIN, los
 * únicos roles que acceden al portal. No se ofrece resolver/reabrir/borrar
 * incidencias aquí: esos roles son gestores, no operarios sobre el terreno
 * (esa acción sigue existiendo en la app Android para OPERATOR). Lo único
 * que tendrán, cuando se implemente, es asignar la incidencia a un operario.
 */
export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    getIncidentById(id)
      .then(setIncident)
      .catch(() => setError('No se ha podido cargar la incidencia.'))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <p className="hint">Cargando incidencia…</p>
  if (error && !incident) return <div className="form-error">{error}</div>
  if (!incident) return null

  return (
    <div>
      <button className="btn-link" onClick={() => navigate(-1)}>
        ← Volver
      </button>

      <div className="page-header">
        <h1>{incident.title}</h1>
        <StatusBadge status={incident.status} />
      </div>

      <div className="detail-grid">
        <section className="card">
          <h2>Detalle</h2>
          <dl className="definition-list">
            <dt>Categoría</dt>
            <dd>{CATEGORY_LABELS[incident.category]}</dd>
            <dt>Municipio</dt>
            <dd>{incident.municipalityId ?? '—'}</dd>
            <dt>Creada</dt>
            <dd>{formatDate(incident.createdAt)}</dd>
            <dt>Creada por</dt>
            <dd>{incident.createdBy}</dd>
            {incident.resolvedBy && (
              <>
                <dt>Resuelta por</dt>
                <dd>{incident.resolvedBy}</dd>
              </>
            )}
          </dl>
          <p className="detail-description">{incident.description}</p>
        </section>

        {(incident.latitude != null && incident.longitude != null) && (
          <section className="card">
            <h2>Ubicación</h2>
            <p className="hint">
              {incident.latitude?.toFixed(5)}, {incident.longitude?.toFixed(5)}
            </p>
            <Link className="btn-link" to={`/mapa?incidentId=${incident.id}`}>
              Ver en el mapa →
            </Link>
          </section>
        )}

        {incident.reportPhotoUrl && (
          <section className="card">
            <h2>Foto del reporte</h2>
            <AuthenticatedImage
              className="detail-photo"
              src={incident.reportPhotoUrl}
              alt="Foto del reporte"
            />
          </section>
        )}

        {incident.resolutionPhotoUrl && (
          <section className="card">
            <h2>Foto de resolución</h2>
            <AuthenticatedImage
              className="detail-photo"
              src={incident.resolutionPhotoUrl}
              alt="Foto de resolución"
            />
            {incident.resolutionNote && <p className="hint">{incident.resolutionNote}</p>}
          </section>
        )}

        <section className="card card-disabled">
          <h2>Asignación de trabajo</h2>
          <p className="hint">
            Próximamente: reparte esta incidencia entre tus operarios. Esta función está
            planificada para una fase posterior — requiere añadir un campo de asignación en el
            backend y soporte en la app móvil, que todavía no existen.
          </p>
        </section>
      </div>
    </div>
  )
}
