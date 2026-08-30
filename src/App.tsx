import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { IncidentsListPage } from './pages/IncidentsListPage'
import { IncidentDetailPage } from './pages/IncidentDetailPage'
import { IncidentsMapPage } from './pages/IncidentsMapPage'
import { UsersPage } from './pages/UsersPage'
import { ClientMunicipalitiesPage } from './pages/ClientMunicipalitiesPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/incidencias" element={<IncidentsListPage />} />
          <Route path="/incidencias/:id" element={<IncidentDetailPage />} />
          <Route path="/mapa" element={<IncidentsMapPage />} />
          <Route path="/usuarios" element={<UsersPage />} />
          <Route path="/municipios-cliente" element={<ClientMunicipalitiesPage />} />
          <Route path="/" element={<Navigate to="/incidencias" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/incidencias" replace />} />
      </Routes>
    </AuthProvider>
  )
}
