import { type FormEvent, useEffect, useRef, useState } from 'react'
import {
  createInvitation,
  deleteInvitation,
  deleteMunicipalityUsers,
  deleteUser,
  listInvitations,
  listUsers,
  setUserActive,
} from '../api/admin'
import { getProvinces, searchMunicipalities } from '../api/municipalities'
import { Modal } from '../components/Modal'
import { useAuth } from '../context/AuthContext'
import type { CreateInvitationRequest, Invitation, User, UserRole } from '../types/user'
import type { Municipality, Province } from '../types/municipality'
import { INVITATION_STATUS_LABELS, ROLE_LABELS, formatDate } from '../utils/labels'
import { getErrorMessage } from '../api/errors'

type Tab = 'users' | 'invitations'

export function UsersPage() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const [tab, setTab] = useState<Tab>('users')
  // Se incrementa para forzar la recarga del listado de usuarios desde
  // cualquier acción que lo afecte (borrado individual o baja de municipio).
  const [refreshToken, setRefreshToken] = useState(0)
  const bumpRefresh = () => setRefreshToken((v) => v + 1)

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>Usuarios</h1>
      </div>

      <div className="tabs">
        <button
          className={`tab${tab === 'users' ? ' tab-active' : ''}`}
          onClick={() => setTab('users')}
        >
          Operarios y administradores
        </button>
        <button
          className={`tab${tab === 'invitations' ? ' tab-active' : ''}`}
          onClick={() => setTab('invitations')}
        >
          Invitaciones
        </button>
      </div>

      {tab === 'users' ? (
        <>
          <UsersTable refreshToken={refreshToken} onChanged={bumpRefresh} />
          {isSuperAdmin && <MunicipalityOffboardPanel onDone={bumpRefresh} />}
        </>
      ) : (
        <InvitationsPanel isSuperAdmin={isSuperAdmin} />
      )}
    </div>
  )
}

function UsersTable({
  refreshToken,
  onChanged,
}: {
  refreshToken: number
  onChanged: () => void
}) {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [lastAdminInfo, setLastAdminInfo] = useState<{
    municipalityId: string
    orphanOperators: number
  } | null>(null)
  const [orphanedIncidents, setOrphanedIncidents] = useState<number | null>(null)
  const [offboardIne, setOffboardIne] = useState<string | null>(null)

  // Nombre de municipio resuelto a partir del código INE, igual que en el
  // listado de incidencias: se pide por provincia (2 primeros dígitos del
  // INE) y se cachea para no repetir peticiones ya hechas.
  const [municipalityNames, setMunicipalityNames] = useState<Record<string, string>>({})
  const loadedProvinces = useRef<Set<string>>(new Set())

  function reload() {
    setLoading(true)
    listUsers()
      .then(setUsers)
      .catch((err) => setError(getErrorMessage(err, 'No se han podido cargar los usuarios.')))
      .finally(() => setLoading(false))
  }

  useEffect(reload, [refreshToken])

  useEffect(() => {
    const provinceCodes = new Set(
      users
        .map((u) => u.municipalityId)
        .filter((id): id is string => !!id && id.length >= 2)
        .map((id) => id.slice(0, 2)),
    )
    const pending = [...provinceCodes].filter((code) => !loadedProvinces.current.has(code))
    if (pending.length === 0) return

    pending.forEach((code) => loadedProvinces.current.add(code))
    Promise.all(pending.map((code) => searchMunicipalities(code, '', 10000).catch(() => [])))
      .then((results) => {
        setMunicipalityNames((prev) => {
          const next = { ...prev }
          results.flat().forEach((m) => {
            next[m.ineCode] = m.nombre
          })
          return next
        })
      })
  }, [users])

  async function toggleActive(target: User) {
    try {
      await setUserActive(target.id, !target.active)
      reload()
    } catch (err) {
      setError(getErrorMessage(err, 'No se ha podido actualizar el estado del usuario.'))
    }
  }

  async function confirmDelete() {
    if (!userToDelete) return
    setDeleting(true)
    setError(null)
    try {
      const resp = await deleteUser(userToDelete.id)
      setUserToDelete(null)
      reload()
      const orphans = resp.orphanOperators ?? 0
      if (resp.remainingAdmins === 0 && orphans > 0 && resp.municipalityId) {
        setLastAdminInfo({ municipalityId: resp.municipalityId, orphanOperators: orphans })
      }
      if (resp.orphanedIncidents && resp.orphanedIncidents > 0) {
        setOrphanedIncidents(resp.orphanedIncidents)
      }
    } catch (err) {
      setError(getErrorMessage(err, 'No se ha podido eliminar el usuario.'))
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <p className="hint">Cargando usuarios…</p>

  return (
    <>
      {error && <div className="form-error">{error}</div>}

      <table className="table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Código INE</th>
            <th>Municipio</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{ROLE_LABELS[u.role]}</td>
              <td>{u.municipalityId ?? '—'}</td>
              <td>{u.municipalityId ? (municipalityNames[u.municipalityId] ?? '…') : '—'}</td>
              <td>
                <span className={`badge ${u.active ? 'badge-active' : 'badge-inactive'}`}>
                  {u.active ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td>
                <div className="row-actions">
                  <button className="btn-link" onClick={() => toggleActive(u)}>
                    {u.active ? 'Desactivar' : 'Activar'}
                  </button>
                  {u.id !== currentUser?.id && (
                    <button className="btn-link-danger" onClick={() => setUserToDelete(u)}>
                      Eliminar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={7} className="table-empty">
                Todavía no hay operarios ni administradores dados de alta.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {userToDelete && (
        <Modal
          title="Eliminar usuario"
          onClose={() => !deleting && setUserToDelete(null)}
          actions={
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setUserToDelete(null)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Eliminando…' : 'Eliminar'}
              </button>
            </>
          }
        >
          <p>
            Vas a eliminar a <strong>{userToDelete.name}</strong> ({userToDelete.email}). Perderá
            el acceso inmediatamente y esta acción no se puede deshacer. Sus incidencias se
            conservarán en el histórico.
          </p>
        </Modal>
      )}

      {lastAdminInfo && (
        <Modal
          title="Último administrador eliminado"
          onClose={() => setLastAdminInfo(null)}
          actions={
            <>
              <button className="btn btn-secondary" onClick={() => setLastAdminInfo(null)}>
                Ahora no
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setOffboardIne(lastAdminInfo.municipalityId)
                  setLastAdminInfo(null)
                }}
              >
                Dar de baja el municipio
              </button>
            </>
          }
        >
          <p>
            Era el último administrador del municipio <strong>{lastAdminInfo.municipalityId}</strong>.
            Quedan {lastAdminInfo.orphanOperators} operario(s) sin gestión. ¿Quieres dar de baja el
            municipio completo?
          </p>
        </Modal>
      )}

      {orphanedIncidents !== null && (
        <Modal
          title="Incidencias sin operario"
          onClose={() => setOrphanedIncidents(null)}
          actions={
            <button className="btn btn-primary" onClick={() => setOrphanedIncidents(null)}>
              Entendido
            </button>
          }
        >
          <p>
            El operario tenía <strong>{orphanedIncidents}</strong> incidencia(s) en resolución. Se
            conservan tal cual, pero han quedado sin nadie asignado: revísalas y reasígnalas cuanto
            antes.
          </p>
        </Modal>
      )}

      {offboardIne && (
        <MunicipalityOffboardConfirmModal
          ine={offboardIne}
          onClose={() => setOffboardIne(null)}
          onDone={() => {
            setOffboardIne(null)
            onChanged()
          }}
        />
      )}
    </>
  )
}

/**
 * Zona de peligro visible solo para SUPER_ADMIN: baja completa de un
 * municipio (todos sus operarios y administradores de golpe), pensada para
 * cuando un ayuntamiento se da de baja del servicio.
 */
function MunicipalityOffboardPanel({ onDone }: { onDone: () => void }) {
  const [provinces, setProvinces] = useState<Province[]>([])
  const [provinceCode, setProvinceCode] = useState('')
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Municipality[]>([])
  const [selected, setSelected] = useState<Municipality | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    getProvinces()
      .then(setProvinces)
      .catch(() => setProvinces([]))
  }, [])

  useEffect(() => {
    if (!provinceCode || query.trim().length < 2) {
      setSuggestions([])
      return
    }
    let cancelled = false
    setSearching(true)
    searchMunicipalities(provinceCode, query.trim())
      .then((res) => {
        if (!cancelled) setSuggestions(res)
      })
      .catch(() => {
        if (!cancelled) setSuggestions([])
      })
      .finally(() => {
        if (!cancelled) setSearching(false)
      })
    return () => {
      cancelled = true
    }
  }, [provinceCode, query])

  return (
    <div className="danger-zone">
      <h2>Dar de baja un municipio</h2>
      <p className="hint">
        Elimina de golpe a todos los operarios y administradores municipales de un ayuntamiento
        (por ejemplo, cuando deja de usar el servicio) junto con sus invitaciones pendientes. Las
        incidencias y los ciudadanos no se ven afectados. Esta acción no se puede deshacer.
      </p>

      <div className="filters-bar">
        <select
          className="select"
          value={provinceCode}
          onChange={(e) => {
            setProvinceCode(e.target.value)
            setQuery('')
            setSelected(null)
            setSuggestions([])
          }}
        >
          <option value="">Provincia…</option>
          {provinces.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>

        <input
          className="input"
          placeholder="Nombre del municipio…"
          value={query}
          disabled={!provinceCode}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(null)
          }}
        />
      </div>

      {searching && <p className="hint">Buscando…</p>}

      {!selected && suggestions.length > 0 && (
        <ul className="suggestion-list">
          {suggestions.map((m) => (
            <li key={m.ineCode}>
              <button className="btn-link" onClick={() => setSelected(m)}>
                {m.nombre} ({m.ineCode})
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <>
          <p>
            Municipio seleccionado: <strong>{selected.nombre}</strong> (INE {selected.ineCode})
          </p>
          <ConfirmOffboardButton municipality={selected} onDone={onDone} onCancel={() => setSelected(null)} />
        </>
      )}
    </div>
  )
}

function ConfirmOffboardButton({
  municipality,
  onDone,
  onCancel,
}: {
  municipality: Municipality
  onDone: () => void
  onCancel: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="row-actions">
        <button className="btn btn-danger" onClick={() => setOpen(true)}>
          Dar de baja este municipio
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>
          Elegir otro
        </button>
      </div>
      {open && (
        <MunicipalityOffboardConfirmModal
          ine={municipality.ineCode}
          municipalityName={municipality.nombre}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false)
            onDone()
          }}
        />
      )}
    </>
  )
}

/**
 * Confirmación final: hay que volver a escribir el código INE (el backend
 * exige que `confirmIne` coincida exactamente con el de la URL) antes de
 * poder pulsar el botón de confirmar.
 */
function MunicipalityOffboardConfirmModal({
  ine,
  municipalityName,
  onClose,
  onDone,
}: {
  ine: string
  municipalityName?: string
  onClose: () => void
  onDone: () => void
}) {
  const [typedIne, setTypedIne] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultCount, setResultCount] = useState<string | null>(null)

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      const resp = await deleteMunicipalityUsers(ine, typedIne.trim())
      setResultCount(resp.deletedUsers ?? '0')
    } catch {
      setError('No se ha podido completar la baja. Revisa que el código INE sea correcto.')
    } finally {
      setSubmitting(false)
    }
  }

  if (resultCount !== null) {
    return (
      <Modal
        title="Municipio dado de baja"
        onClose={() => {
          onDone()
        }}
        actions={
          <button
            className="btn btn-primary"
            onClick={() => {
              onDone()
            }}
          >
            Entendido
          </button>
        }
      >
        <p>
          Municipio {ine} dado de baja: {resultCount} usuario(s) eliminados.
        </p>
      </Modal>
    )
  }

  return (
    <Modal
      title="Dar de baja municipio"
      onClose={() => !submitting && onClose()}
      actions={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button
            className="btn btn-danger"
            onClick={handleConfirm}
            disabled={submitting || typedIne.trim() !== ine}
          >
            {submitting ? 'Eliminando…' : 'Confirmar baja'}
          </button>
        </>
      }
    >
      <p>
        Se eliminarán TODOS los administradores y operarios de{' '}
        {municipalityName ? (
          <>
            <strong>{municipalityName}</strong> (INE {ine})
          </>
        ) : (
          <>el municipio con código INE {ine}</>
        )}
        , junto con sus invitaciones pendientes. Esta acción no se puede deshacer.
      </p>
      <label className="field">
        <span>Para confirmar, escribe de nuevo el código INE ({ine})</span>
        <input value={typedIne} onChange={(e) => setTypedIne(e.target.value)} autoFocus />
      </label>
      {error && <div className="form-error">{error}</div>}
    </Modal>
  )
}

function InvitationsPanel({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [roleToGrant, setRoleToGrant] = useState<UserRole>('OPERATOR')
  const [municipalityId, setMunicipalityId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function reload() {
    setLoading(true)
    listInvitations()
      .then(setInvitations)
      .catch((err) => setError(getErrorMessage(err, 'No se han podido cargar las invitaciones.')))
      .finally(() => setLoading(false))
  }

  useEffect(reload, [])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const body: CreateInvitationRequest = { email }
      if (isSuperAdmin) {
        body.roleToGrant = roleToGrant
        body.municipalityId = municipalityId
      }
      await createInvitation(body)
      setEmail('')
      setMunicipalityId('')
      reload()
    } catch (err) {
      setError(getErrorMessage(err, 'No se ha podido crear la invitación. Revisa los datos.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRevoke(id: string) {
    try {
      await deleteInvitation(id)
      reload()
    } catch (err) {
      setError(getErrorMessage(err, 'No se ha podido revocar la invitación.'))
    }
  }

  return (
    <div>
      <form className="card inline-form" onSubmit={handleCreate}>
        <label className="field">
          <span>Email a invitar</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        {isSuperAdmin && (
          <>
            <label className="field">
              <span>Rol a otorgar</span>
              <select
                className="select"
                value={roleToGrant}
                onChange={(e) => setRoleToGrant(e.target.value as UserRole)}
              >
                <option value="OPERATOR">Operario</option>
                <option value="MUNICIPAL_ADMIN">Administrador municipal</option>
              </select>
            </label>
            <label className="field">
              <span>Código INE del municipio</span>
              <input
                value={municipalityId}
                onChange={(e) => setMunicipalityId(e.target.value)}
                required
              />
            </label>
          </>
        )}

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Enviando…' : 'Crear invitación'}
        </button>
      </form>

      {error && <div className="form-error">{error}</div>}

      {loading ? (
        <p className="hint">Cargando invitaciones…</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Rol</th>
              <th>Código</th>
              <th>Estado</th>
              <th>Caduca</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invitations.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.email}</td>
                <td>{ROLE_LABELS[inv.roleToGrant]}</td>
                <td>
                  <code>{inv.code}</code>
                </td>
                <td>{INVITATION_STATUS_LABELS[inv.status]}</td>
                <td>{formatDate(inv.expiresAt)}</td>
                <td>
                  {inv.status === 'PENDING' && (
                    <button className="btn-link" onClick={() => handleRevoke(inv.id)}>
                      Revocar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {invitations.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty">
                  No hay invitaciones todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
