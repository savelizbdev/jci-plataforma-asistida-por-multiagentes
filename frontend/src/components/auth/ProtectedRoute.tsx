/**
 * Componente de rutas protegidas
 */
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LoadingScreen } from '../common/LoadingScreen';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: number[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <LoadingScreen message="Verificando acceso..." />;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!allowedRoles.includes(user.id_rol)) {
        // Redireccionar al home correcto según su rol
        if (user.id_rol === 1) return <Navigate to="/admin/home" replace />;
        if (user.id_rol === 2) return <Navigate to="/emprendedor/home" replace />;
        if (user.id_rol === 3) return <Navigate to="/mentor/home" replace />;
    }

    return <>{children}</>;
};
