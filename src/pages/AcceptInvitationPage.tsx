import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import civiumWordmark from '../assets/civium-wordmark.png'
import { getErrorMessage } from '../api/errors'

/**
 * Página pública de alta para administradores municipales/super
 * administradores invitados (punto 1.1 de la revisión MVP).
 *
 * El email de invitación (backend, `EmailTemplates.invitation`) enlaza
 * aquí con `email` y `code` como query params para invitaciones de
 * MUNICIPAL_ADMIN/SUPER_ADMIN, en vez de mandarlas a la Play Store como
 * sigue haciendo con OPERATOR (ver diff de `EmailTemplates.kt`).
 *
 * Llama a `POST /auth/register` con el código de invitación; el rol lo
 * decide siempre el backend a partir de ese código — esta pantalla no lo
 * elige, solo lo envía. Si el registro sale bien, `AuthContext.register`
 * deja al usuario logueado directamente, sin pedirle el email y la
 * contraseña otra vez en `/login`.
 */
export function AcceptInvitationPage() {
  const { user, register, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const emailFromLink = searchParams.get('email') ?? ''
  const codeFromLink = searchParams.get('code') ?? ''

  const [email, setEmail] = useState(emailFromLink)
  const [name, setName] = useState('')
  const [code, setCode] = useState(codeFromLink)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Si ya hay una sesión abierta en este navegador (p. ej. el propio admin
  // que creó la invitación, probando el enlace), no la pisamos en
  // silencio: se lo decimos y le dejamos elegir cerrarla para poder
  // aceptar la invitación con la cuenta nueva, en vez de mandarlo sin
  // explicación a /incidencias.
  if (user) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <img src={civiumWordmark} alt="CIVIUM" className="login-wordmark" />
          <p className="login-subtitle">Ya tienes una sesión iniciada</p>
          <p className="login-hint">
            Has entrado en el portal con la cuenta <strong>{user.email}</strong>. Para aceptar
            esta invitación con otra cuenta, cierra sesión primero.
          </p>

          <button className="btn btn-primary" type="button" onClick={logout}>
            Cerrar sesión y continuar
          </button>

          <p className="login-hint">
            <Link to="/incidencias">Seguir con mi sesión actual</Link>
          </p>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!email.trim().includes('@')) {
      setError('Introduce un email válido.')
      return
    }
    if (!name.trim()) {
      setError('Introduce tu nombre.')
      return
    }
    if (!code.trim()) {
      setError('Introduce el código de invitación que recibiste por email.')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setSubmitting(true)
    try {
      await register({
        email: email.trim(),
        name: name.trim(),
        password,
        invitationCode: code.trim(),
      })
      navigate('/incidencias', { replace: true })
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'No se ha podido crear la cuenta. Comprueba el código de invitación e inténtalo de nuevo.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src={civiumWordmark} alt="CIVIUM" className="login-wordmark" />
        <p className="login-subtitle">Crear cuenta desde una invitación</p>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            readOnly={emailFromLink.length > 0}
            required
          />
        </label>

        <label className="field">
          <span>Nombre</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </label>

        <label className="field">
          <span>Código de invitación</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="8 caracteres"
            autoComplete="off"
            required
          />
        </label>

        <label className="field">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>

        <p className="login-hint">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>.
        </p>
      </form>
    </div>
  )
}
