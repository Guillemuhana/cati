import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import RecuperarPassword from './pages/RecuperarPassword'
import NuevaPassword from './pages/NuevaPassword'
import Dashboard from './pages/Dashboard'
import Presupuestos from './pages/Presupuestos'
import PresupuestoForm from './pages/PresupuestoForm'
import PresupuestoDetail from './pages/PresupuestoDetail'
import Clientes from './pages/Clientes'
import Productos from './pages/Productos'
import Reportes from './pages/Reportes'
import Facturas from './pages/Facturas'
import FacturaDetail from './pages/FacturaDetail'
import Premium from './pages/Premium'
import PublicBudget from './pages/PublicBudget'
import PublicNda from './pages/PublicNda'
import Confidencialidad from './pages/Confidencialidad'
import ConfidencialidadDetail from './pages/ConfidencialidadDetail'
import Perfil from './pages/Perfil'
import Ayuda from './pages/Ayuda'
import Invitar from './pages/Invitar'
import Admin from './pages/Admin'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/ingresar" element={<Login />} />
      <Route path="/registro" element={<Register />} />
      {/* Recupero de contraseña: pedir el link y, al volver del mail,
          elegir la nueva. Las dos van sin login, por razones obvias. */}
      <Route path="/recuperar" element={<RecuperarPassword />} />
      <Route path="/nueva-contrasena" element={<NuevaPassword />} />
      <Route path="/p/:token" element={<PublicBudget />} />
      {/* El acuerdo de confidencialidad que firma el cliente. Sin login:
          el que lo recibe todavía no es cliente de nadie. */}
      <Route path="/c/:token" element={<PublicNda />} />

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
        path="/catalogo"
        element={
          <ProtectedRoute>
            <Layout>
              <Productos />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reportes"
        element={
          <ProtectedRoute>
            <Layout>
              <Reportes />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/facturas"
        element={
          <ProtectedRoute>
            <Layout>
              <Facturas />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/facturas/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <FacturaDetail />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/premium"
        element={
          <ProtectedRoute>
            <Layout>
              <Premium />
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

      <Route
        path="/invitar"
        element={
          <ProtectedRoute>
            <Layout>
              <Invitar />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ayuda"
        element={
          <ProtectedRoute>
            <Layout>
              <Ayuda />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Acuerdos de confidencialidad: solo para el dueño. Igual que
          /admin, el acceso real lo decide public.is_admin() en la base
          (migración 27), no estas rutas. */}
      <Route
        path="/confidencialidad"
        element={
          <ProtectedRoute>
            <Layout>
              <Confidencialidad />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/confidencialidad/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <ConfidencialidadDetail />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* El acceso real lo decide public.is_admin() en la base de datos:
          entrar a mano a esta URL no muestra ningún dato. */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Layout>
              <Admin />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
