import type { ReactNode } from 'react'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
  actions: ReactNode
}

/**
 * Diálogo modal simple y plano, coherente con el resto de la interfaz.
 * Se cierra al hacer clic fuera de la tarjeta o pulsando Escape lo delega
 * el propio botón de cancelar de cada uso (no hay lógica de teclado aquí
 * para mantenerlo sencillo).
 */
export function Modal({ title, onClose, children, actions }: ModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  )
}
