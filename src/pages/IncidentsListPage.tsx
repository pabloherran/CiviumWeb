import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getIncidents } from '../api/incidents'
import { StatusBadge } from '../components/StatusBadge'
import type { Incident, IncidentCategory, IncidentStatus } from '../types/incident'
import { CATEGORY_LABELS, formatDate } from '../utils/labels'
import { useAuth } from '../context/AuthContext'

const STATUS_OPTIONS: Array<{ value: IncidentStatus | 'ALL'; label: string }> = [
  { value: 'OPEN', label: 'Abiertas' },
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

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getIncidents(statusFilter === 'ALL' ? undefined : statusFilter)
      .then((data) => {
        if (!cancelled) setItems(data)
      })
      .catch(() => {
        if (!cancelled) setError('No se han podido cargar las incidencias.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [statusFilter])

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
    <div>
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
                <td>{inc.municipalityId ?? '—'}</td>
                <td>{formatDate(inc.createdAt)}</td>
              </tr>
            ))}
            {visibleItems.length === 0 && (
              <tr>
                <td colSpan={5} className="table-empty">
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
