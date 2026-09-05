import { type FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import civiumWordmark from '../assets/civium-wordmark.png'
import { forgotPassword, resetPassword } from '../api/auth'
import { getErrorMessage } from '../api/errors'

/**
 * Recuperación de contraseña del portal (punto 1.2 de la revisión MVP),
 * en dos pasos dentro de la misma pantalla — igual patrón que
 * `ForgotPasswordScreen.kt` en Android:
 *
 *   Paso 1: introducir email -> se solicita el código (el backend
 *           responde siempre igual exista o no la cuenta, anti-enumeración).
 *   Paso 2: introducir código de 6 dígitos + contraseña nueva.
 *
 * A diferencia de `AcceptInvitationPage`, este flujo NO abre sesión: el
 * usuario tiene que volver a iniciar sesión con su contraseña nueva en
 * `/login`, así que no usa `AuthContext`, llama directamente a la API.
 */
export function ForgotPasswordPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return <Navigate to="/incidencias" replace />
  }

  function isValidEmail(value: string) {
    return value.includes('@') && value.split('@')[1]?.includes('.')
  }

  async function handleRequestCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!isValidEmail(email.trim())) {
      setError('Email inválido.')
      return
    }
    setSubmitting(true)
    try {
      await forgotPassword({ email: email.trim() })
      setStep('reset')
    } catch (err) {
      setError(getErrorMessage(err, 'No se ha podido enviar la solicitud. Comprueba tu conexión.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (code.trim().length !== 6) {
      setError('El código debe tener 6 dígitos.')
      return
    }
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setSubmitting(true)
    try {
      await resetPassword({ email: email.trim(), code: code.trim(), newPassword })
      setStep('done')
      window.setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch (err) {
      setError(getErrorMessage(err, 'Código inválido o caducado.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <img src={civiumWordmark} alt="CIVIUM" className="login-wordmark" />

        {step === 'done' ? (
          <>
            <p className="login-subtitle">✓ Contraseña actualizada</p>
            <p className="login-hint">Ya puedes iniciar sesión con tu nueva contraseña.</p>
          </>
        ) : step === 'email' ? (
          <form onSubmit={handleRequestCode} style={{ display: 'contents' }}>
            <p className="login-subtitle">Recuperar contraseña</p>
            <p className="login-hint">
              Introduce el email de tu cuenta y te enviaremos un código de verificación.
            </p>

            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </label>

            {error && <div className="form-error">{error}</div>}

            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Enviando…' : 'Enviar código'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} style={{ display: 'contents' }}>
            <p className="login-subtitle">Recuperar contraseña</p>
            <p className="login-hint">
              Si existe una cuenta con ese email, hemos enviado un código de 6 dígitos. Revisa tu
              bandeja de entrada (y la carpeta de spam).
            </p>

            <label className="field">
              <span>Código de verificación</span>
              <input
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6 dígitos"
                required
              />
            </label>

            <label className="field">
              <span>Nueva contraseña</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>

            <label className="field">
              <span>Confirmar contraseña</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>

            {error && <div className="form-error">{error}</div>}

            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Cambiando…' : 'Cambiar contraseña'}
            </button>

            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setError(null)
                setCode('')
                setStep('email')
              }}
              disabled={submitting}
            >
              ¿No has recibido el código? Volver a intentarlo
            </button>
          </form>
        )}

        {step !== 'done' && (
          <p className="login-hint">
            <Link to="/login">Volver al inicio de sesión</Link>
          </p>
        )}
      </div>
    </div>
  )
}
