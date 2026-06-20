import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const ProtectedRoute = ({ children, requireAuth = true }) => {
  // Accessing authentication state from Redux store
  const { isAuthenticated } = useSelector((state) => state.auth);

  // Redirecting unauthenticated users to the landing page if auth is required
  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Redirecting authenticated users to the dashboard if auth is NOT required (e.g., login page)
  if (!requireAuth && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Rendering the requested component if state is valid
  return children;
};

export default ProtectedRoute;