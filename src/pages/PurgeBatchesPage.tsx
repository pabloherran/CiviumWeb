import { useEffect, useState } from 'react'
import {
  cancelPurgeBatch,
  confirmPurgeBatch,
  downloadPurgeBatchPdf,
  listPurgeBatches,
  preparePurgeBatch,
  type PurgeBatch,
} from '../api/purge'
import { Modal } from '../components/Modal'
import { formatDate } from '../utils/labels'
import { getErrorMessage } from '../api/errors'

const STATUS_LABELS: Record<PurgeBatch['status'], string> = {
  PENDING_CONFIRMATION: 'Pendiente de confirmación',
  EXECUTED: 'Ejecutado',
  CANCELLED: 'Cancelado',
}

/**
 * Purga anual de incidencias resueltas (solo SUPER_ADMIN). El backend
 * prepara automáticamente el batch cada 31 de diciembre (o al arrancar, si
 * se saltó un cierre por una caída) — aquí se revisa y se confirma o
 * cancela. "Preparar ahora" es para pruebas o para regenerar tras cancelar.
 */
export function PurgeBatchesPage() {
  const [batches, setBatches] = useState<PurgeBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<PurgeBatch | null>(null)
  const [cancelTarget, setCancelTarget] = useState<PurgeBatch | null>(null)

  function load() {
    setLoading(true)
    setError(null)
    listPurgeBatches()
      .then(setBatches)
      .catch((err) => setError(getErrorMessage(err, 'No se han podido cargar los batches de purga.')))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  async function handlePrepareNow() {
    setPreparing(true)
    setError(null)
    try {
      await preparePurgeBatch()
      load()
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'No se ha podido preparar el batch (puede que ya exista uno activo para este año, o que no haya incidencias resueltas que archivar).',
        ),
      )
    } finally {
      setPreparing(false)
    }
  }

  async function handleDownload(batch: PurgeBatch) {
    try {
      const blob = await downloadPurgeBatchPdf(batch.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `archivo-anual-${batch.year}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(getErrorMessage(err, 'No se ha podido descargar el PDF de archivo.'))
    }
  }

  return (
    <div className="purge-batches-page">
      <div className="page-header">
        <h1>Purga anual de incidencias</h1>
        <button className="btn btn-secondary" onClick={handlePrepareNow} disabled={preparing}>
          {preparing ? 'Preparando…' : 'Preparar ahora'}
        </button>
      </div>

      <p className="hint">
        Cada 31 de diciembre el sistema archiva y elimina permanentemente todas las incidencias
        resueltas que sigan existiendo: genera un PDF con el resumen del año y el detalle de cada
        incidencia (sin fotos) y crea aquí un batch pendiente de confirmación. Nada se borra hasta
        que lo confirmes.
      </p>

      {loading && <p className="hint">Cargando…</p>}
      {error && <div className="form-error">{error}</div>}

      {!loading && !error && (
        <table className="table">
          <thead>
            <tr>
              <th>Año</th>
              <th>Estado</th>
              <th>Incidencias</th>
              <th>Preparado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <tr key={batch.id}>
                <td>{batch.year}</td>
                <td>{STATUS_LABELS[batch.status]}</td>
                <td>{batch.incidentCount}</td>
                <td>{formatDate(batch.preparedAt)}</td>
                <td>
                  <div className="row-actions">
                    <button className="btn-link" onClick={() => handleDownload(batch)}>
                      Descargar PDF
                    </button>
                    {batch.status === 'PENDING_CONFIRMATION' && (
                      <>
                        <button className="btn-link" onClick={() => setConfirmTarget(batch)}>
                          Confirmar y eliminar
                        </button>
                        <button className="btn-link-danger" onClick={() => setCancelTarget(batch)}>
                          Cancelar batch
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr>
                <td colSpan={5} className="table-empty">
                  Todavía no hay ningún batch de purga.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {confirmTarget && (
        <ConfirmPurgeModal
          batch={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onDone={() => {
            setConfirmTarget(null)
            load()
          }}
        />
      )}

      {cancelTarget && (
        <CancelPurgeModal
          batch={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onDone={() => {
            setCancelTarget(null)
            load()
          }}
        />
      )}
    </div>
  )
}

/**
 * Doble confirmación: hay que revisar el PDF y retipear el número exacto
 * de incidencias que se van a eliminar — mismo patrón que retipear el
 * código INE al dar de baja un municipio.
 */
function ConfirmPurgeModal({
  batch,
  onClose,
  onDone,
}: {
  batch: PurgeBatch
  onClose: () => void
  onDone: () => void
}) {
  const [typedCount, setTypedCount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await confirmPurgeBatch(batch.id, Number(typedCount))
      onDone()
    } catch (err) {
      setError(getErrorMessage(err, 'No se ha podido confirmar la purga. Revisa el número de incidencias.'))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={`Confirmar purga de ${batch.year}`}
      onClose={() => !submitting && onClose()}
      actions={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button
            className="btn btn-danger"
            onClick={handleConfirm}
            disabled={submitting || Number(typedCount) !== batch.incidentCount}
          >
            {submitting ? 'Eliminando…' : 'Eliminar definitivamente'}
          </button>
        </>
      }
    >
      <p>
        Vas a eliminar de forma <strong>permanente</strong> las <strong>{batch.incidentCount}</strong>{' '}
        incidencias archivadas en este batch (y sus fotos). Descarga y revisa el PDF antes de
        confirmar — es el único registro que quedará de ellas.
      </p>
      <label className="field">
        <span>Escribe el número de incidencias ({batch.incidentCount}) para confirmar</span>
        <input type="number" value={typedCount} onChange={(e) => setTypedCount(e.target.value)} autoComplete="off" />
      </label>
      {error && <div className="form-error">{error}</div>}
    </Modal>
  )
}

function CancelPurgeModal({
  batch,
  onClose,
  onDone,
}: {
  batch: PurgeBatch
  onClose: () => void
  onDone: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCancel() {
    setSubmitting(true)
    setError(null)
    try {
      await cancelPurgeBatch(batch.id)
      onDone()
    } catch (err) {
      setError(getErrorMessage(err, 'No se ha podido cancelar el batch.'))
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={`Cancelar batch de ${batch.year}`}
      onClose={() => !submitting && onClose()}
      actions={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Volver
          </button>
          <button className="btn btn-danger" onClick={handleCancel} disabled={submitting}>
            {submitting ? 'Cancelando…' : 'Cancelar batch'}
          </button>
        </>
      }
    >
      <p>
        No se eliminará nada. Las {batch.incidentCount} incidencias de este batch seguirán existiendo y se
        recogerán en el siguiente batch que se prepare.
      </p>
      {error && <div className="form-error">{error}</div>}
    </Modal>
  )
}