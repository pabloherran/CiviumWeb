import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getIncidents } from '../api/incidents'
import { searchMunicipalities } from '../api/municipalities'
import { StatusBadge } from '../components/StatusBadge'
import type { Incident, IncidentCategory, IncidentStatus } from '../types/incident'
import { CATEGORY_LABELS, formatDate } from '../utils/labels'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../api/errors'

const STATUS_OPTIONS: Array<{ value: IncidentStatus | 'ALL'; label: string }> = [
  { value: 'OPEN', label: 'Abiertas' },
  { value: 'IN_PROGRESS', label: 'En resolución' },
  { value: 'RESOLVED', label: 'Resueltas' },
  { value: 'ALL', label: 'Todas' },
]

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as Array<[IncidentCategory, string]>

export function IncidentsListPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'ALL'>('OPEN')
  const [categoryFilter, setCategoryFilter] = useState<IncidentCategory | 'ALL'>('ALL')
  const [municipalityFilter, setMunicipalityFilter] = useState('')

  // Nombre de municipio resuelto a partir del código INE, para no mostrar solo
  // el código en la tabla. Se resuelve por provincia (2 primeros dígitos del
  // INE) y se cachea para no repetir peticiones ya hechas.
  const [municipalityNames, setMunicipalityNames] = useState<Record<string, string>>({})
  const loadedProvinces = useRef<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getIncidents(statusFilter === 'ALL' ? undefined : statusFilter)
      .then((data) => {
        if (!cancelled) setItems(data)
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'No se han podido cargar las incidencias.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [statusFilter])

  useEffect(() => {
    const provinceCodes = new Set(
      items
        .map((inc) => inc.municipalityId)
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
  }, [items])

  const visibleItems = useMemo(() => {
    return items.filter((inc) => {
      const matchesCategory = categoryFilter === 'ALL' || inc.category === categoryFilter
      const matchesMunicipality =
        !municipalityFilter ||
        (inc.municipalityId ?? '').toLowerCase().includes(municipalityFilter.toLowerCase())
      return matchesCategory && matchesMunicipality
    })
  }, [items, categoryFilter, municipalityFilter])

  return (
    <div className="incidents-page">
      <div className="page-header">
        <h1>Incidencias</h1>
        {user?.role === 'SUPER_ADMIN' && (
          <p className="page-subtitle">
            Viendo incidencias de todos los municipios. Filtra por código INE si lo necesitas.
          </p>
        )}
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`chip${statusFilter === opt.value ? ' chip-active' : ''}`}
              onClick={() => setStatusFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <select
          className="select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as IncidentCategory | 'ALL')}
        >
          <option value="ALL">Todas las categorías</option>
          {CATEGORY_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {user?.role === 'SUPER_ADMIN' && (
          <input
            className="input"
            placeholder="Código INE de municipio…"
            value={municipalityFilter}
            onChange={(e) => setMunicipalityFilter(e.target.value)}
          />
        )}
      </div>

      {loading && <p className="hint">Cargando incidencias…</p>}
      {error && <div className="form-error">{error}</div>}

      {!loading && !error && (
        <table className="table">
          <thead>
            <tr>
              <th>Título</th>
              <th>Categoría</th>
              <th>Estado</th>
              <th>Asignada a</th>
              <th>Código INE</th>
              <th>Municipio</th>
              <th>Creada</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((inc) => (
              <tr key={inc.id}>
                <td>
                  <Link className="table-link" to={`/incidencias/${inc.id}`}>
                    {inc.title}
                  </Link>
                </td>
                <td>{CATEGORY_LABELS[inc.category]}</td>
                <td>
                  <StatusBadge status={inc.status} />
                </td>
                <td>{inc.assignedToName ?? '—'}</td>
                <td>{inc.municipalityId ?? '—'}</td>
                <td>{inc.municipalityId ? (municipalityNames[inc.municipalityId] ?? '…') : '—'}</td>
                <td>{formatDate(inc.createdAt)}</td>
              </tr>
            ))}
            {visibleItems.length === 0 && (
              <tr>
                <td colSpan={7} className="table-empty">
                  No hay incidencias que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
