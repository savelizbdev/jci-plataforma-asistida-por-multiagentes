/**
 * Página de Tareas para Emprendedor
 * Muestra tareas asignadas con filtros y opción de marcar como completadas
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/common/Layout';
import { MenuItem } from '../components/common/Sidebar';
import { obtenerMisTareas, marcarTareaCompletada, Tarea } from '../services/tareaService';
import toast, { Toaster } from 'react-hot-toast';

type FiltroEstado = 'Pendientes' | 'Completadas' | 'Todas';

const menuItems: MenuItem[] = [
    { label: 'Inicio', path: '/emprendedor/home' },
    { label: 'Mis Tareas', path: '/emprendedor/tareas' },
    { label: 'Diagnóstico IA', path: '/emprendedor/diagnostico-ia' },
    { label: 'Mis Programas', path: '/emprendedor/programas' },
];

export const TareasEmprendedor = () => {
    // ─── Auth (única instancia — no duplicar) ───────────────────────────────────
    const { user, logout } = useAuth();
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtroActivo, setFiltroActivo] = useState<FiltroEstado>('Pendientes');

    useEffect(() => {
        cargarTareas();
    }, []);

    const cargarTareas = async () => {
        if (!user?.id_usuario) return;

        try {
            setLoading(true);
            const data = await obtenerMisTareas(user.id_usuario);
            setTareas(data);
        } catch (error: any) {
            toast.error('Error al cargar tareas');
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleMarcarCompletada = async (idTarea: number) => {
        if (!user?.id_usuario) return;

        try {
            await marcarTareaCompletada(idTarea, user.id_usuario);
            toast.success('Tarea marcada como completada');
            await cargarTareas(); // Recargar lista
        } catch (error: any) {
            toast.error('Error al completar tarea');
            console.error('Error:', error);
        }
    };

    // Filtrar tareas según el tab activo
    const tareasFiltradas = tareas.filter(tarea => {
        if (filtroActivo === 'Pendientes') {
            return tarea.estado !== 'Completada';
        } else if (filtroActivo === 'Completadas') {
            return tarea.estado === 'Completada';
        }
        return true; // Todas
    });

    // Verificar si una tarea está vencida
    const estaVencida = (fechaExpiracion: string | null): boolean => {
        if (!fechaExpiracion) return false;
        return new Date(fechaExpiracion) < new Date();
    };

    // Formatear fecha
    const formatearFecha = (fecha: string): string => {
        const date = new Date(fecha);
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <Layout menuItems={menuItems} onLogout={logout}>
            <Toaster position="top-right" />

            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-800 tracking-tight mb-1">
                        Mis Tareas
                    </h1>
                    <p className="text-neutral-500 text-sm sm:text-base font-medium">
                        Gestiona y completa las tareas asignadas por tu mentor
                    </p>
                </div>

                {/* Tabs de filtrado */}
                <div className="mb-6 border-b border-slate-100">
                    <div className="flex gap-8">
                        {(['Pendientes', 'Completadas', 'Todas'] as FiltroEstado[]).map((filtro) => (
                            <button
                                key={filtro}
                                onClick={() => setFiltroActivo(filtro)}
                                className={`pb-4 px-1 font-semibold text-sm transition-colors relative ${filtroActivo === filtro
                                    ? 'text-neutral-800'
                                    : 'text-neutral-400 hover:text-neutral-700'
                                    }`}
                            >
                                {filtro}
                                {filtroActivo === filtro && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-activa-teal rounded-full"></div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Lista de tareas */}
                <div className="space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <div className="animate-spin h-8 w-8 border-b-2 border-activa-teal rounded-full mx-auto mb-4"></div>
                                <p className="text-neutral-500">Cargando tareas...</p>
                            </div>
                        </div>
                    ) : tareasFiltradas.length === 0 ? (
                        <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center">
                            <div className="w-14 h-14 bg-activa-teal/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <svg className="w-7 h-7 text-activa-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <p className="text-neutral-600 text-base font-medium">
                                {filtroActivo === 'Pendientes' && 'No tienes tareas pendientes'}
                                {filtroActivo === 'Completadas' && 'No has completado ninguna tarea aún'}
                                {filtroActivo === 'Todas' && 'No tienes tareas asignadas'}
                            </p>
                        </div>
                    ) : (
                        tareasFiltradas.map((tarea) => {
                            const vencida = estaVencida(tarea.fecha_expiracion);
                            const completada = tarea.estado === 'Completada';

                            return (
                                <div
                                    key={tarea.id_tarea}
                                    className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 hover:shadow-sm transition-all duration-200 relative overflow-hidden"
                                >
                                    {/* Acento izquierdo de color según estado */}
                                    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl ${
                                        completada ? 'bg-activa-teal' : vencida ? 'bg-red-400' : 'bg-activa-amber'
                                    }`}></div>

                                    <div className="flex items-start gap-4 pl-3">
                                        {/* Checkbox */}
                                        <div className="pt-1 flex-shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={completada}
                                                onChange={() => !completada && handleMarcarCompletada(tarea.id_tarea)}
                                                disabled={completada}
                                                className={`w-5 h-5 rounded border-2 ${completada
                                                    ? 'accent-activa-teal border-activa-teal'
                                                    : 'border-neutral-300 cursor-pointer'
                                                    } transition-colors`}
                                            />
                                        </div>

                                        {/* Contenido */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className={`text-base font-bold mb-1 ${completada ? 'text-neutral-400 line-through' : 'text-neutral-800'}`}>
                                                {tarea.titulo}
                                            </h3>

                                            {tarea.descripcion && (
                                                <p className="text-neutral-500 text-sm mb-2">
                                                    {tarea.descripcion}
                                                </p>
                                            )}

                                            {tarea.fecha_expiracion && (
                                                <p className={`text-xs font-semibold ${vencida && !completada ? 'text-red-400' : 'text-neutral-400'}`}>
                                                    {vencida && !completada ? '⚠ Vencida · ' : 'Vence · '}
                                                    {formatearFecha(tarea.fecha_expiracion)}
                                                </p>
                                            )}
                                        </div>

                                        {/* Badge de estado */}
                                        <div className="flex-shrink-0">
                                            {completada ? (
                                                <span className="text-xs font-semibold bg-activa-teal/10 text-activa-dark-teal border border-activa-teal/20 px-2.5 py-1 rounded-full">
                                                    Completada
                                                </span>
                                            ) : vencida ? (
                                                <span className="text-xs font-semibold bg-red-50 text-red-400 border border-red-100 px-2.5 py-1 rounded-full">
                                                    Vencida
                                                </span>
                                            ) : (
                                                <span className="text-xs font-semibold bg-activa-amber/10 text-amber-700 border border-activa-amber/20 px-2.5 py-1 rounded-full">
                                                    Pendiente
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </Layout>
    );
};
