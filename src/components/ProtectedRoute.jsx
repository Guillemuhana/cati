import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Spinner from './Spinner'

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper">
        <Spinner />
      </div>
    )
  }

  if (!session) return <Navigate to="/ingresar" replace />

  return children
}
