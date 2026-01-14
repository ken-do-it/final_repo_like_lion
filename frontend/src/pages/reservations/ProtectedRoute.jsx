import { Navigate, Outlet, useLocation } from 'react-router-dom'

// Minimal protected route wrapper.
// JWT is stored in HttpOnly cookie, so we cannot read it from JS.
// We optimistically render and rely on axios 401 interceptor to kick to /login.
// As a UX improvement, we can soft-guard by checking a hint flag if provided.
export default function ProtectedRoute() {
  const location = useLocation()
  const isAuthedHint = Boolean(window?.__AUTH__?.isAuthenticated)

  if (isAuthedHint === false) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <Outlet />
}

