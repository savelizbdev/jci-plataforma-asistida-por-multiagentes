/**
 * Centro de Reportes — Administrador
 * 4 tipos de reporte: todos mentores, mentor específico, todos emprendedores, emprendedor específico
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/common/Layout';
import { reporteService } from '../services/reporteService';
import { programaService } from '../services/programaService';
import { api } from '../services/api';
import { ADMIN_MENU_ITEMS } from '../constants/adminMenu';

interface Mentor {
    id_usuario: string;
    nombre: string;
    apellido: string;
    programas_ids?: number[];
}

interface Emprendedor {
    id_usuario: string;
    nombre: string;
    apellido: string;
    programas_ids?: number[];
}

interface ProgramaOption {
    id_programa: number;
    nombre_programa: string;
}

type PanelKey = 'todos-mentores' | 'mentor-especifico' | 'todos-emprendedores' | 'emprendedor-especifico';

const PANELS = [
    {
        key: 'todos-mentores' as PanelKey,
        title: 'Todos los Mentores',
        subtitle: 'Comparativa de rendimiento de todos los mentores del sistema',
        icon: (
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        ),
        gradient: 'from-activa-dark-teal to-activa-teal',
        description: 'Genera un reporte PDF con la tabla comparativa de todos los mentores activos y sus indicadores de desempeño.',
        badge: 'Global',
        badgeColor: 'bg-activa-teal/10 text-activa-dark-teal',
    },
    {
        key: 'mentor-especifico' as PanelKey,
        title: 'Mentor Específico',
        subtitle: 'Desempeño detallado de un mentor y sus emprendedores',
        icon: (
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        ),
        gradient: 'from-activa-teal to-activa-dark-teal',
        description: 'Selecciona un mentor para generar su reporte individual con el historial completo de sus emprendedores.',
        badge: 'Por mentor',
        badgeColor: 'bg-activa-teal/10 text-activa-dark-teal',
    },
    {
        key: 'todos-emprendedores' as PanelKey,
        title: 'Todos los Emprendedores',
        subtitle: 'Estadísticas globales del sistema en un rango de fechas',
        icon: (
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        ),
        gradient: 'from-activa-coral to-activa-amber',
        description: 'Reporte agregado de todos los emprendedores con estadísticas por área y evolución en el período seleccionado.',
        badge: 'Global',
        badgeColor: 'bg-activa-coral/10 text-activa-coral',
    },
    {
        key: 'emprendedor-especifico' as PanelKey,
        title: 'Emprendedor Específico',
        subtitle: 'Evolución histórica de un emprendedor individual',
        icon: (
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
        ),
        gradient: 'from-activa-amber to-activa-coral',
        description: 'Selecciona un emprendedor para ver su evolución histórica de diagnósticos con gráfico de línea temporal.',
        badge: 'Individual',
        badgeColor: 'bg-activa-coral/10 text-activa-coral',
    },
];

export const GenerarReportesAdmin = () => {
    const { user, logout } = useAuth();

    // Programas
    const [programas, setProgramas] = useState<ProgramaOption[]>([]);
    const [selectedPrograma, setSelectedPrograma] = useState<string>(''); // '' = Todos los programas
    const [loadingProgramas, setLoadingProgramas] = useState(false);

    // Estado por panel
    const [activePanel, setActivePanel] = useState<PanelKey | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Datos para selects
    const [mentores, setMentores] = useState<Mentor[]>([]);
    const [emprendedores, setEmprendedores] = useState<Emprendedor[]>([]);
    const [loadingLists, setLoadingLists] = useState(false);

    // Formularios
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [selectedMentor, setSelectedMentor] = useState('');
    const [selectedEmprendedor, setSelectedEmprendedor] = useState('');

    // Cargar programas del admin
    useEffect(() => {
        if (!user?.id_usuario) return;
        const cargarProgramas = async () => {
            try {
                setLoadingProgramas(true);
                const progs = await programaService.obtenerMisProgramas(user.id_usuario);
                setProgramas(progs.map(p => ({
                    id_programa: p.id_programa,
                    nombre_programa: p.nombre_programa
                })));
            } catch (e) {
                console.error('Error cargando programas del administrador:', e);
            } finally {
                setLoadingProgramas(false);
            }
        };
        cargarProgramas();
    }, [user?.id_usuario]);

    // Cargar listas al abrir paneles que las necesitan
    useEffect(() => {
        if (!user?.id_usuario) return;
        if (activePanel === 'mentor-especifico' || activePanel === 'emprendedor-especifico') {
            fetchLists();
        }
    }, [activePanel, user?.id_usuario]);

    const fetchLists = async () => {
        if (!user?.id_usuario) return;
        setLoadingLists(true);
        try {
            const [mentRes, empRes] = await Promise.all([
                api.get('/asignaciones/mentores', { params: { admin_id: user.id_usuario } }),
                api.get('/asignaciones/todos-emprendedores', { params: { admin_id: user.id_usuario } }),
            ]);
            setMentores(mentRes.data || []);
            setEmprendedores(empRes.data || []);
        } catch (e) {
            console.error('Error cargando listas:', e);
        } finally {
            setLoadingLists(false);
        }
    };

    const resetFeedback = () => {
        setError(null);
        setSuccess(null);
    };

    const handleProgramaChange = (progId: string) => {
        setSelectedPrograma(progId);
        resetFeedback();
        // Si el mentor o emprendedor seleccionado no pertenece al programa, resetear selección
        if (progId) {
            const pid = Number(progId);
            if (selectedMentor && !mentores.find(m => m.id_usuario === selectedMentor)?.programas_ids?.includes(pid)) {
                setSelectedMentor('');
            }
            if (selectedEmprendedor && !emprendedores.find(e => e.id_usuario === selectedEmprendedor)?.programas_ids?.includes(pid)) {
                setSelectedEmprendedor('');
            }
        }
    };

    const downloadPdf = (blob: Blob, filename: string) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    };

    const handleGenerar = async () => {
        resetFeedback();

        try {
            setLoading(true);
            let blob: Blob;
            const idProgramaNum = selectedPrograma ? Number(selectedPrograma) : null;

            if (activePanel === 'todos-mentores') {
                blob = await reporteService.generarReporteTodosMentores(user?.id_usuario, idProgramaNum);
                downloadPdf(blob, `reporte_todos_mentores.pdf`);

            } else if (activePanel === 'mentor-especifico') {
                if (!selectedMentor) { setError('Selecciona un mentor'); return; }
                blob = await reporteService.generarReporteMentor({
                    id_mentor: selectedMentor,
                    id_programa: idProgramaNum
                });
                const m = mentores.find(x => x.id_usuario === selectedMentor);
                downloadPdf(blob, `reporte_mentor_${m?.apellido || 'desconocido'}.pdf`);

            } else if (activePanel === 'todos-emprendedores') {
                if (!fechaInicio || !fechaFin) { setError('Selecciona ambas fechas'); return; }
                if (new Date(fechaFin) <= new Date(fechaInicio)) { setError('La fecha fin debe ser posterior a la de inicio'); return; }
                blob = await reporteService.generarReporteAdmin({
                    fecha_inicio: new Date(fechaInicio).toISOString(),
                    fecha_fin: new Date(fechaFin).toISOString(),
                    admin_id: user?.id_usuario,
                    id_programa: idProgramaNum,
                });
                downloadPdf(blob, `reporte_todos_emprendedores_${fechaInicio}_${fechaFin}.pdf`);

            } else if (activePanel === 'emprendedor-especifico') {
                if (!selectedEmprendedor) { setError('Selecciona un emprendedor'); return; }
                blob = await reporteService.generarReporteEmprendedor({
                    id_emprendedor: selectedEmprendedor,
                    id_programa: idProgramaNum
                });
                const e = emprendedores.find(x => x.id_usuario === selectedEmprendedor);
                downloadPdf(blob, `reporte_emprendedor_${e?.apellido || 'desconocido'}.pdf`);
            }

            setSuccess('✓ Reporte generado y descargado exitosamente');
            setTimeout(() => setSuccess(null), 4000);
        } catch (err: any) {
            const msg = err.response?.data?.detail || 'Error al generar el reporte';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const togglePanel = (key: PanelKey) => {
        resetFeedback();
        setActivePanel(prev => (prev === key ? null : key));
    };

    // Listas filtradas según el programa seleccionado
    const mentoresFiltrados = selectedPrograma
        ? mentores.filter(m => m.programas_ids?.includes(Number(selectedPrograma)))
        : mentores;

    const emprendedoresFiltrados = selectedPrograma
        ? emprendedores.filter(e => e.programas_ids?.includes(Number(selectedPrograma)))
        : emprendedores;

    return (
        <Layout menuItems={ADMIN_MENU_ITEMS} onLogout={logout}>
            <div className="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">

                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-800 tracking-tight mb-1">
                        Centro de Reportes
                    </h1>
                    <p className="text-sm text-neutral-500 font-medium">
                        Selecciona el tipo de reporte y filtra por programa según lo requerido
                    </p>
                </div>

                {/* Selector Global de Programa */}
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <label htmlFor="admin-programa-selector" className="block text-sm font-bold text-neutral-800 mb-1">
                                Filtrar por Programa
                            </label>
                            <p className="text-xs text-neutral-500">
                                Selecciona un programa para acotar los datos generados o consulta el consolidado general.
                            </p>
                        </div>
                        <div className="w-full sm:w-80">
                            {loadingProgramas ? (
                                <div className="flex items-center gap-2 text-xs text-neutral-500 py-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-activa-teal"></div>
                                    Cargando programas...
                                </div>
                            ) : (
                                <select
                                    id="admin-programa-selector"
                                    value={selectedPrograma}
                                    onChange={(e) => handleProgramaChange(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-neutral-900 focus:outline-none focus:ring-2 focus:ring-activa-teal/50 focus:border-activa-teal transition-all cursor-pointer"
                                >
                                    <option value="">Todos los programas (Consolidado)</option>
                                    {programas.map((prog) => (
                                        <option key={prog.id_programa} value={prog.id_programa}>
                                            {prog.nombre_programa}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>
                </div>

                {/* Grid de 4 paneles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {PANELS.map((panel) => {
                        const isOpen = activePanel === panel.key;
                        return (
                            <div key={panel.key}
                                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${isOpen ? 'border-activa-teal shadow-md' : 'border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200'}`}>

                                {/* Cabecera del panel (clickable) */}
                                <button
                                    onClick={() => togglePanel(panel.key)}
                                    className="w-full text-left p-5 flex items-start gap-4"
                                >
                                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${panel.gradient} flex items-center justify-center shadow-sm`}>
                                        {panel.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <h2 className="text-base font-extrabold text-neutral-800 tracking-tight">{panel.title}</h2>
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${panel.badgeColor}`}>
                                                {panel.badge}
                                            </span>
                                        </div>
                                        <p className="text-xs text-neutral-500 leading-snug">{panel.subtitle}</p>
                                    </div>
                                    <svg
                                        className={`flex-shrink-0 w-5 h-5 text-neutral-400 mt-0.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {/* Contenido expandible */}
                                {isOpen && (
                                    <div className="px-5 pb-5 border-t border-slate-50 pt-4 space-y-4">
                                        {/* Descripción */}
                                        <p className="text-xs text-neutral-600 leading-relaxed">{panel.description}</p>

                                        {/* Feedback */}
                                        {error && (
                                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                                                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                {error}
                                            </div>
                                        )}
                                        {success && (
                                            <div className="p-3 bg-activa-teal/10 border border-activa-teal/30 rounded-xl text-xs text-activa-dark-teal font-medium flex items-center gap-2">
                                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                {success}
                                            </div>
                                        )}

                                        {/* Controles según tipo */}
                                        {panel.key === 'todos-mentores' && (
                                            <div className="bg-activa-teal/5 border border-activa-teal/20 rounded-xl p-3 text-xs text-neutral-700">
                                                <p className="font-semibold text-activa-dark-teal mb-1">
                                                    El reporte incluirá {selectedPrograma ? `(Programa: ${programas.find(p => p.id_programa === Number(selectedPrograma))?.nombre_programa || selectedPrograma})` : '(Consolidado - Todos los programas)'}:
                                                </p>
                                                <ul className="list-disc list-inside space-y-0.5">
                                                    <li>Tabla comparativa de mentores activos</li>
                                                    <li>Promedios por área de cada mentor</li>
                                                    <li>Gráfico de barras comparativo</li>
                                                    <li>Tasa de aprobado de cada grupo</li>
                                                </ul>
                                            </div>
                                        )}

                                        {panel.key === 'mentor-especifico' && (
                                            <div>
                                                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                                                    Selecciona un mentor <span className="text-activa-coral">*</span>
                                                </label>
                                                {loadingLists ? (
                                                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-activa-teal"></div>
                                                        Cargando mentores...
                                                    </div>
                                                ) : (
                                                    <select
                                                        value={selectedMentor}
                                                        onChange={(e) => { setSelectedMentor(e.target.value); resetFeedback(); }}
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-activa-teal/50 focus:border-activa-teal transition-all"
                                                    >
                                                        <option value="">— Selecciona un mentor —</option>
                                                        {mentoresFiltrados.map(m => (
                                                            <option key={m.id_usuario} value={m.id_usuario}>
                                                                {m.nombre} {m.apellido}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                                {mentoresFiltrados.length === 0 && !loadingLists && (
                                                    <p className="mt-1.5 text-xs text-amber-600">
                                                        No hay mentores registrados{selectedPrograma ? ' para este programa' : ''}.
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {panel.key === 'todos-emprendedores' && (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                                                            Fecha inicio <span className="text-activa-coral">*</span>
                                                        </label>
                                                        <input type="date" value={fechaInicio}
                                                            onChange={(e) => { setFechaInicio(e.target.value); resetFeedback(); }}
                                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-activa-teal/50 focus:border-activa-teal transition-all"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                                                            Fecha fin <span className="text-activa-coral">*</span>
                                                        </label>
                                                        <input type="date" value={fechaFin}
                                                            onChange={(e) => { setFechaFin(e.target.value); resetFeedback(); }}
                                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-activa-teal/50 focus:border-activa-teal transition-all"
                                                        />
                                                    </div>
                                                </div>
                                                {selectedPrograma && (
                                                    <p className="text-xs text-activa-teal font-medium">
                                                        Filtrando por programa: {programas.find(p => p.id_programa === Number(selectedPrograma))?.nombre_programa}
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {panel.key === 'emprendedor-especifico' && (
                                            <div>
                                                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                                                    Selecciona un emprendedor <span className="text-activa-coral">*</span>
                                                </label>
                                                {loadingLists ? (
                                                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-activa-teal"></div>
                                                        Cargando emprendedores...
                                                    </div>
                                                ) : (
                                                    <select
                                                        value={selectedEmprendedor}
                                                        onChange={(e) => { setSelectedEmprendedor(e.target.value); resetFeedback(); }}
                                                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-activa-teal/50 focus:border-activa-teal transition-all"
                                                    >
                                                        <option value="">— Selecciona un emprendedor —</option>
                                                        {emprendedoresFiltrados.map(e => (
                                                            <option key={e.id_usuario} value={e.id_usuario}>
                                                                {e.nombre} {e.apellido}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                                {emprendedoresFiltrados.length === 0 && !loadingLists && (
                                                    <p className="mt-1.5 text-xs text-amber-600">
                                                        No hay emprendedores registrados{selectedPrograma ? ' para este programa' : ''}.
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Botón de acción */}
                                        <button
                                            onClick={handleGenerar}
                                            disabled={loading}
                                            className={`w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2 shadow-sm
                                                ${panel.key === 'todos-emprendedores' || panel.key === 'emprendedor-especifico'
                                                    ? 'bg-gradient-to-r from-activa-coral to-activa-amber hover:from-activa-amber hover:to-activa-coral'
                                                    : 'bg-gradient-to-r from-activa-dark-teal to-activa-teal hover:from-activa-teal hover:to-activa-dark-teal'}
                                                disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            {loading ? (
                                                <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                    Generando PDF...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    Generar y Descargar PDF
                                                </>
                                            )}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <p className="mt-6 text-center text-neutral-400 text-xs">
                    El archivo PDF se descargará automáticamente una vez generado
                </p>
            </div>
        </Layout>
    );
};
