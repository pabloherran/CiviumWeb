import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { exportStatisticsPdf, getStatistics } from '../api/statistics'
import { getClientMunicipalities } from '../api/admin'
import { searchMunicipalities } from '../api/municipalities'
import { useAuth } from '../context/AuthContext'
import { getErrorMessage } from '../api/errors'
import type { IncidentCategory, IncidentStatus } from '../types/incident'
import type {
  CategoryCount,
  OperatorRanking,
  PeriodCount,
  StatsGranularity,
  Statistics,
  StatusCount,
} from '../types/statistics'
import { CATEGORY_LABELS, STATUS_LABELS } from '../utils/labels'


const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as Array<[IncidentCategory, string]>
const STATUS_OPTIONS = Object.entries(STATUS_LABELS) as Array<[IncidentStatus, string]>

const GRANULARITY_OPTIONS: Array<{ value: StatsGranularity; label: string }> = [
  { value: 'MONTHLY', label: 'Mensual' },
  { value: 'QUARTERLY', label: 'Trimestral' },
  { value: 'SEMIANNUAL', label: 'Semestral' },
  { value: 'YEARLY', label: 'Anual' },
]

const STATUS_ORDER: IncidentStatus[] = ['RESOLVED', 'IN_PROGRESS', 'OPEN']
const STATUS_COLORS: Record<IncidentStatus, string> = {
  RESOLVED: '#166534',
  IN_PROGRESS: '#1d4ed8',
  OPEN: '#b45309',
}

/**
 * Filtros combinables (categorías, estados, municipios) + granularidad del
 * gráfico de periodo, todos en la URL (?categorias=&estados=&municipios=&
 * granularidad=), mismo patrón que IncidentsListPage: sobreviven a recargar
 * la página y se pueden compartir con el ayuntamiento tal cual.
 *
 * No hay filtro de rango de fechas en esta v1: los KPIs y los desgloses por
 * categoría/estado reflejan todo el histórico que cumple los filtros. La
 * granularidad solo cambia el tamaño de los "cubos" del gráfico de
 * resueltas por periodo.
 */
export function StatisticsPage() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const [searchParams, setSearchParams] = useSearchParams()

  const categories = useMemo(
    () =>
      new Set<IncidentCategory>(
        (searchParams.get('categorias')?.split(',').filter(Boolean) as IncidentCategory[]) ?? [],
      ),
    [searchParams],
  )
  const statuses = useMemo(
    () =>
      new Set<IncidentStatus>(
        (searchParams.get('estados')?.split(',').filter(Boolean) as IncidentStatus[]) ?? [],
      ),
    [searchParams],
  )
  const municipios = useMemo(
    () => new Set<string>(searchParams.get('municipios')?.split(',').filter(Boolean) ?? []),
    [searchParams],
  )
  const granularity = (searchParams.get('granularidad') as StatsGranularity | null) ?? 'QUARTERLY'

  /** Actualiza uno o varios filtros en la URL sin apilar historial (replace). */
  function updateFilters(patch: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        Object.entries(patch).forEach(([key, value]) => {
          if (!value) next.delete(key)
          else next.set(key, value)
        })
        return next
      },
      { replace: true },
    )
  }

  function clearAllFilters() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('categorias')
        next.delete('estados')
        next.delete('municipios')
        return next
      },
      { replace: true },
    )
  }

  const [stats, setStats] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // Debounce: varios filtros marcados seguidos (p. ej. 4-5 categorías en el
    // multiselect) no deben disparar una petición por cada clic — cada una
    // hace un listAll() completo en el backend cuando no hay municipio
    // filtrado. Se espera 300ms de silencio antes de llamar a la API; si el
    // usuario sigue cambiando filtros, el timer anterior se cancela.
    const timer = setTimeout(() => {
      setLoading(true)
      setError(null)
      getStatistics({
        categories: categories.size > 0 ? Array.from(categories) : undefined,
        statuses: statuses.size > 0 ? Array.from(statuses) : undefined,
        municipalityIds: isSuperAdmin && municipios.size > 0 ? Array.from(municipios) : undefined,
        granularity,
      })
        .then((data) => {
          if (!cancelled) setStats(data)
        })
        .catch((err) => {
          if (!cancelled) setError(getErrorMessage(err, 'No se han podido cargar las estadísticas.'))
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, statuses, municipios, granularity, isSuperAdmin])

  // Mismo patrón que handleExportPdf en IncidentDetailPage.tsx: pide el
  // blob ya generado por el backend y lo descarga en el navegador. Usa los
  // mismos filtros que el fetch de arriba (categorías/estados/municipios
  // activos) — el backend recalcula el rango de fechas según `granularity`.
  async function handleExportPdf() {
    setExportingPdf(true)
    setExportError(null)
    try {
      const blob = await exportStatisticsPdf({
        categories: categories.size > 0 ? Array.from(categories) : undefined,
        statuses: statuses.size > 0 ? Array.from(statuses) : undefined,
        municipalityIds: isSuperAdmin && municipios.size > 0 ? Array.from(municipios) : undefined,
        granularity,
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `estadisticas-${granularity.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(getErrorMessage(err, 'No se ha podido generar el PDF.'))
    } finally {
      setExportingPdf(false)
    }
  }

  // Municipios "cliente" (con al menos un admin activo), solo para el filtro
  // de SUPER_ADMIN — mismo endpoint que ya usa ClientMunicipalitiesPage.
  const [clientMunicipalityIds, setClientMunicipalityIds] = useState<string[]>([])
  useEffect(() => {
    if (!isSuperAdmin) return
    getClientMunicipalities()
      .then(setClientMunicipalityIds)
      .catch(() => {
        /* si falla, el filtro de municipio queda vacío pero el resto de la página funciona igual */
      })
  }, [isSuperAdmin])

  // Nombre de municipio a partir del código INE — mismo patrón que
  // IncidentsListPage/UsersPage: se resuelve por provincia y se cachea.
  // Cubre tanto las opciones del filtro de municipio como los municipios
  // que aparezcan en el ranking de operarios.
  const [municipalityNames, setMunicipalityNames] = useState<Record<string, string>>({})
  const loadedProvinces = useRef<Set<string>>(new Set())

  useEffect(() => {
    const ids = new Set<string>(clientMunicipalityIds)
    stats?.operatorRanking.forEach((op) => {
      if (op.municipalityId) ids.add(op.municipalityId)
    })
    municipios.forEach((id) => ids.add(id))

    const provinceCodes = [...new Set([...ids].filter((id) => id.length >= 2).map((id) => id.slice(0, 2)))]
    const pending = provinceCodes.filter((code) => !loadedProvinces.current.has(code))
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
  }, [clientMunicipalityIds, stats, municipios])

  const activeFilterPills = useMemo(() => {
    const pills: Array<{ key: string; label: string; onRemove: () => void }> = []

    categories.forEach((c) =>
      pills.push({
        key: `cat-${c}`,
        label: CATEGORY_LABELS[c],
        onRemove: () => {
          const next = new Set(categories)
          next.delete(c)
          updateFilters({ categorias: next.size > 0 ? Array.from(next).join(',') : null })
        },
      }),
    )
    statuses.forEach((s) =>
      pills.push({
        key: `status-${s}`,
        label: STATUS_LABELS[s],
        onRemove: () => {
          const next = new Set(statuses)
          next.delete(s)
          updateFilters({ estados: next.size > 0 ? Array.from(next).join(',') : null })
        },
      }),
    )
    if (isSuperAdmin) {
      municipios.forEach((m) =>
        pills.push({
          key: `muni-${m}`,
          label: municipalityNames[m] ?? m,
          onRemove: () => {
            const next = new Set(municipios)
            next.delete(m)
            updateFilters({ municipios: next.size > 0 ? Array.from(next).join(',') : null })
          },
        }),
      )
    }
    return pills
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, statuses, municipios, municipalityNames, isSuperAdmin])

  return (
    <div className="statistics-page">
      <div className="page-header">
        <div>
          <h1>Resúmenes y estadísticas</h1>
          <p className="page-subtitle">
            {isSuperAdmin
              ? municipios.size === 0
                ? 'Todos los municipios'
                : `${municipios.size} municipio${municipios.size > 1 ? 's' : ''} seleccionado${municipios.size > 1 ? 's' : ''}`
              : 'Tu municipio'}
          </p>
        </div>
      </div>

      <div className="filters-row">
        {isSuperAdmin && (
          <MultiSelect
            summary={municipioSummary(municipios, municipalityNames)}
            options={clientMunicipalityIds.map((id) => ({ value: id, label: municipalityNames[id] ?? id }))}
            selected={municipios}
            allLabel="Todos los municipios"
            onChange={(next) => updateFilters({ municipios: next.size > 0 ? Array.from(next).join(',') : null })}
          />
        )}

        <MultiSelect
          summary={
            categories.size === 0
              ? 'Categoría: Todas'
              : categories.size === 1
                ? `Categoría: ${CATEGORY_LABELS[[...categories][0]]}`
                : `Categoría: ${categories.size} seleccionadas`
          }
          options={CATEGORY_OPTIONS.map(([value, label]) => ({ value, label }))}
          selected={categories}
          allLabel="Todas las categorías"
          onChange={(next) => updateFilters({ categorias: next.size > 0 ? Array.from(next).join(',') : null })}
        />

        <MultiSelect
          summary={
            statuses.size === 0
              ? 'Estado: Todos'
              : statuses.size === 1
                ? `Estado: ${STATUS_LABELS[[...statuses][0]]}`
                : `Estado: ${statuses.size} seleccionados`
          }
          options={STATUS_OPTIONS.map(([value, label]) => ({ value, label }))}
          selected={statuses}
          allLabel="Todos los estados"
          onChange={(next) => updateFilters({ estados: next.size > 0 ? Array.from(next).join(',') : null })}
        />

                <div className="period-tabs">
          {GRANULARITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`period-tab${granularity === opt.value ? ' active' : ''}`}
              onClick={() => updateFilters({ granularidad: opt.value === 'QUARTERLY' ? null : opt.value })}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button className="btn btn-secondary" onClick={handleExportPdf} disabled={exportingPdf}>
          {exportingPdf ? 'Generando…' : 'Exportar PDF'}
        </button>
      </div>

      {activeFilterPills.length > 0 && (
        <div className="active-filters">
          <span className="hint">Filtros activos:</span>
          {activeFilterPills.map((p) => (
            <span key={p.key} className="filter-pill">
              {p.label}
              <button
                type="button"
                className="filter-pill-remove"
                onClick={p.onRemove}
                aria-label={`Quitar filtro ${p.label}`}
              >
                ✕
              </button>
            </span>
          ))}
          <button className="btn-link" onClick={clearAllFilters}>
            Limpiar todo
          </button>
        </div>
      )}

      {exportError && <div className="form-error">{exportError}</div>}

      {loading && <p className="hint">Cargando estadísticas…</p>}
      {error && <div className="form-error">{error}</div>}

      {!loading && !error && stats && <StatisticsContent stats={stats} granularity={granularity} municipalityNames={municipalityNames} />}
    </div>
  )
}

function municipioSummary(selected: Set<string>, names: Record<string, string>): string {
  if (selected.size === 0) return 'Municipio: Todos'
  if (selected.size === 1) {
    const id = [...selected][0]
    return `Municipio: ${names[id] ?? id}`
  }
  return `Municipio: ${selected.size} seleccionados`
}

function StatisticsContent({
  stats,
  granularity,
  municipalityNames,
}: {
  stats: Statistics
  granularity: StatsGranularity
  municipalityNames: Record<string, string>
}) {
  const granularityLabel = GRANULARITY_OPTIONS.find((g) => g.value === granularity)?.label ?? ''
  const resolvedPct = stats.totalCount > 0 ? Math.round((stats.resolvedCount / stats.totalCount) * 100) : 0

  return (
    <>
      <div className="kpi-row">
        <div className="card kpi-card">
          <div className="kpi-label">Incidencias totales</div>
          <div className="kpi-value">{stats.totalCount.toLocaleString('es-ES')}</div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-label">Resueltas</div>
          <div className="kpi-value">{stats.resolvedCount.toLocaleString('es-ES')}</div>
          <div className="kpi-sub">{resolvedPct}% del total</div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-label">Tiempo medio de resolución</div>
          <div className="kpi-value">
            {stats.avgResolutionDays != null ? stats.avgResolutionDays.toFixed(1).replace('.', ',') : '—'}{' '}
            <span className="kpi-unit">días</span>
          </div>
          <div className="kpi-sub kpi-sub-muted">desde que se crean</div>
        </div>
        <div className="card kpi-card">
          <div className="kpi-label">Abiertas / en resolución</div>
          <div className="kpi-value">{(stats.openCount + stats.inProgressCount).toLocaleString('es-ES')}</div>
          <div className="kpi-sub kpi-sub-open">
            {stats.openCount} abiertas · {stats.inProgressCount} en resolución
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <section className="card">
          <h2>Incidencias por categoría</h2>
          <p className="hint">Total histórico según los filtros aplicados, de más a menos frecuente</p>
          <CategoryBarChart data={stats.byCategory} />
        </section>

        <section className="card">
          <h2>Incidencias por estado</h2>
          <p className="hint">Distribución con los filtros aplicados</p>
          <StatusDonutChart data={stats.byStatus} total={stats.totalCount} resolvedPct={resolvedPct} />
        </section>
      </div>

      <div className="stats-grid">
        <section className="card">
          <h2>Incidencias resueltas por periodo</h2>
          <p className="hint">
            {granularityLabel} · últimos {stats.resolvedByPeriod.length || 0} periodos
          </p>
          <PeriodBarChart data={stats.resolvedByPeriod} />
        </section>

        <section className="card">
          <h2>Operarios que más resuelven</h2>
          <p className="hint">Con los filtros aplicados</p>
          <OperatorRankingTable data={stats.operatorRanking} municipalityNames={municipalityNames} />
        </section>
      </div>
    </>
  )
}

/**
 * Desplegable de selección múltiple genérico — mismo patrón (y misma clase
 * CSS) que CategoryMultiSelect en IncidentsListPage.tsx, generalizado para
 * poder reutilizarlo también en estado y municipio.
 */
function MultiSelect<T extends string>({
  summary,
  options,
  selected,
  allLabel,
  onChange,
}: {
  summary: string
  options: Array<{ value: T; label: string }>
  selected: Set<T>
  allLabel: string
  onChange: (next: Set<T>) => void
}) {
  function toggle(value: T, checked: boolean) {
    const next = new Set(selected)
    if (checked) next.add(value)
    else next.delete(value)
    onChange(next)
  }

  return (
    <details className="multiselect">
      <summary className="multiselect-summary">{summary}</summary>
      <div className="multiselect-panel">
        <label className="multiselect-option">
          <input type="checkbox" checked={selected.size === 0} onChange={() => onChange(new Set())} />
          {allLabel}
        </label>
        {options.map((opt) => (
          <label key={opt.value} className="multiselect-option">
            <input
              type="checkbox"
              checked={selected.has(opt.value)}
              onChange={(e) => toggle(opt.value, e.target.checked)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </details>
  )
}

/** Barras horizontales — las 6 categorías más frecuentes, resto agrupado en una nota. */
function CategoryBarChart({ data }: { data: CategoryCount[] }) {
  if (data.length === 0) {
    return <p className="hint">No hay incidencias con estos filtros.</p>
  }

  const top = data.slice(0, 6)
  const rest = data.slice(6)
  const max = top[0]?.count ?? 0
  const smallestShown = top[top.length - 1]?.count ?? 0

  return (
    <>
      {top.map((d) => (
        <div className="bar-row" key={d.category}>
          <span>{CATEGORY_LABELS[d.category]}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: max > 0 ? `${(d.count / max) * 100}%` : '0%' }} />
          </div>
          <span className="bar-count">{d.count}</span>
        </div>
      ))}
      {rest.length > 0 && (
        <p className="hint bar-chart-note">
          + {rest.length} categorías más con {smallestShown} incidencias o menos
        </p>
      )}
    </>
  )
}

/** Donut hecho a mano con círculos SVG apilados (stroke-dasharray/offset), sin librería. */
function StatusDonutChart({
  data,
  total,
  resolvedPct,
}: {
  data: StatusCount[]
  total: number
  resolvedPct: number
}) {
  const countByStatus = Object.fromEntries(data.map((d) => [d.status, d.count])) as Partial<
    Record<IncidentStatus, number>
  >

  const radius = 60
  const circumference = 2 * Math.PI * radius
  let cumulative = 0

  return (
    <>
      <svg width="100%" height="160" viewBox="0 0 200 160">
        <g transform="translate(100,80)">
          <circle r={radius} fill="none" stroke="#e5e7eb" strokeWidth={24} />
          {total > 0 &&
            STATUS_ORDER.map((status) => {
              const count = countByStatus[status] ?? 0
              if (count === 0) return null
              const dash = (count / total) * circumference
              const offset = -cumulative
              cumulative += dash
              return (
                <circle
                  key={status}
                  r={radius}
                  fill="none"
                  stroke={STATUS_COLORS[status]}
                  strokeWidth={24}
                  strokeDasharray={`${dash} ${circumference}`}
                  strokeDashoffset={offset}
                  transform="rotate(-90)"
                />
              )
            })}
          <text textAnchor="middle" dy="-4" fontSize={20} fontWeight={700} fill="#1a1a1a">
            {resolvedPct}%
          </text>
          <text textAnchor="middle" dy={14} fontSize={10} fill="rgba(26,26,26,0.6)">
            resueltas
          </text>
        </g>
      </svg>
      <div className="status-legend">
        {STATUS_ORDER.map((status) => (
          <span key={status}>
            <i className="dot" style={{ background: STATUS_COLORS[status] }} />
            {STATUS_LABELS[status]} ({countByStatus[status] ?? 0})
          </span>
        ))}
      </div>
    </>
  )
}

/** Barras verticales SVG — una por cubo de periodo, ancho dinámico según cuántos haya. */
function PeriodBarChart({ data }: { data: PeriodCount[] }) {
  if (data.length === 0) {
    return <p className="hint">No hay incidencias resueltas en este periodo con estos filtros.</p>
  }

  const height = 180
  const axisY = 150
  const chartTop = 20
  const barWidth = 46
  const width = Math.max(480, 60 + data.length * 70)
  const gap = (width - 60) / data.length
  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="line-chart-wrap">
      <line x1={30} y1={axisY} x2={width - 10} y2={axisY} stroke="#d6d6d6" strokeWidth={1} />
      {data.map((d, i) => {
        const barHeight = (d.count / max) * (axisY - chartTop)
        const x = 45 + i * gap
        const y = axisY - barHeight
        return (
          <g key={d.periodStart}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx={3} fill="#4b6fff" />
            <text x={x + barWidth / 2} y={y - 6} fontSize={11} fill="#1a1a1a" fontWeight={600} textAnchor="middle">
              {d.count}
            </text>
            <text x={x + barWidth / 2} y={axisY + 16} fontSize={11} fill="rgba(26,26,26,0.6)" textAnchor="middle">
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function OperatorRankingTable({
  data,
  municipalityNames,
}: {
  data: OperatorRanking[]
  municipalityNames: Record<string, string>
}) {
  if (data.length === 0) {
    return <p className="hint">No hay incidencias resueltas por operarios con estos filtros.</p>
  }

  return (
    <table className="table">
      <thead>
        <tr>
          <th></th>
          <th>Operario</th>
          <th>Municipio</th>
          <th>Resueltas</th>
        </tr>
      </thead>
      <tbody>
        {data.map((op, i) => (
          <tr key={op.operatorId}>
            <td>
              <span className={`rank-badge${i === 0 ? ' gold' : ''}`}>{i + 1}</span>
            </td>
            <td>{op.operatorName}</td>
            <td>{op.municipalityId ? (municipalityNames[op.municipalityId] ?? op.municipalityId) : '—'}</td>
            <td>
              <strong>{op.resolvedCount}</strong>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}