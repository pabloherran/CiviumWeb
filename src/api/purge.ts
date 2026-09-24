import { apiClient } from './client'

export type PurgeBatchStatus = 'PENDING_CONFIRMATION' | 'EXECUTED' | 'CANCELLED'

export interface PurgeBatch {
  id: string
  year: number
  status: PurgeBatchStatus
  incidentCount: number
  preparedAt: number
  confirmedBy?: string | null
  executedAt?: number | null
  cancelledBy?: string | null
  cancelledAt?: number | null
}

export async function listPurgeBatches(): Promise<PurgeBatch[]> {
  const { data } = await apiClient.get<PurgeBatch[]>('admin/purge-batches')
  return data
}

export async function downloadPurgeBatchPdf(id: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`admin/purge-batches/${id}/pdf`, {
    responseType: 'blob',
  })
  return data
}

export async function preparePurgeBatch(year?: number): Promise<PurgeBatch> {
  const { data } = await apiClient.post<PurgeBatch>('admin/purge-batches/prepare', undefined, {
    params: year ? { year } : undefined,
  })
  return data
}

export async function confirmPurgeBatch(id: string, confirmIncidentCount: number): Promise<void> {
  await apiClient.post(`admin/purge-batches/${id}/confirm`, { confirmIncidentCount })
}

export async function cancelPurgeBatch(id: string): Promise<void> {
  await apiClient.delete(`admin/purge-batches/${id}`)
}