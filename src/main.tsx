import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import Index from './pages/Index'
import NotFound from './pages/NotFound'
import CardView from './pages/CardView'
import Home from './pages/Home'
import Boards from './pages/Boards'
import Login from './pages/Login'
import Register from './pages/Register'
import Customers from './pages/Customers'

function RequireAuth({ children }: { children: React.ReactNode }) {
  // Accept either key to be resilient
  const token = typeof window !== 'undefined'
    ? (localStorage.getItem('auth_token') || localStorage.getItem('token'))
    : null;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  // Public
  { path: '/login', element: <App><Login /></App> },
  { path: '/register', element: <App><Register /></App> },

  // New real home page
  { path: '/', element: <App><Home /></App> },

  // Protected
  { path: '/boards', element: <App><RequireAuth><Boards /></RequireAuth></App> },
  { path: '/customers', element: <App><RequireAuth><Customers /></RequireAuth></App> },
  { path: '/project/:projectId', element: <App><RequireAuth><Index /></RequireAuth></App> },

  // Card detail views (keep accessible if needed under auth)
  { path: '/card/:cardId', element: <App><RequireAuth><CardView /></RequireAuth></App> },
  { path: '/project/:projectId/card/:cardId', element: <App><RequireAuth><CardView /></RequireAuth></App> },

  // Fallback
  { path: '*', element: <App><NotFound /></App> },
])

createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
