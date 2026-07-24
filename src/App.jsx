import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Presupuestos from './pages/Presupuestos'
import PresupuestoForm from './pages/PresupuestoForm'
import PresupuestoDetail from './pages/PresupuestoDetail'
import Clientes from './pages/Clientes'
import Perfil from './pages/Perfil'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/ingresar" element={<Login />} />
      <Route path="/registro" element={<Register />} />

      <Route
        path="/panel"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/presupuestos"
        element={
          <ProtectedRoute>
            <Layout>
              <Presupuestos />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/presupuestos/nuevo"
        element={
          <ProtectedRoute>
            <Layout>
              <PresupuestoForm />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/presupuestos/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <PresupuestoDetail />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/presupuestos/:id/editar"
        element={
          <ProtectedRoute>
            <Layout>
              <PresupuestoForm />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/clientes"
        element={
          <ProtectedRoute>
            <Layout>
              <Clientes />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/perfil"
        element={
          <ProtectedRoute>
            <Layout>
              <Perfil />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
