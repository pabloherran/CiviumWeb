import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listUsers } from '../api/admin'
import {
  assignIncident,
  deleteIncident,
  getIncidentById,
  setIncidentResolved,
  unassignIncident,
} from '../api/incidents'
import { AuthenticatedImage } from '../components/AuthenticatedImage'
import { Modal } from '../components/Modal'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import type { Incident } from '../types/incident'
import type { User } from '../types/user'
import { CATEGORY_LABELS, formatDate } from '../utils/labels'
import { getErrorMessage } from '../api/errors'

/**
 * Detalle de incidencia: SOLO lectura para MUNICIPAL_ADMIN/SUPER_ADMIN, los
 * únicos roles que acceden al portal, salvo estas acciones sobre el
 * estado: asignar/reasignar/quitar operario, reabrir una incidencia ya
 * resuelta, y eliminarla (SUPER_ADMIN en cualquier estado; MUNICIPAL_ADMIN
 * solo si está resuelta — el backend es quien impone esta regla, aquí solo
 * se oculta el botón cuando no aplica). No se ofrece resolver: eso sigue
 * siendo cosa del operario sobre el terreno, en la app Android.
 *
 * Layout: columna izquierda fija (sticky) con todo lo administrativo —
 * estado, detalle, ubicación, gestión y zona de peligro, de lo más seguro
 * a lo más irreversible — y columna derecha con el reporte del ciudadano y
 * la resolución, cada uno en su propia tarjeta con su foto. Las fotos las
 * hace un móvil en vertical (3:4, 9:16, 9:21... según el modelo), así que
 * ninguna tarjeta fuerza una proporción: la imagen conserva su alto
 * natural (ver `.detail-photo` en index.css).
 */
export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  // El backend es quien impone la regla real (SUPER_ADMIN cualquier
  // estado, MUNICIPAL_ADMIN solo resueltas y de su propio municipio); esto
  // es solo para no mostrar un botón que el servidor rechazaría.
  const canDelete =
    user?.role === 'SUPER_ADMIN' ||
    (user?.role === 'MUNICIPAL_ADMIN' && incident.status === 'RESOLVED')

  async function handleDelete() {
    if (!incident) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteIncident(incident.id)
      // Volver atrás (mismo patrón que el botón "← Volver" de esta pantalla)
      // en vez de navegar a "/incidencias" a secas: como el listado guarda
      // sus filtros en la URL, esto te devuelve exactamente a la pestaña de
      // estado y al filtro de INE/categorías que tenías antes de entrar.
      navigate(-1)
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'No se ha podido eliminar la incidencia.'))
      setDeleting(false)
    }
  }

  return (
    <div className="incident-detail">
      <button className="btn-link" onClick={() => navigate(-1)}>
        ← Volver
      </button>

      <div className="page-header">
        <h1>{incident.title}</h1>
      </div>

      <div className="detail-layout">
        <div
          className={
            incident.resolutionNote ? 'detail-photos' : 'detail-photos detail-photos--single'
          }
        >
          <section className="card photo-card">
            <h2>Reporte del ciudadano</h2>
            {incident.reportPhotoUrl && (
              <AuthenticatedImage
                className="detail-photo"
                src={incident.reportPhotoUrl}
                alt="Foto del reporte"
              />
            )}
            <p className="detail-description">{incident.description}</p>
          </section>

          {incident.resolutionNote && (
            <section className="card photo-card resolution-card">
              <h2>✓ Resolución</h2>
              {incident.resolutionPhotoUrl && (
                <AuthenticatedImage
                  className="detail-photo"
                  src={incident.resolutionPhotoUrl}
                  alt="Foto de resolución"
                />
              )}
              <p className="detail-description">{incident.resolutionNote}</p>
            </section>
          )}
        </div>

        <aside className="detail-sidebar">
          <section className="card status-card">
            <StatusBadge status={incident.status} />
          </section>

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

          <AssignmentPanel incident={incident} onChanged={setIncident} />

          {canDelete && (
            <section className="danger-zone">
              <h2>Eliminar incidencia</h2>
              <p className="hint">
                Esta acción no se puede deshacer: la incidencia y sus fotos se eliminarán
                permanentemente.
              </p>
              {deleteError && <div className="form-error">{deleteError}</div>}
              <div className="row-actions">
                <button
                  className="btn-link-danger"
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleting}
                >
                  Eliminar incidencia
                </button>
              </div>

              {confirmDelete && (
                <Modal
                  title="Eliminar incidencia"
                  onClose={() => !deleting && setConfirmDelete(false)}
                  actions={
                    <>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setConfirmDelete(false)}
                        disabled={deleting}
                      >
                        Cancelar
                      </button>
                      <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                        {deleting ? 'Eliminando…' : 'Eliminar definitivamente'}
                      </button>
                    </>
                  }
                >
                  <p>
                    Vas a eliminar <strong>{incident.title}</strong> de forma permanente. Esta
                    acción no se puede deshacer.
                  </p>
                </Modal>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

/**
 * Asignar/reasignar/quitar operario mientras la incidencia sigue abierta o
 * en resolución. Al asignar, pasa a "En resolución" (backend); al quitar
 * la asignación, vuelve a "Abierta".
 *
 * Una vez RESUELTA, esta misma tarjeta cambia de función: ya no se puede
 * tocar la asignación, pero un MUNICIPAL_ADMIN/SUPER_ADMIN puede reabrirla
 * (p. ej. si el operario que la resolvió ya no está disponible y hace
 * falta revisarla de nuevo). El backend decide el estado destino según si
 * la incidencia conserva operario asignado: con operario -> "En
 * resolución" (sigue en su cola); sin operario -> "Abierta". Mismo
 * criterio que ya usa la app Android (IncidentDetailScreen.kt).
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
  const [confirmReopen, setConfirmReopen] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [reopenError, setReopenError] = useState<string | null>(null)

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

  async function handleReopen() {
    setReopening(true)
    setReopenError(null)
    try {
      const updated = await setIncidentResolved(incident.id, { resolved: false })
      onChanged(updated)
      setConfirmReopen(false)
    } catch (err) {
      setReopenError(getErrorMessage(err, 'No se ha podido reabrir la incidencia.'))
    } finally {
      setReopening(false)
    }
  }

  if (incident.status === 'RESOLVED') {
    return (
      <section className="card">
        <h2>Asignación de trabajo</h2>
        <p className="hint">
          Esta incidencia está resuelta
          {incident.assignedToName ? (
            <>
              {' '}
              — la resolvió <strong>{incident.assignedToName}</strong>
            </>
          ) : null}
          . No se puede reasignar mientras siga resuelta.
        </p>

        {reopenError && <div className="form-error">{reopenError}</div>}

        <div className="row-actions">
          <button className="btn-link" onClick={() => setConfirmReopen(true)}>
            Reabrir incidencia
          </button>
        </div>

        {confirmReopen && (
          <Modal
            title="Reabrir incidencia"
            onClose={() => !reopening && setConfirmReopen(false)}
            actions={
              <>
                <button
                  className="btn btn-secondary"
                  onClick={() => setConfirmReopen(false)}
                  disabled={reopening}
                >
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleReopen} disabled={reopening}>
                  {reopening ? 'Reabriendo…' : 'Reabrir'}
                </button>
              </>
            }
          >
            <p>
              La incidencia volverá a estado{' '}
              {incident.assignedTo ? (
                <>
                  <strong>En resolución</strong>, con el mismo operario asignado
                </>
              ) : (
                <strong>Abierta</strong>
              )}
              . Se perderán la foto y la nota de resolución.
            </p>
          </Modal>
        )}
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
