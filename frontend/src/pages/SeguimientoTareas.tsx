/**
 * Página de Seguimiento de Tareas — Panel del Administrador
 * Permite lanzar manualmente el envío determinista de recordatorios de tareas
 * y muestra el historial de ejecuciones con métricas cuantitativas.
 */
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/common/Layout';
import { adminService } from '../services/adminService';
import type { SeguimientoResult } from '../services/adminService';
import { ADMIN_MENU_ITEMS } from '../constants/adminMenu';

interface EjecucionLog {
    id: number;
    timestamp: Date;
    resultado: SeguimientoResult;
    tipo: 'exito' | 'error';
    mensajeError?: string;
}

export const SeguimientoTareas = () => {
    const { user, logout } = useAuth();
    const [loading, setLoading] = useState(false);
    const [historial, setHistorial] = useState<EjecucionLog[]>([]);
    const [contadorId, setContadorId] = useState(1);

    const handleEjecutar = async () => {
        setLoading(true);
        const timestamp = new Date();
        try {
            const result = await adminService.ejecutarSeguimiento(user?.id_usuario);
            setHistorial(prev => [{
                id: contadorId,
                timestamp,
                resultado: result,
                tipo: 'exito',
            }, ...prev]);
            setContadorId(c => c + 1);
        } catch (err: unknown) {
            const apiError = err as { response?: { data?: { detail?: string } }; message?: string };
            const msg = apiError?.response?.data?.detail || apiError?.message || 'Error desconocido al ejecutar el seguimiento';
            setHistorial(prev => [{
                id: contadorId,
                timestamp,
                resultado: { mensaje: 'Error en la ejecución', resumen_agente: msg },
                tipo: 'error',
                mensajeError: msg,
            }, ...prev]);
            setContadorId(c => c + 1);
        } finally {
            setLoading(false);
        }
    };

    const formatTimestamp = (date: Date) => {
        return date.toLocaleString('es-BO', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
    };

    return (
        <Layout menuItems={ADMIN_MENU_ITEMS} onLogout={logout}>
            <div className="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">

                {/* ── Header ────────────────────────────────────────────── */}
                <div className="mb-6 sm:mb-8">
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-800 tracking-tight">
                            Seguimiento de Tareas
                        </h1>
                    </div>
                    <p className="text-neutral-500 text-sm sm:text-base font-medium">
                        Envía recordatorios automáticos a los emprendedores con tareas próximas a vencer
                    </p>
                </div>

                {/* ── Tarjeta principal de acción ───────────────────────── */}
                <div
                    className="relative rounded-3xl overflow-hidden shadow-lg mb-6 sm:mb-8"
                    style={{ background: 'linear-gradient(160deg, #0b1a30 0%, #112B56 40%, #0f5c7a 75%, #0a7060 100%)' }}
                >
                    {/* Circles decorativos */}
                    <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full opacity-10"
                        style={{ background: 'radial-gradient(circle, #00AEEF 0%, transparent 70%)' }} />
                    <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full opacity-10"
                        style={{ background: 'radial-gradient(circle, #3AADA8 0%, transparent 70%)' }} />

                    <div className="relative z-10 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                        {/* Texto */}
                        <div className="flex-1 text-white">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold uppercase tracking-widest text-white/50">
                                    Ejecución Manual
                                </span>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-activa-teal/20 border border-activa-teal/40 text-activa-teal text-xs font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-activa-teal animate-pulse" />
                                    Sistema Automatizado
                                </span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-extrabold mb-2">
                                Lanzar Recordatorios Ahora
                            </h2>
                            <div className="flex flex-wrap gap-3 mt-4">
                                <div className="flex items-center gap-1.5 text-white/50 text-xs">
                                    <svg className="w-4 h-4 text-activa-teal/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                    Envío seguro SMTP
                                </div>
                                <div className="flex items-center gap-1.5 text-white/50 text-xs">
                                    <svg className="w-4 h-4 text-activa-amber/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    Correos consolidados por programa
                                </div>
                            </div>
                        </div>

                        {/* Botón de acción */}
                        <div className="flex flex-col items-center gap-2 shrink-0">
                            <button
                                id="btn-ejecutar-seguimiento"
                                onClick={handleEjecutar}
                                disabled={loading}
                                className={`
                                    relative flex items-center justify-center gap-3
                                    px-8 py-4 rounded-2xl font-bold text-base
                                    transition-all duration-300 shadow-lg
                                    ${loading
                                        ? 'bg-white/10 text-white/50 cursor-not-allowed border border-white/10'
                                        : 'bg-white text-jci-blue hover:bg-white/90 hover:shadow-2xl hover:scale-105 active:scale-95 border border-white/20'
                                    }
                                `}
                            >
                                {loading ? (
                                    <>
                                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        Enviando recordatorios...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                                                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                                                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Ejecutar Ahora
                                    </>
                                )}
                            </button>
                            {loading && (
                                <p className="text-white/40 text-xs text-center max-w-[160px]">
                                    El proceso toma solo unos segundos
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Barra de progreso animada mientras carga */}
                    {loading && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden">
                            <div
                                className="h-full animate-pulse"
                                style={{
                                    background: 'linear-gradient(90deg, transparent 0%, #3AADA8 30%, #00AEEF 60%, #3AADA8 80%, transparent 100%)',
                                    backgroundSize: '200% 100%',
                                    animation: 'shimmer 1.5s infinite linear',
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* ── Historial de ejecuciones ─────────────────────────── */}
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-8">
                    <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="text-base font-extrabold text-neutral-800 tracking-tight">
                            Historial de Ejecuciones
                        </h2>
                        <span className="text-xs text-neutral-400 font-medium">
                            Sesión actual
                        </span>
                    </div>

                    {historial.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
                            <div className="p-4 rounded-full bg-slate-50 mb-4">
                                <svg className="w-10 h-10 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <p className="text-sm font-semibold text-neutral-400 mb-1">Sin ejecuciones aún</p>
                            <p className="text-xs text-neutral-300">Presiona "Ejecutar Ahora" para iniciar el envío de recordatorios</p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-slate-50">
                            {historial.map((log, index) => (
                                <li key={log.id} className={`px-5 sm:px-6 py-4 transition-colors ${index === 0 ? 'bg-slate-50/50' : ''}`}>
                                    <div className="flex items-start gap-3">
                                        {/* Ícono de estado */}
                                        <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${log.tipo === 'exito'
                                            ? 'bg-activa-teal/10'
                                            : 'bg-red-50'
                                            }`}>
                                            {log.tipo === 'exito' ? (
                                                <svg className="w-4 h-4 text-activa-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            )}
                                        </div>

                                        {/* Contenido */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                <span className={`text-xs font-bold uppercase tracking-wider ${log.tipo === 'exito' ? 'text-activa-teal' : 'text-red-500'
                                                    }`}>
                                                    {log.tipo === 'exito' ? 'Completado' : 'Error'}
                                                </span>
                                                {index === 0 && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded bg-jci-blue/10 text-jci-blue font-semibold">
                                                        Más reciente
                                                    </span>
                                                )}

                                                {/* Badges de métricas estructuradas */}
                                                {log.tipo === 'exito' && log.resultado.enviados_exitosos !== undefined && (
                                                    <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            ✓ {log.resultado.enviados_exitosos} enviado{log.resultado.enviados_exitosos !== 1 ? 's' : ''}
                                                        </span>
                                                        {log.resultado.total_tareas !== undefined && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                                                {log.resultado.total_tareas} tarea{log.resultado.total_tareas !== 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                        {log.resultado.total_emprendedores !== undefined && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                                                {log.resultado.total_emprendedores} emprendedor{log.resultado.total_emprendedores !== 1 ? 'es' : ''}
                                                            </span>
                                                        )}
                                                        {(log.resultado.fallidos ?? 0) > 0 && (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                                                                ✕ {log.resultado.fallidos} fallido{log.resultado.fallidos !== 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <p className="text-sm font-semibold text-neutral-700 mb-1">
                                                {log.resultado.mensaje}
                                            </p>
                                            <p className="text-xs text-neutral-500 whitespace-pre-wrap leading-relaxed">
                                                {log.resultado.resumen_agente}
                                            </p>

                                            {/* Desglose de errores si existieron */}
                                            {log.resultado.errores_detalle && log.resultado.errores_detalle.length > 0 && (
                                                <div className="mt-2.5 p-2.5 rounded-xl bg-red-50/70 border border-red-100 text-xs text-red-700 space-y-1">
                                                    <p className="font-bold text-[11px] uppercase tracking-wide text-red-800">
                                                        Detalle de incidencias:
                                                    </p>
                                                    <ul className="list-disc list-inside space-y-0.5">
                                                        {log.resultado.errores_detalle.map((err, i) => (
                                                            <li key={i} className="leading-snug">
                                                                <span className="font-semibold">{err.email || 'Sin correo'}:</span> {err.motivo}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {/* Timestamp */}
                                        <span className="text-xs text-neutral-400 shrink-0 mt-0.5 font-mono">
                                            {formatTimestamp(log.timestamp)}
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

            </div>

            <style>{`
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
            `}</style>
        </Layout>
    );
};
