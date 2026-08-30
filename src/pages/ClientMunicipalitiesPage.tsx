import { useEffect, useRef, useState } from 'react'
import { deleteMunicipalityUsers, getClientMunicipalities } from '../api/admin'
import { searchMunicipalities } from '../api/municipalities'
import { getErrorMessage } from '../api/errors'
import { Modal } from '../components/Modal'
import { useAuth } from '../context/AuthContext'

/**
 * Solo SUPER_ADMIN: municipios que tienen al menos un MUNICIPAL_ADMIN
 * activo ahora mismo ("son cliente" de Civium). Sin tabla ni flag propios
 * en el backend — se calcula al vuelo contra la tabla de usuarios, así que
 * este listado siempre refleja el estado real, alta o baja incluida.
 *
 * El guardia de rol de aquí abajo es defensa en profundidad: el enlace del
 * sidebar ya solo se muestra a SUPER_ADMIN, y el backend rechaza la
 * petición igualmente si alguien llega aquí sin ese rol.
 */
export function ClientMunicipalitiesPage() {
  const { user } = useAuth()

  const [ineCodes, setIneCodes] = useState<string[]>([])
  const [municipalityNames, setMunicipalityNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [offboardTarget, setOffboardTarget] = useState<string | null>(null)
  const loadedProvinces = useRef<Set<string>>(new Set())

  function load() {
    setLoading(true)
    getClientMunicipalities()
      .then(setIneCodes)
      .catch((err) => setError(getErrorMessage(err, 'No se ha podido cargar el listado de municipios.')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  // Resuelve INE -> nombre agrupando por provincia, mismo patrón que
  // IncidentsListPage/UsersPage: se pide el listado completo de cada
  // provincia una vez y se cachea, en vez de pedir municipio a municipio.
  useEffect(() => {
    const provinceCodes = new Set(
      ineCodes.filter((id) => id.length >= 2).map((id) => id.slice(0, 2)),
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
  }, [ineCodes])

  if (user?.role !== 'SUPER_ADMIN') {
    return <p className="hint">No tienes acceso a esta sección.</p>
  }

  return (
    <div className="client-municipalities-page">
      <div className="page-header">
        <h1>Municipios cliente</h1>
        <p className="page-subtitle">
          Ayuntamientos con al menos un administrador municipal activo ahora mismo.
        </p>
      </div>

      {loading && <p className="hint">Cargando municipios…</p>}
      {error && <div className="form-error">{error}</div>}

      {!loading && !error && (
        <table className="table">
          <thead>
            <tr>
              <th>Código INE</th>
              <th>Municipio</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ineCodes.map((ine) => (
              <tr key={ine}>
                <td>{ine}</td>
                <td>{municipalityNames[ine] ?? '…'}</td>
                <td>
                  <button className="btn-link-danger" onClick={() => setOffboardTarget(ine)}>
                    Dar de baja
                  </button>
                </td>
              </tr>
            ))}
            {ineCodes.length === 0 && (
              <tr>
                <td colSpan={3} className="table-empty">
                  Todavía no hay ningún municipio cliente.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {offboardTarget && (
        <ClientMunicipalityOffboardModal
          ine={offboardTarget}
          municipalityName={municipalityNames[offboardTarget]}
          onClose={() => setOffboardTarget(null)}
          onDone={() => {
            setOffboardTarget(null)
            load()
          }}
        />
      )}
    </div>
  )
}

/**
 * Confirmación de baja completa de un municipio, reutilizando el MISMO
 * endpoint que ya usa la página de Usuarios
 * (DELETE admin/municipalities/{ine}/users vía deleteMunicipalityUsers) —
 * no hay lógica nueva en el backend, solo un punto de entrada más.
 *
 * Es una acción muy contundente (borra de golpe todos los administradores
 * y operarios del municipio) así que exige, igual que en Usuarios, volver
 * a escribir el código INE como doble confirmación antes de poder pulsar
 * "Confirmar baja" — el backend además valida que `confirmIne` coincida
 * exactamente con `ine`, así que no basta con manipular el DOM.
 */
function ClientMunicipalityOffboardModal({
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
        onClose={onDone}
        actions={
          <button className="btn btn-primary" onClick={onDone}>
            Entendido
          </button>
        }
      >
        <p>
          Municipio {ine} dado de baja: {resultCount} usuario(s) eliminados. Dejará de aparecer en
          este listado.
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
        , junto con sus invitaciones pendientes. Las incidencias y los ciudadanos no se ven
        afectados. Esta acción no se puede deshacer.
      </p>
      <p>
        Para confirmar, escribe de nuevo el código INE (<strong>{ine}</strong>):
      </p>
      {error && <div className="form-error">{error}</div>}
      <input
        className="input"
        value={typedIne}
        onChange={(e) => setTypedIne(e.target.value)}
        placeholder={ine}
        disabled={submitting}
      />
    </Modal>
  )
}
