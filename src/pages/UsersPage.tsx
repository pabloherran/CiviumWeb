import { type FormEvent, useEffect, useState } from 'react'
import {
  createInvitation,
  deleteInvitation,
  listInvitations,
  listUsers,
  setUserActive,
} from '../api/admin'
import { useAuth } from '../context/AuthContext'
import type { CreateInvitationRequest, Invitation, User, UserRole } from '../types/user'
import { INVITATION_STATUS_LABELS, ROLE_LABELS, formatDate } from '../utils/labels'

type Tab = 'users' | 'invitations'

export function UsersPage() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const [tab, setTab] = useState<Tab>('users')

  return (
    <div>
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

      {tab === 'users' ? <UsersTable /> : <InvitationsPanel isSuperAdmin={isSuperAdmin} />}
    </div>
  )
}

function UsersTable() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function reload() {
    setLoading(true)
    listUsers()
      .then(setUsers)
      .catch(() => setError('No se han podido cargar los usuarios.'))
      .finally(() => setLoading(false))
  }

  useEffect(reload, [])

  async function toggleActive(target: User) {
    try {
      await setUserActive(target.id, !target.active)
      reload()
    } catch {
      setError('No se ha podido actualizar el estado del usuario.')
    }
  }

  if (loading) return <p className="hint">Cargando usuarios…</p>
  if (error) return <div className="form-error">{error}</div>

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Email</th>
          <th>Rol</th>
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
            <td>
              <span className={`badge ${u.active ? 'badge-open' : 'badge-resolved'}`}>
                {u.active ? 'Activo' : 'Inactivo'}
              </span>
            </td>
            <td>
              <button className="btn-link" onClick={() => toggleActive(u)}>
                {u.active ? 'Desactivar' : 'Activar'}
              </button>
            </td>
          </tr>
        ))}
        {users.length === 0 && (
          <tr>
            <td colSpan={6} className="table-empty">
              Todavía no hay operarios ni administradores dados de alta.
            </td>
          </tr>
        )}
      </tbody>
    </table>
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
      .catch(() => setError('No se han podido cargar las invitaciones.'))
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
    } catch {
      setError('No se ha podido crear la invitación. Revisa los datos.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRevoke(id: string) {
    try {
      await deleteInvitation(id)
      reload()
    } catch {
      setError('No se ha podido revocar la invitación.')
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
