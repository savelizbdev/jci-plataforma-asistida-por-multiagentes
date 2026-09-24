/**
 * Página Home para Emprendedor
 * Tablero de Progreso — con sidebar, KPIs de tareas, mentor info, CTA de diagnóstico
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/common/Layout';
import { MenuItem } from '../components/common/Sidebar';
import { ProfileFormModal, ProfileFormData } from '../components/auth/ProfileFormModal';
import { authService } from '../services/authService';
import { api } from '../services/api';
import { obtenerMisTareas, marcarTareaCompletada, Tarea } from '../services/tareaService';
import toast, { Toaster } from 'react-hot-toast';

const menuItems: MenuItem[] = [
    { label: 'Inicio', path: '/emprendedor/home' },
    { label: 'Mis Tareas', path: '/emprendedor/tareas' },
    { label: 'Diagnóstico IA', path: '/emprendedor/diagnostico-ia' },
];

export const HomeEmprendedor = () => {
    // ─── Auth (única instancia — no duplicar) ───────────────────────────────────
    const { user, logout, setUser } = useAuth();
    const navigate = useNavigate();

    // ─── Estado ─────────────────────────────────────────────────────────────────
    const [showProfileModal, setShowProfileModal] = useState(!user?.nombre);
    const [mentorInfo, setMentorInfo] = useState<{ nombre: string; apellido: string; email: string } | null>(null);
    const [loadingMentor, setLoadingMentor] = useState(true);
    const [tareas, setTareas] = useState<Tarea[]>([]);
    const [loadingTareas, setLoadingTareas] = useState(true);

    // ─── Cargar mentor asignado ──────────────────────────────────────────────────
    useEffect(() => {
        if (!user) return;
        const fetchMentor = async () => {
            try {
                const response = await api.get(`/asignaciones/mi-mentor?user_id=${user.id_usuario}`);
                setMentorInfo(response.data.mentor);
            } catch {
                // Sin mentor asignado — estado nulo es válido
            } finally {
                setLoadingMentor(false);
            }
        };
        fetchMentor();
    }, [user]);

    // ─── Cargar tareas para KPIs y preview ─────────────────────────────────────
    useEffect(() => {
        if (!user?.id_usuario) return;
        const fetchTareas = async () => {
            try {
                const data = await obtenerMisTareas(user.id_usuario);
                setTareas(data);
            } catch {
                // Error silencioso — los KPIs quedarán en 0
            } finally {
                setLoadingTareas(false);
            }
        };
        fetchTareas();
    }, [user]);

    // ─── Handlers ───────────────────────────────────────────────────────────────
    const handleProfileSubmit = async (formData: ProfileFormData) => {
        if (!user) return;
        try {
            const updatedUser = await authService.updateUserProfile(user.id_usuario, {
                nombre: formData.nombre,
                apellido: formData.apellido,
                sexo: formData.sexo,
                fecha_nacimiento: formData.fecha_nacimiento,
                celular: parseInt(formData.celular),
            });
            setUser(updatedUser);
            setShowProfileModal(false);
        } catch (error) {
            console.error('Error al actualizar perfil:', error);
            alert('Error al guardar los datos. Por favor, intenta de nuevo.');
        }
    };

    const handleMarcarCompletada = async (idTarea: number) => {
        if (!user?.id_usuario) return;
        try {
            await marcarTareaCompletada(idTarea, user.id_usuario);
            toast.success('Tarea completada');
            const updated = await obtenerMisTareas(user.id_usuario);
            setTareas(updated);
        } catch {
            toast.error('Error al completar la tarea');
        }
    };

    // ─── Datos derivados ─────────────────────────────────────────────────────────
    const pendientes = tareas.filter(t => t.estado !== 'Completada');
    const completadas = tareas.filter(t => t.estado === 'Completada');
    const ultimasTresPendientes = pendientes.slice(0, 3);
    const habilitado = user?.habilitado_diag ?? false;

    const estaVencida = (fecha: string | null) => fecha ? new Date(fecha) < new Date() : false;

    const formatearFecha = (fecha: string) =>
        new Date(fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

    // ─── Render ──────────────────────────────────────────────────────────────────
    return (
        <Layout menuItems={menuItems} onLogout={logout}>
            <Toaster position="top-right" />

            <div className="max-w-5xl mx-auto">

                {/* ── Header compacto ─────────────────────────────────────────── */}
                <div className="mb-8 sm:mb-10 flex items-center gap-4 pb-5 border-b border-slate-100">
                    {/* Logo Activa Mujer */}
                    <img
                        src="/logo-activa-mujer.webp"
                        alt="Activa Mujer"
                        className="h-14 sm:h-16 w-auto object-contain flex-shrink-0"
                    />
                    <div className="h-12 w-px bg-slate-200 flex-shrink-0"></div>

                    {/* Saludo */}
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-800 tracking-tight truncate">
                            ¡Hola, {user?.nombre || 'Emprendedora'}!
                        </h1>
                        <p className="text-neutral-400 text-xs sm:text-sm font-medium">
                            Tu panel de emprendimiento
                        </p>
                    </div>

                    {/* Badge de habilitación */}
                    <div className={`hidden sm:flex flex-shrink-0 items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border ${
                        habilitado
                            ? 'bg-activa-teal/5 text-activa-dark-teal border-activa-teal/20'
                            : 'bg-activa-amber/5 text-amber-700 border-activa-amber/20'
                    }`}>
                        <span className={`w-2 h-2 rounded-full ${habilitado ? 'bg-activa-teal' : 'bg-activa-amber'}`}></span>
                        {habilitado ? 'Habilitada para diagnóstico' : 'En espera de diagnóstico'}
                    </div>
                </div>

                {/* ── KPI Cards ───────────────────────────────────────────────── */}
                <div className="grid grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-10">
                    {/* Tareas Pendientes */}
                    <div className="group bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-activa-coral/40 to-activa-coral"></div>
                        <div className="flex flex-col h-full">
                            <div className="bg-activa-coral/5 p-2.5 rounded-xl w-fit mb-3 border border-activa-coral/10">
                                <svg className="w-5 h-5 text-activa-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-1">Pendientes</p>
                            <p className="text-2xl sm:text-3xl font-extrabold text-neutral-800">
                                {loadingTareas ? '—' : pendientes.length}
                            </p>
                        </div>
                    </div>

                    {/* Tareas Completadas */}
                    <div className="group bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-activa-teal/40 to-activa-teal"></div>
                        <div className="flex flex-col h-full">
                            <div className="bg-activa-teal/5 p-2.5 rounded-xl w-fit mb-3 border border-activa-teal/10">
                                <svg className="w-5 h-5 text-activa-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-1">Completadas</p>
                            <p className="text-2xl sm:text-3xl font-extrabold text-neutral-800">
                                {loadingTareas ? '—' : completadas.length}
                            </p>
                        </div>
                    </div>

                    {/* Total de Tareas */}
                    <div className="group bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-activa-amber/40 to-activa-amber"></div>
                        <div className="flex flex-col h-full">
                            <div className="bg-activa-amber/5 p-2.5 rounded-xl w-fit mb-3 border border-activa-amber/10">
                                <svg className="w-5 h-5 text-activa-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-1">Total Tareas</p>
                            <p className="text-2xl sm:text-3xl font-extrabold text-neutral-800">
                                {loadingTareas ? '—' : tareas.length}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Fila: Mentor + CTA Diagnóstico ──────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-10">

                    {/* Mentor Card */}
                    <div className={`bg-white rounded-2xl p-5 sm:p-6 border shadow-sm relative overflow-hidden ${
                        mentorInfo ? 'border-slate-100' : 'border-slate-100'
                    }`}>
                        <div className={`absolute top-0 left-0 w-full h-1 ${mentorInfo ? 'bg-gradient-to-r from-activa-teal/40 to-activa-teal' : 'bg-gradient-to-r from-activa-amber/40 to-activa-amber'}`}></div>
                        <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-3">Tu Mentor Asignado</p>
                        <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                mentorInfo ? 'bg-activa-teal/10 border border-activa-teal/15' : 'bg-activa-amber/10 border border-activa-amber/15'
                            }`}>
                                {mentorInfo ? (
                                    <svg className="w-6 h-6 text-activa-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                ) : (
                                    <svg className="w-6 h-6 text-activa-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                {loadingMentor ? (
                                    <p className="text-neutral-400 text-sm">Cargando...</p>
                                ) : mentorInfo ? (
                                    <>
                                        <p className="text-neutral-800 font-bold text-base truncate">
                                            {mentorInfo.nombre} {mentorInfo.apellido}
                                        </p>
                                        <p className="text-neutral-400 text-xs truncate">{mentorInfo.email}</p>
                                    </>
                                ) : (
                                    <p className="text-amber-700 font-medium text-sm">
                                        Aún no tienes un mentor asignado. ¡Pronto se te asignará uno!
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* CTA Diagnóstico IA */}
                    <div
                        className={`rounded-2xl p-5 sm:p-6 border relative overflow-hidden flex flex-col ${
                            habilitado
                                ? 'bg-white border-slate-100 shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all duration-300'
                                : 'bg-slate-50 border-slate-100'
                        }`}
                        onClick={habilitado ? () => navigate('/emprendedor/diagnostico-ia') : undefined}
                    >
                        <div className={`absolute top-0 left-0 w-full h-1 ${habilitado ? 'bg-gradient-to-r from-jci-blue/40 to-activa-coral' : 'bg-gradient-to-r from-slate-200 to-slate-300'}`}></div>
                        <div className="flex items-start gap-3 mb-4">
                            <div className={`p-2.5 rounded-xl flex-shrink-0 ${habilitado ? 'bg-activa-coral/5 border border-activa-coral/10' : 'bg-slate-100 border border-slate-200'}`}>
                                <svg className={`w-6 h-6 ${habilitado ? 'text-activa-coral' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-0.5">Módulo IA — Activa Mujer</p>
                                <h3 className={`font-bold text-base ${habilitado ? 'text-neutral-800' : 'text-neutral-400'}`}>
                                    Diagnóstico con IA
                                </h3>
                            </div>
                            {/* Logo Activa Mujer en la tarjeta IA */}
                            <img
                                src="/logo-activa-mujer.webp"
                                alt="Activa Mujer"
                                className={`h-7 w-auto object-contain flex-shrink-0 transition-opacity duration-300 ${habilitado ? 'opacity-80' : 'opacity-25 grayscale'}`}
                            />
                        </div>
                        <p className={`text-sm mb-4 flex-1 ${habilitado ? 'text-neutral-500' : 'text-neutral-400'}`}>
                            {habilitado
                                ? 'Responde preguntas sobre tu negocio y obtén un análisis detallado de áreas de mejora.'
                                : 'Completa tus tareas pendientes para ser habilitada y realizar tu próximo diagnóstico.'}
                        </p>
                        <button
                            disabled={!habilitado}
                            onClick={habilitado ? () => navigate('/emprendedor/diagnostico-ia') : undefined}
                            className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                                habilitado
                                    ? 'bg-activa-coral text-white hover:bg-activa-coral/90 shadow-sm'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            {habilitado ? (
                                <>
                                    Iniciar Diagnóstico
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </>
                            ) : (
                                'No habilitada aún'
                            )}
                        </button>
                    </div>
                </div>

                {/* ── Tareas Recientes ─────────────────────────────────────────── */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-lg sm:text-xl font-extrabold text-neutral-800 tracking-tight">
                            Tareas Recientes
                        </h2>
                        <button
                            onClick={() => navigate('/emprendedor/tareas')}
                            className="text-sm font-semibold text-jci-blue hover:text-jci-blue/70 transition-colors flex items-center gap-1"
                        >
                            Ver todas
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    {loadingTareas ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-activa-teal"></div>
                        </div>
                    ) : ultimasTresPendientes.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="w-12 h-12 bg-activa-teal/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <svg className="w-6 h-6 text-activa-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <p className="text-neutral-500 font-medium">¡Sin tareas pendientes!</p>
                            <p className="text-neutral-400 text-sm mt-1">Estás al día con tus objetivos.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {ultimasTresPendientes.map((tarea) => {
                                const vencida = estaVencida(tarea.fecha_expiracion);
                                return (
                                    <div key={tarea.id_tarea} className="flex items-start gap-4 p-4 rounded-xl border border-slate-50 bg-slate-50/50 hover:bg-slate-50 transition-colors duration-150">
                                        <div className="pt-0.5">
                                            <input
                                                type="checkbox"
                                                checked={false}
                                                onChange={() => handleMarcarCompletada(tarea.id_tarea)}
                                                className="w-4.5 h-4.5 rounded border-2 border-neutral-300 cursor-pointer hover:border-activa-teal transition-colors"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-neutral-800 font-semibold text-sm truncate">{tarea.titulo}</p>
                                            {tarea.fecha_expiracion && (
                                                <p className={`text-xs mt-0.5 font-medium ${vencida ? 'text-red-400' : 'text-neutral-400'}`}>
                                                    {vencida ? '⚠ Vencida · ' : 'Vence · '}
                                                    {formatearFecha(tarea.fecha_expiracion)}
                                                </p>
                                            )}
                                        </div>
                                        {vencida && (
                                            <span className="flex-shrink-0 text-xs font-semibold bg-red-50 text-red-400 border border-red-100 px-2 py-0.5 rounded-full">
                                                Vencida
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Footer con logos ─────────────────────────────────────────── */}
                <footer className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-neutral-400 text-xs">
                        © 2025 JCI Empresarios La Paz – Incubadora. Todos los derechos reservados.
                    </p>
                    <div className="flex items-center gap-4 opacity-60">
                        <img src="/logo-jci.webp" alt="JCI" className="h-6 w-auto object-contain" />
                        <img src="/logo-activa-mujer.webp" alt="Activa Mujer" className="h-6 w-auto object-contain" />
                    </div>
                </footer>
            </div>

            {/* ── Modal de perfil (usuario nuevo) ───────────────────────────── */}
            {showProfileModal && (
                <ProfileFormModal onSubmit={handleProfileSubmit} />
            )}
        </Layout>
    );
};
