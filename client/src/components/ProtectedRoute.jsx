import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // exp is in seconds, Date.now() is in ms
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

const ProtectedRoute = ({ children, requireAuth = true }) => {
  // Accessing authentication state from Redux store
  const { isAuthenticated, token } = useSelector((state) => state.auth);

  const validAuth = isAuthenticated && !isTokenExpired(token);

  // Redirecting unauthenticated users to the landing page if auth is required
  if (requireAuth && !validAuth) {
    return <Navigate to="/" replace />;
  }

  // Redirecting authenticated users to the dashboard if auth is NOT required (e.g., login page)
  if (!requireAuth && validAuth) {
    return <Navigate to="/dashboard" replace />;
  }

  // Rendering the requested component if state is valid
  return children;
};

export default ProtectedRoute;