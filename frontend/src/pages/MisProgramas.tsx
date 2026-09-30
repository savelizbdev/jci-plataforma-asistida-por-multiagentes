import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/common/Layout';
import { MenuItem } from '../components/common/Sidebar';
import { programaService } from '../services/programaService';
import { ProgramaItem } from '../types/programa';
import { CodigoProgramaModal } from '../components/programas/CodigoProgramaModal';
import toast, { Toaster } from 'react-hot-toast';

export const MisProgramas = () => {
    const { user, logout } = useAuth();
    const [programas, setProgramas] = useState<ProgramaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const isMentor = user?.id_rol === 3;

    const menuItems: MenuItem[] = isMentor
        ? [
            { label: 'Inicio', path: '/mentor/home' },
            { label: 'Diagnósticos', path: '/mentor/diagnosticos' },
            { label: 'Reportes', path: '/mentor/reportes' },
            { label: 'Mis Programas', path: '/mentor/programas' },
        ]
        : [
            { label: 'Inicio', path: '/emprendedor/home' },
            { label: 'Mis Tareas', path: '/emprendedor/tareas' },
            { label: 'Diagnóstico IA', path: '/emprendedor/diagnostico-ia' },
            { label: 'Mis Programas', path: '/emprendedor/programas' },
        ];

    const fetchProgramas = async () => {
        if (!user?.id_usuario) return;
        setLoading(true);
        try {
            const data = await programaService.obtenerMisProgramas(user.id_usuario);
            setProgramas(data);
        } catch (error) {
            console.error('Error al cargar programas:', error);
            toast.error('No se pudieron cargar tus programas');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProgramas();
    }, [user?.id_usuario]);

    return (
        <Layout menuItems={menuItems} onLogout={logout}>
            <Toaster position="top-right" />
            <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-jci-blue to-activa-teal"></div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-50 text-jci-blue border border-primary-100">
                                Programas Activos
                            </span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-800 tracking-tight">
                            Mis Programas
                        </h1>
                        <p className="text-neutral-500 text-sm font-medium tracking-wide mt-1">
                            Consulta las organizaciones y programas en los que estás participando actualmente.
                        </p>
                    </div>

                    <button
                        onClick={() => setShowModal(true)}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-jci-blue hover:bg-primary-600 text-white font-bold rounded-xl shadow-sm hover:shadow transition-all text-sm"
                    >
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Unirse con Código</span>
                    </button>
                </div>

                {/* Lista de Programas */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {[1, 2, 3].map((n) => (
                            <div key={n} className="bg-white rounded-2xl border border-slate-100 p-6 h-48 animate-pulse space-y-4 shadow-sm">
                                <div className="h-5 bg-slate-100 rounded-md w-3/4"></div>
                                <div className="h-4 bg-slate-100 rounded-md w-1/2"></div>
                                <div className="h-10 bg-slate-50 rounded-xl w-full"></div>
                            </div>
                        ))}
                    </div>
                ) : programas.length === 0 ? (
                    <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center space-y-4 shadow-sm max-w-lg mx-auto">
                        <div className="w-16 h-16 rounded-2xl bg-primary-50 text-jci-blue flex items-center justify-center mx-auto">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-neutral-800">Aún no estás enrolado en ningún programa</h3>
                            <p className="text-sm text-neutral-500 max-w-md mx-auto mt-1">
                                Ingresa el código alfanumérico de 8 dígitos proporcionado por tu organización para activar tu acceso.
                            </p>
                        </div>
                        <button
                            onClick={() => setShowModal(true)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-jci-blue hover:bg-primary-600 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
                        >
                            <span>Ingresar Código Ahora</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {programas.map((prog) => (
                            <div
                                key={prog.id_programa}
                                className="group bg-white border border-slate-100 hover:border-jci-blue/30 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-jci-blue to-activa-teal opacity-90"></div>

                                <div>
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-primary-50 text-jci-blue border border-primary-100">
                                            {prog.nombre_organizacion}
                                        </span>
                                        <span className="text-xs font-mono font-bold text-neutral-500 bg-slate-100 px-2 py-0.5 rounded">
                                            {prog.codigo}
                                        </span>
                                    </div>

                                    <h3 className="text-lg font-bold text-neutral-800 group-hover:text-jci-blue transition-colors mb-2">
                                        {prog.nombre_programa}
                                    </h3>
                                </div>

                                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-neutral-400 font-medium">
                                    <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        Miembro activo
                                    </span>
                                    {prog.fecha_union && (
                                        <span>
                                            {new Date(prog.fecha_union).toLocaleDateString('es-ES', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal para ingresar código */}
            {user?.id_usuario && (
                <CodigoProgramaModal
                    isOpen={showModal}
                    userId={user.id_usuario}
                    isDismissable={true}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => {
                        setShowModal(false);
                        fetchProgramas();
                    }}
                />
            )}
        </Layout>
    );
};
