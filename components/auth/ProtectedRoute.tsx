
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES } from '../../constants';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const auth = useAuth();
  const location = useLocation();

  if (auth.isLoading) {
    // You can render a loading spinner here
    return (
        <div className="flex items-center justify-center min-h-screen bg-lime-50">
            <div className="p-6 bg-white rounded-lg shadow-xl text-center">
                <p className="text-green-700 text-lg">Carregando...</p>
                {/* Optional: add a spinner SVG or component */}
            </div>
        </div>
    );
  }

  if (!auth.isAuthenticated) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // If authenticated and trying to access login page, redirect to dashboard
  if (auth.isAuthenticated && location.pathname === ROUTES.LOGIN) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }
  
  return <>{children}</>;
};

export default ProtectedRoute;
