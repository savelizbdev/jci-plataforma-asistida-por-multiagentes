/**
 * Componente principal de la aplicación
 * Maneja el routing y la autenticación
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { LoadingScreen } from './components/common/LoadingScreen';
import { Login } from './pages/Login';
import { AccountDisabled } from './pages/AccountDisabled';
import { HomeEmprendedor } from './pages/HomeEmprendedor';
import { DiagnosticoIA } from './pages/DiagnosticoIA';
import { HomeMentor } from './pages/HomeMentor';
import { ResultadosDiagnostico } from './pages/ResultadosDiagnostico';
import { GenerarReportes } from './pages/GenerarReportes';
import { HomeAdministrador } from './pages/HomeAdministrador';
import { GestionUsuarios } from './pages/GestionUsuarios';
import { AsignacionMentores } from './pages/AsignacionMentores';
import { TareasEmprendedor } from './pages/TareasEmprendedor';
import { GenerarReportesAdmin } from './pages/GenerarReportesAdmin';
import { SeguimientoTareas } from './pages/SeguimientoTareas';

function AppRoutes() {
    const { user, loading } = useAuth();

    if (loading) {
        return <LoadingScreen message="Cargando plataforma..." />;
    }

    // Redirección automática según rol
    const getHomeRoute = () => {
        if (!user) return '/login';
        if (user.id_rol === 1) return '/admin/home';
        if (user.id_rol === 2) return '/emprendedor/home';
        if (user.id_rol === 3) return '/mentor/home';
        return '/login';
    };

    return (
        <Routes>
            {/* Rutas públicas */}
            <Route path="/login" element={user ? <Navigate to={getHomeRoute()} replace /> : <Login />} />
            <Route path="/account-disabled" element={<AccountDisabled />} />

            {/* Rutas protegidas - Emprendedor */}
            <Route
                path="/emprendedor/home"
                element={
                    <ProtectedRoute allowedRoles={[2]}>
                        <HomeEmprendedor />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/emprendedor/diagnostico-ia"
                element={
                    <ProtectedRoute allowedRoles={[2]}>
                        <DiagnosticoIA />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/emprendedor/tareas"
                element={
                    <ProtectedRoute allowedRoles={[2]}>
                        <TareasEmprendedor />
                    </ProtectedRoute>
                }
            />

            {/* Rutas protegidas - Mentor */}
            <Route
                path="/mentor/home"
                element={
                    <ProtectedRoute allowedRoles={[3]}>
                        <HomeMentor />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/mentor/diagnosticos"
                element={
                    <ProtectedRoute allowedRoles={[3]}>
                        <ResultadosDiagnostico />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/mentor/reportes"
                element={
                    <ProtectedRoute allowedRoles={[3]}>
                        <GenerarReportes />
                    </ProtectedRoute>
                }
            />

            {/* Rutas protegidas - Administrador */}
            <Route
                path="/admin/home"
                element={
                    <ProtectedRoute allowedRoles={[1]}>
                        <HomeAdministrador />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/usuarios"
                element={
                    <ProtectedRoute allowedRoles={[1]}>
                        <GestionUsuarios />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/asignar-mentores"
                element={
                    <ProtectedRoute allowedRoles={[1]}>
                        <AsignacionMentores />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/reportes"
                element={
                    <ProtectedRoute allowedRoles={[1]}>
                        <GenerarReportesAdmin />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/admin/seguimiento"
                element={
                    <ProtectedRoute allowedRoles={[1]}>
                        <SeguimientoTareas />
                    </ProtectedRoute>
                }
            />

            {/* Ruta por defecto */}
            <Route path="/" element={<Navigate to={getHomeRoute()} replace />} />
            <Route path="*" element={<Navigate to={getHomeRoute()} replace />} />
        </Routes>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
