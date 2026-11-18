import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ allowedRoles }) {
  const { loading, isAuthenticated, role, authError } = useAuth();
  const location = useLocation();

  // Logado mas sem acesso válido (inativo / sem empresa): volta ao login com aviso
  if (!loading && isAuthenticated && !role && authError) {
    return <Navigate to="/login" replace />;
  }

  // Ainda carregando sessão ou o vínculo com a empresa
  if (loading || (isAuthenticated && !role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(role)) {
    return <Navigate to="/nova-compra" replace />;
  }

  return <Outlet />;
}
