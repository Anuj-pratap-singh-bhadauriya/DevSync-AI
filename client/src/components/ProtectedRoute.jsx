import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const ProtectedRoute = ({ children }) => {
  // Accessing authentication state from Redux store
  const { isAuthenticated } = useSelector((state) => state.auth);

  // Redirecting unauthenticated users to the login portal
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  // Rendering the requested component if authentication is valid
  return children;
};

export default ProtectedRoute;