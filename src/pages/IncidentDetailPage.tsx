import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getIncidentById, setIncidentResolved } from '../api/incidents'
import { StatusBadge } from '../components/StatusBadge'
import type { Incident } from '../types/incident'
import { CATEGORY_LABELS, formatDate } from '../utils/labels'

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resolutionNote, setResolutionNote] = useState('')
  const [saving, setSaving] = useState(false)

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

  async function handleResolve() {
    if (!id) return
    if (resolutionNote.trim().length < 10) {
      setError('La nota de resolución debe tener al menos 10 caracteres.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await setIncidentResolved(id, { resolved: true, resolutionNote })
      setIncident(updated)
    } catch {
      setError('No se ha podido marcar la incidencia como resuelta.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReopen() {
    if (!id) return
    setSaving(true)
    setError(null)
    try {
      const updated = await setIncidentResolved(id, { resolved: false })
      setIncident(updated)
    } catch {
      setError('No se ha podido reabrir la incidencia.')
    } finally {
      setSaving(false)
    }
  }

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
            <img className="detail-photo" src={incident.reportPhotoUrl} alt="Foto del reporte" />
          </section>
        )}

        {incident.resolutionPhotoUrl && (
          <section className="card">
            <h2>Foto de resolución</h2>
            <img
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

        <section className="card">
          <h2>Gestión de estado</h2>
          {error && <div className="form-error">{error}</div>}
          {incident.status === 'OPEN' ? (
            <div className="resolve-form">
              <label className="field">
                <span>Nota de resolución (obligatoria, mín. 10 caracteres)</span>
                <textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  rows={4}
                />
              </label>
              <button className="btn btn-primary" onClick={handleResolve} disabled={saving}>
                {saving ? 'Guardando…' : 'Marcar como resuelta'}
              </button>
            </div>
          ) : (
            <button className="btn btn-secondary" onClick={handleReopen} disabled={saving}>
              {saving ? 'Guardando…' : 'Reabrir incidencia'}
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
