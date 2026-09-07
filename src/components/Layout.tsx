import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS } from '../utils/labels'
import civiumWordmark from '../assets/civium-wordmark.png'

const baseNavItems = [
  { to: '/incidencias', label: 'Incidencias' },
  { to: '/mapa', label: 'Mapa' },
  { to: '/estadisticas', label: 'Estadísticas' },
  { to: '/usuarios', label: 'Usuarios' },
]

export function Layout() {
  const { user, logout } = useAuth()
  const navItems =
    user?.role === 'SUPER_ADMIN'
      ? [...baseNavItems, { to: '/municipios-cliente', label: 'Municipios cliente' }]
      : baseNavItems

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={civiumWordmark} alt="CIVIUM" className="sidebar-brand-wordmark" />
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          {user && (
            <>
              <div className="sidebar-user">
                <div className="sidebar-user-name">{user.name}</div>
                <div className="sidebar-user-role">{ROLE_LABELS[user.role]}</div>
              </div>
              <button className="btn btn-ghost" onClick={logout}>
                Cerrar sesión
              </button>
            </>
          )}
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
