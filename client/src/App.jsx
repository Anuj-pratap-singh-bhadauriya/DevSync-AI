import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastProvider } from './components/Toast';

// Lazy-load all page components — only downloaded when the route is visited
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Workspace = lazy(() => import('./pages/Workspace'));
const Profile = lazy(() => import('./pages/Profile'));
const Arena = lazy(() => import('./pages/Arena'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));

// Minimal loading fallback
const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#09090b' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 36, height: 36, border: '3px solid #27272a', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
      <p style={{ color: '#71717a', fontSize: 13, fontFamily: 'monospace' }}>Loading...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  </div>
);

function App() {
  return (
    <ToastProvider>
      <Router>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Landing Page */}
          <Route path="/" element={<LandingPage />} />
          
          {/* Core Application Routes protected by Authentication Middleware */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/workspace/:id" 
            element={
              <ProtectedRoute>
                <Workspace />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />
          
          {/* NAYA: Coding Arena Route added securely */}
          <Route 
            path="/arena" 
            element={
              <ProtectedRoute>
                <Arena />
              </ProtectedRoute>
            } 
          />
          
          {/* Public Identity Verification Routes */}
          <Route path="/login" element={
            <ProtectedRoute requireAuth={false}>
              <Login />
            </ProtectedRoute>
          } />
          <Route path="/signup" element={
            <ProtectedRoute requireAuth={false}>
              <Signup />
            </ProtectedRoute>
          } />
          <Route path="/forgot-password" element={
            <ProtectedRoute requireAuth={false}>
              <ForgotPassword />
            </ProtectedRoute>
          } />
          
          {/* Catch-all Route for Unknown Paths */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </Router>
    </ToastProvider>
  );
}

export default App;