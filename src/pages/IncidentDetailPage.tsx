import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listUsers } from '../api/admin'
import { assignIncident, getIncidentById, unassignIncident } from '../api/incidents'
import { AuthenticatedImage } from '../components/AuthenticatedImage'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import type { Incident } from '../types/incident'
import type { User } from '../types/user'
import { CATEGORY_LABELS, formatDate } from '../utils/labels'
import { getErrorMessage } from '../api/errors'

/**
 * Detalle de incidencia: SOLO lectura para MUNICIPAL_ADMIN/SUPER_ADMIN, los
 * únicos roles que acceden al portal, salvo la asignación de trabajo (su
 * única acción sobre el estado). No se ofrece resolver/reabrir/borrar
 * incidencias aquí: esos roles son gestores, no operarios sobre el terreno
 * (esa acción sigue existiendo en la app Android, y solo para el operario
 * al que se le haya asignado la incidencia).
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
      .catch((err) => setError(getErrorMessage(err, 'No se ha podido cargar la incidencia.')))
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
            {incident.assignedToName && (
              <>
                <dt>Asignada a</dt>
                <dd>{incident.assignedToName}</dd>
              </>
            )}
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

        <AssignmentPanel incident={incident} onChanged={setIncident} />
      </div>
    </div>
  )
}

/**
 * Asignar/reasignar/quitar operario. Al asignar, la incidencia pasa a
 * "En resolución" (backend); al quitar la asignación, vuelve a "Abierta".
 * Una vez resuelta, ya no se puede tocar la asignación.
 */
function AssignmentPanel({
  incident,
  onChanged,
}: {
  incident: Incident
  onChanged: (updated: Incident) => void
}) {
  const [operators, setOperators] = useState<User[]>([])
  const [loadingOperators, setLoadingOperators] = useState(true)
  const [selected, setSelected] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmUnassign, setConfirmUnassign] = useState(false)

  useEffect(() => {
    setLoadingOperators(true)
    listUsers(incident.municipalityId ?? undefined)
      .then((users) => setOperators(users.filter((u) => u.role === 'OPERATOR' && u.active)))
      .catch((err) => setError(getErrorMessage(err, 'No se han podido cargar los operarios de este municipio.')))
      .finally(() => setLoadingOperators(false))
  }, [incident.municipalityId])

  async function handleAssign() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const updated = await assignIncident(incident.id, selected)
      onChanged(updated)
      setSelected('')
    } catch (err) {
      setError(getErrorMessage(err, 'No se ha podido asignar la incidencia.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleUnassign() {
    setSaving(true)
    setError(null)
    try {
      const updated = await unassignIncident(incident.id)
      onChanged(updated)
      setConfirmUnassign(false)
    } catch (err) {
      setError(getErrorMessage(err, 'No se ha podido quitar la asignación.'))
    } finally {
      setSaving(false)
    }
  }

  if (incident.status === 'RESOLVED') {
    return (
      <section className="card card-disabled">
        <h2>Asignación de trabajo</h2>
        <p className="hint">Esta incidencia ya está resuelta; no se puede reasignar.</p>
      </section>
    )
  }

  const availableOperators = operators.filter((op) => op.id !== incident.assignedTo)

  return (
    <section className="card">
      <h2>Asignación de trabajo</h2>
      {error && <div className="form-error">{error}</div>}

      {incident.assignedTo ? (
        <>
          <p>
            Asignada a <strong>{incident.assignedToName ?? incident.assignedTo}</strong>.
          </p>
          <div className="row-actions">
            <button
              className="btn-link-danger"
              onClick={() => setConfirmUnassign(true)}
              disabled={saving}
            >
              Quitar asignación
            </button>
          </div>
        </>
      ) : (
        <p className="hint">Todavía no tiene operario asignado.</p>
      )}

      {loadingOperators ? (
        <p className="hint">Cargando operarios…</p>
      ) : operators.length === 0 ? (
        <p className="hint">No hay operarios activos en este municipio.</p>
      ) : (
        <div className="inline-form">
          <label className="field">
            <span>{incident.assignedTo ? 'Reasignar a' : 'Asignar a'}</span>
            <select
              className="select"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Selecciona un operario…</option>
              {availableOperators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" onClick={handleAssign} disabled={!selected || saving}>
            {saving ? 'Guardando…' : incident.assignedTo ? 'Reasignar' : 'Asignar'}
          </button>
        </div>
      )}

      {confirmUnassign && (
        <Modal
          title="Quitar asignación"
          onClose={() => !saving && setConfirmUnassign(false)}
          actions={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmUnassign(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={handleUnassign} disabled={saving}>
                {saving ? 'Quitando…' : 'Quitar asignación'}
              </button>
            </>
          }
        >
          <p>
            La incidencia volverá a estado <strong>Abierta</strong> y dejará de estar asignada a{' '}
            {incident.assignedToName ?? 'este operario'}.
          </p>
        </Modal>
      )}
    </section>
  )
}
