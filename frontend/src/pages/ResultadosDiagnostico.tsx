/**
 * Página de Resultados de Diagnóstico para Mentor
 * Permite ver diagnósticos y conversaciones de emprendedores asignados
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/common/Layout';
import { MenuItem } from '../components/common/Sidebar';
import { LoadingScreen } from '../components/common/LoadingScreen';
import { mentorService } from '../services/mentorService';
import { reporteService } from '../services/reporteService';
import ReactMarkdown from 'react-markdown';
import type {
    EmprendedorAsignado,
    DiagnosticoResumen,
    ConversacionDiagnostico
} from '../types/mentor';
import { createTarea, type TareaCreate } from '../services/tareaService';
import {
    Chart as ChartJS,
    RadialLinearScale,
    PointElement,
    LineElement,
    CategoryScale,
    LinearScale,
    Filler,
    Tooltip,
    Legend
} from 'chart.js';
import { Radar, Line } from 'react-chartjs-2';

// Registrar componentes de Chart.js
ChartJS.register(
    RadialLinearScale,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
);

// Helper: color por resultado
const getResultadoColor = (resultado: string) => {
    if (resultado === 'ACEPTADO' || resultado === 'APROBADO') return { text: 'text-activa-teal', bg: 'bg-activa-teal/10', border: 'border-activa-teal/40', badge: 'bg-activa-teal text-white' };
    if (resultado === 'EXIMIDO')  return { text: 'text-jci-blue',    bg: 'bg-jci-blue/10',    border: 'border-jci-blue/40',    badge: 'bg-jci-blue text-white' };
    return                               { text: 'text-red-500',      bg: 'bg-red-50',         border: 'border-red-200',       badge: 'bg-red-500 text-white' };
};

const menuItems: MenuItem[] = [
    { label: 'Dashboard', path: '/mentor/home' },
    { label: 'Diagnósticos', path: '/mentor/diagnosticos' },
    { label: 'Generar Reportes', path: '/mentor/reportes' },
];

export const ResultadosDiagnostico = () => {
    const { user, logout } = useAuth();
    const [emprendedores, setEmprendedores] = useState<EmprendedorAsignado[]>([]);
    const [selectedEmprendedor, setSelectedEmprendedor] = useState<string>('');
    const [diagnosticos, setDiagnosticos] = useState<DiagnosticoResumen[]>([]);
    const [selectedDiagnostico, setSelectedDiagnostico] = useState<number | null>(null);
    const [conversacion, setConversacion] = useState<ConversacionDiagnostico | null>(null);
    const [showConversacion, setShowConversacion] = useState(false);
    const [loading, setLoading] = useState(true);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_error, setError] = useState<string | null>(null);
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [taskFormData, setTaskFormData] = useState({
        titulo: '',
        descripcion: '',
        fecha_expiracion: ''
    });
    const [taskSuccess, setTaskSuccess] = useState('');
    const [taskError, setTaskError] = useState('');
    const [isCreatingTask, setIsCreatingTask] = useState<boolean>(false);
    const [habilitadoDiag, setHabilitadoDiag] = useState(false);
    const [togglingDiag, setTogglingDiag] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [editingDetalle, setEditingDetalle] = useState<number | null>(null);
    const [editPuntaje, setEditPuntaje] = useState<string>('');
    const [savingCalificacion, setSavingCalificacion] = useState(false);
    const [calificacionError, setCalificacionError] = useState('');



    // Cargar emprendedores al montar
    useEffect(() => {
        const loadEmprendedores = async () => {
            if (!user) return;

            try {
                setLoading(true);
                const data = await mentorService.getEmprendedoresAsignados(user.id_usuario);
                setEmprendedores(data);
            } catch (err) {
                console.error('Error al cargar emprendedores:', err);
                setError('Error al cargar emprendedores');
            } finally {
                setLoading(false);
            }
        };

        loadEmprendedores();
    }, [user]);

    // Cargar diagnósticos cuando se selecciona un emprendedor
    useEffect(() => {
        if (!selectedEmprendedor) {
            setDiagnosticos([]);
            setSelectedDiagnostico(null);
            setConversacion(null);
            setShowConversacion(false);
            return;
        }

        const loadDiagnosticos = async () => {
            try {
                const data = await mentorService.getDiagnosticosEmprendedor(selectedEmprendedor);
                setDiagnosticos(data);
                setSelectedDiagnostico(null);
                setConversacion(null);
                setShowConversacion(false);
            } catch (err) {
                console.error('Error al cargar diagnósticos:', err);
                setDiagnosticos([]);
            }
        };

        loadDiagnosticos();
    }, [selectedEmprendedor]);

    // Sincronizar habilitadoDiag con el emprendedor seleccionado
    useEffect(() => {
        const emp = emprendedores.find(e => e.id_usuario === selectedEmprendedor);
        setHabilitadoDiag(emp?.habilitado_diag ?? false);
    }, [selectedEmprendedor, emprendedores]);

    // Cargar conversación cuando se selecciona un diagnóstico
    useEffect(() => {
        if (!selectedDiagnostico) {
            setConversacion(null);
            setShowConversacion(false);
            return;
        }

        const loadConversacion = async () => {
            try {
                const data = await mentorService.getConversacionDiagnostico(selectedDiagnostico);
                setConversacion(data);
            } catch (err) {
                console.error('Error al cargar conversación:', err);
                setConversacion(null);
            }
        };

        loadConversacion();
    }, [selectedDiagnostico]);

    // Handlers para asignación de tareas
    const handleShowTaskForm = () => {
        setShowTaskForm(true);
        setTaskSuccess('');
        setTaskError('');
    };

    const handleCloseTaskForm = () => {
        setShowTaskForm(false);
        setTaskFormData({ titulo: '', descripcion: '', fecha_expiracion: '' });
        setTaskError('');
    };

    const handleClearTaskForm = () => {
        setTaskFormData({ titulo: '', descripcion: '', fecha_expiracion: '' });
        setTaskError('');
        setTaskSuccess('');
    };

    const handleChangeTaskForm = (field: string, value: string) => {
        setTaskFormData(prev => ({ ...prev, [field]: value }));
        setTaskError('');
    };

    const handleCreateTask = async () => {
        if (!selectedEmprendedor || !selectedDiagnostico) return;

        // Validaciones
        if (!taskFormData.titulo.trim()) {
            setTaskError('El título es obligatorio');
            return;
        }

        if (!taskFormData.fecha_expiracion) {
            setTaskError('La fecha de expiración es obligatoria');
            return;
        }

        // Validar que la fecha sea al menos 1 día en el futuro
        const selectedDate = new Date(taskFormData.fecha_expiracion);
        const minDate = new Date();
        minDate.setDate(minDate.getDate() + 1);

        if (selectedDate <= minDate) {
            setTaskError('La fecha de expiración debe ser al menos 1 día en el futuro');
            return;
        }

        try {
            setIsCreatingTask(true);
            const tareaData: TareaCreate = {
                id_usuario: selectedEmprendedor,
                id_diagnostico: selectedDiagnostico,
                titulo: taskFormData.titulo,
                descripcion: taskFormData.descripcion || undefined,
                fecha_expiracion: new Date(taskFormData.fecha_expiracion).toISOString()
            };

            await createTarea(tareaData);
            setTaskSuccess('✓ Tarea creada exitosamente');
            setTimeout(() => setTaskSuccess(''), 3000);
            handleClearTaskForm();
        } catch (err: any) {
            console.error('Error al crear tarea:', err);
            setTaskError(err.response?.data?.detail || 'Error al crear la tarea');
        } finally {
            setIsCreatingTask(false);
        }
    };

    const handleToggleDiag = async () => {
        if (!selectedEmprendedor || togglingDiag) return;
        const newValue = !habilitadoDiag;
        setTogglingDiag(true);
        try {
            await mentorService.toggleHabilitadoDiag(selectedEmprendedor, newValue);
            setHabilitadoDiag(newValue);
            // Actualizar también la lista local de emprendedores
            setEmprendedores(prev =>
                prev.map(e =>
                    e.id_usuario === selectedEmprendedor
                        ? { ...e, habilitado_diag: newValue }
                        : e
                )
            );
        } catch (err) {
            console.error('Error al cambiar habilitado_diag:', err);
        } finally {
            setTogglingDiag(false);
        }
    };

    const handleGenerarReporteIndividual = async () => {
        if (!selectedEmprendedor) return;
        try {
            setGeneratingPdf(true);
            const request = { id_emprendedor: selectedEmprendedor };
            const pdfBlob = await reporteService.generarReporteEmprendedor(request);
            
            const url = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            const emp = emprendedores.find(e => e.id_usuario === selectedEmprendedor);
            const defaultName = emp ? `${emp.nombre}_${emp.apellido}` : selectedEmprendedor;
            link.download = `reporte_evolucion_${defaultName}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            console.error('Error al generar reporte individual:', err);
            // Si hay error normal lo podríamos mostrar en un toast o un alert rápido
            alert(err.response?.data?.detail || 'Error al generar el reporte individual');
        } finally {
            setGeneratingPdf(false);
        }
    };

    // Handler para actualizar calificación de una respuesta
    const handleUpdateCalificacion = async (idDetalle: number) => {
        const puntaje = parseFloat(editPuntaje);
        if (isNaN(puntaje)) {
            setCalificacionError('Ingresa un número válido');
            return;
        }
        if (puntaje < 0 || puntaje > 100) {
            setCalificacionError('El puntaje debe estar entre 0 y 100');
            return;
        }
        setCalificacionError('');

        try {
            setSavingCalificacion(true);
            const result = await mentorService.updateCalificacion(idDetalle, puntaje);

            // Actualizar el estado local de la conversación
            setConversacion(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    puntaje_total: result.puntaje_total,
                    resultado: result.resultado,
                    areas: {
                        ...prev.areas,
                        [result.area_key]: {
                            ...prev.areas[result.area_key as keyof typeof prev.areas],
                            puntaje: result.puntaje_area
                        }
                    },
                    conversacion: prev.conversacion.map(area => ({
                        ...area,
                        preguntas: area.preguntas.map(qa =>
                            qa.id_detalle === idDetalle
                                ? { ...qa, puntaje }
                                : qa
                        )
                    }))
                };
            });

            // Actualizar también la lista de diagnósticos para el gráfico histórico
            setDiagnosticos(prev => prev.map(d => {
                if (d.id_diagnostico === selectedDiagnostico) {
                    return {
                        ...d,
                        puntaje_total: result.puntaje_total,
                        resultado: result.resultado,
                        [`puntaje_${result.area_key}`]: result.puntaje_area
                    } as typeof d;
                }
                return d;
            }));

            setEditingDetalle(null);
            setEditPuntaje('');
        } catch (err) {
            console.error('Error al actualizar calificación:', err);
        } finally {
            setSavingCalificacion(false);
        }
    };

    // Helper: color del badge de puntaje
    const getPuntajeColor = (p: number) => {
        if (p < 30) return 'bg-red-100 text-red-700 border-red-200';
        if (p <= 65) return 'bg-amber-100 text-amber-700 border-amber-200';
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    };

    // Datos para el gráfico histórico (filtrado hasta el diagnóstico seleccionado)
    const selectedDiag = diagnosticos.find(d => d.id_diagnostico === selectedDiagnostico);
    const historicoDiags = selectedDiag
        ? diagnosticos.filter(d => d.numero <= selectedDiag.numero).sort((a, b) => a.numero - b.numero)
        : [];

    const historicoData = historicoDiags.length > 0 ? {
        labels: historicoDiags.map(d => `#${d.numero}`),
        datasets: [
            {
                label: 'Puntaje Total',
                data: historicoDiags.map(d => d.puntaje_total),
                borderColor: '#3AADA8',
                backgroundColor: 'rgba(58, 173, 168, 0.1)',
                pointBackgroundColor: historicoDiags.map(d =>
                    (d.resultado === 'ACEPTADO' || d.resultado === 'APROBADO') ? '#3AADA8' :
                    d.resultado === 'EXIMIDO'  ? '#00AEEF' :
                    '#EF4444'
                ),
                pointBorderColor: '#fff',
                pointRadius: 6,
                pointHoverRadius: 8,
                fill: true,
                tension: 0.3,
                borderWidth: 2.5,
            }
        ]
    } : null;

    const historicoOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(17, 24, 39, 0.92)',
                titleColor: '#fff',
                bodyColor: '#d1d5db',
                padding: 10,
                displayColors: false,
                callbacks: {
                    label: (ctx: any) => `Puntaje: ${ctx.parsed.y}`,
                    afterLabel: (ctx: any) => {
                        const d = historicoDiags[ctx.dataIndex];
                        return d ? `Resultado: ${d.resultado}` : '';
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                ticks: { color: '#9CA3AF', font: { size: 11 } },
                grid: { color: 'rgba(75, 85, 99, 0.15)' }
            },
            x: {
                ticks: { color: '#9CA3AF', font: { size: 12 } },
                grid: { display: false }
            }
        }
    };

    // Datos para el gráfico radar
    const radarData = conversacion ? {
        labels: [
            'CF',
            'GP',
            'M',
            'V',
            'TP',
            'RH',
            'EC'
        ],
        datasets: [
            {
                label: 'Puntajes por Área',
                data: [
                    conversacion.areas.cf.puntaje,
                    conversacion.areas.gp.puntaje,
                    conversacion.areas.m.puntaje,
                    conversacion.areas.v.puntaje,
                    conversacion.areas.tp.puntaje,
                    conversacion.areas.rh.puntaje,
                    conversacion.areas.ec.puntaje
                ],
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 2,
            }
        ]
    } : null;

    const radarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            r: {
                angleLines: {
                    color: 'rgba(75, 85, 99, 0.4)'
                },
                grid: {
                    color: 'rgba(75, 85, 99, 0.4)'
                },
                pointLabels: {
                    color: '#374151',
                    font: {
                        size: 14
                    }
                },
                ticks: {
                    color: '#6B7280',
                    backdropColor: 'transparent'
                },
                suggestedMin: 0,
                suggestedMax: 100
            }
        },
        plugins: {
            legend: {
                display: false
            }
        }
    };

    // selectedDiag ya definido arriba

    if (loading) {
        return (
            <Layout menuItems={menuItems} onLogout={logout}>
                <LoadingScreen fullScreen={false} message="Cargando resultados del diagnóstico..." />
            </Layout>
        );
    }

    return (
        <Layout menuItems={menuItems} onLogout={logout}>
            <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-800 tracking-tight mb-1">
                            Resultados de Diagnóstico
                        </h1>
                        <p className="text-neutral-500 text-sm font-medium">
                            Visualiza los diagnósticos y conversaciones de tus emprendedores
                        </p>
                    </div>
                    <div className="mt-2 sm:mt-0">
                        <img src="/logo-activa-mujer.webp" alt="Activa Mujer" className="h-14 sm:h-16 w-auto object-contain" />
                    </div>
                </div>

                {/* Selectores */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                    {/* Selector de Emprendedor */}
                    <div>
                        <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                            Seleccionar Emprendedor
                        </label>
                        <select
                            value={selectedEmprendedor}
                            onChange={(e) => setSelectedEmprendedor(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-neutral-800 focus:outline-none focus:ring-2 focus:ring-activa-teal/50 focus:border-activa-teal shadow-sm"
                        >
                            <option value="">-- Selecciona un emprendedor --</option>
                            {emprendedores.map((emp) => (
                                <option key={emp.id_usuario} value={emp.id_usuario}>
                                    {emp.nombre} {emp.apellido} {emp.nombre_emprendimiento ? `- ${emp.nombre_emprendimiento}` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Selector de Diagnóstico */}
                    <div>
                        <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                            Seleccionar Diagnóstico
                        </label>
                        <select
                            value={selectedDiagnostico || ''}
                            onChange={(e) => setSelectedDiagnostico(e.target.value ? Number(e.target.value) : null)}
                            disabled={!selectedEmprendedor}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-neutral-800 focus:outline-none focus:ring-2 focus:ring-activa-teal/50 focus:border-activa-teal shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">-- Selecciona un diagnóstico --</option>
                            {diagnosticos.map((diag) => {
                                const rc = getResultadoColor(diag.resultado);
                                return (
                                    <option key={diag.id_diagnostico} value={diag.id_diagnostico}>
                                        Diagnóstico #{diag.numero} — {diag.resultado} — {new Date(diag.fecha_inicio).toLocaleDateString()}
                                    </option>
                                );
                                void rc;
                            })}
                        </select>
                    </div>
                </div>

                {/* Información del Emprendimiento Seleccionado */}
                {selectedEmprendedor && (() => {
                    const emp = emprendedores.find(e => e.id_usuario === selectedEmprendedor);
                    if (!emp) return null;
                    return (
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm mb-5 flex overflow-hidden">
                            <div className="w-1.5 bg-activa-coral flex-shrink-0"></div>
                            <div className="p-4 flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <svg className="w-5 h-5 text-activa-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                    <span className="font-bold text-neutral-800">{emp.nombre_emprendimiento || 'Sin registrar'}</span>
                                </div>
                                <span className="text-neutral-400">|</span>
                                <span className="font-medium text-neutral-600">{emp.nombre} {emp.apellido}</span>
                                {emp.rubro_emprendimiento && (
                                    <span className="text-xs font-semibold bg-activa-coral/10 text-activa-coral px-3 py-1 rounded-full border border-activa-coral/20">
                                        {emp.rubro_emprendimiento}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })()}

                {/* Estado: Sin selección o diagnóstico pendiente */}
                {!selectedDiagnostico && selectedEmprendedor && diagnosticos.length === 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
                        <div className="text-amber-700 text-lg font-semibold mb-2">
                            Diagnóstico Pendiente
                        </div>
                        <p className="text-amber-600">
                            Este emprendedor aún no ha completado ningún diagnóstico
                        </p>
                    </div>
                )}

                {!selectedEmprendedor && (
                    <div className="bg-white/50 border border-light-border/50 rounded-xl p-12 text-center">
                        <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-neutral-600 text-lg">
                            Selecciona un emprendedor para comenzar
                        </p>
                    </div>
                )}

                {/* Resultados */}
                {selectedDiag && conversacion && (
                    <div className="space-y-5">
                        {/* Tarjeta resumen con badge de estado */}
                        {(() => {
                            const rc = getResultadoColor(conversacion.resultado);
                            return (
                                <div className={`rounded-2xl p-5 border ${rc.border} ${rc.bg} flex flex-wrap items-center gap-6`}>
                                    <div>
                                        <div className="text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-1">Puntaje Total</div>
                                        <div className="text-4xl font-extrabold text-neutral-800">{conversacion.puntaje_total}</div>
                                    </div>
                                    <div>
                                        <div className="text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-1">Resultado</div>
                                        <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold ${rc.badge}`}>
                                            {conversacion.resultado}
                                        </span>
                                    </div>
                                    <div className="ml-auto">
                                        <div className="text-neutral-500 text-xs font-semibold uppercase tracking-wider mb-1">Fecha</div>
                                        <div className="text-base font-semibold text-neutral-700">{ new Date(conversacion.fecha).toLocaleDateString() }</div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Gráfico Histórico de Evolución */}
                        {historicoData && historicoDiags.length > 1 && (
                            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-1 h-5 bg-activa-teal rounded-full"></div>
                                    <h2 className="text-base font-extrabold text-neutral-800 tracking-tight">Evolución Histórica</h2>
                                    <span className="ml-auto text-xs text-neutral-400">Hasta diagnóstico #{selectedDiag.numero}</span>
                                </div>
                                <div className="flex gap-3 mb-2 text-xs text-neutral-500">
                                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-activa-teal"></span>Aprobado</span>
                                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-jci-blue"></span>Eximido</span>
                                    <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500"></span>Observado</span>
                                </div>
                                <div className="h-44">
                                    <Line data={historicoData} options={historicoOptions as any} />
                                </div>
                            </div>
                        )}

                        {/* Grid de 7 Cards de puntaje por área */}
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                            {[
                                { key: 'cf', label: 'Costos y Finanzas',     abbr: 'CF', color: '#F07A5C', bg: 'rgba(240,122,92,0.08)',  border: '#F07A5C40', score: conversacion.areas.cf.puntaje },
                                { key: 'gp', label: 'Gestión y Planificación',    abbr: 'GP', color: '#E8A82E', bg: 'rgba(232,168,46,0.08)',  border: '#E8A82E40', score: conversacion.areas.gp.puntaje },
                                { key: 'm',  label: 'Marketing',             abbr: 'M',  color: '#3AADA8', bg: 'rgba(58,173,168,0.08)', border: '#3AADA840', score: conversacion.areas.m.puntaje  },
                                { key: 'v',  label: 'Ventas',                abbr: 'V',  color: '#1E766F', bg: 'rgba(30,118,111,0.08)', border: '#1E766F40', score: conversacion.areas.v.puntaje  },
                                { key: 'tp', label: 'Tecnología',          abbr: 'TP', color: '#F5C5A3', bg: 'rgba(245,197,163,0.15)',border: '#F5C5A340', score: conversacion.areas.tp.puntaje },
                                { key: 'rh', label: 'Recursos Humanos',            abbr: 'RH', color: '#00AEEF', bg: 'rgba(0,174,239,0.08)',  border: '#00AEEF40', score: conversacion.areas.rh.puntaje },
                                { key: 'ec', label: 'Economía del Cuidado',            abbr: 'EC', color: '#64748B', bg: 'rgba(100,116,139,0.08)',border: '#64748B40', score: conversacion.areas.ec.puntaje },
                            ].map(a => (
                                <div key={a.key}
                                    className="bg-white rounded-xl border overflow-hidden relative"
                                    style={{ borderColor: a.border }}
                                >
                                    <div className="h-1 w-full" style={{ backgroundColor: a.color }}></div>
                                    <div className="p-3" style={{ backgroundColor: a.bg }}>
                                        <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: a.color }}>{a.abbr}</div>
                                        <div className="text-2xl font-extrabold text-neutral-800">{a.score}</div>
                                        <div className="text-xs text-neutral-500 mt-1 leading-tight">{a.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Gráfico Radar */}
                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-1 h-5 bg-activa-teal rounded-full"></div>
                                <h2 className="text-base font-extrabold text-neutral-800 tracking-tight">Análisis por Área</h2>
                            </div>
                            <div className="h-72">
                                {radarData && <Radar data={radarData} options={radarOptions} />}
                            </div>
                        </div>

                        {/* Conclusión */}
                        {conversacion.conclusion && (
                            <div className="bg-white rounded-2xl border-l-4 border-activa-dark-teal shadow-sm overflow-hidden">
                                <div className="p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-7 h-7 rounded-full bg-activa-dark-teal/10 flex items-center justify-center flex-shrink-0">
                                            <svg className="w-4 h-4 text-activa-dark-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <h2 className="text-base font-extrabold text-activa-dark-teal">Conclusión</h2>
                                    </div>
                                    <div className="prose prose-sm max-w-none text-neutral-700 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_p]:mb-2">
                                        <ReactMarkdown>{conversacion.conclusion}</ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Recomendaciones */}
                        {conversacion.recomendaciones && (
                            <div className="bg-white rounded-2xl border-l-4 border-activa-teal shadow-sm overflow-hidden">
                                <div className="p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-7 h-7 rounded-full bg-activa-teal/10 flex items-center justify-center flex-shrink-0">
                                            <svg className="w-4 h-4 text-activa-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                            </svg>
                                        </div>
                                        <h2 className="text-base font-extrabold text-activa-teal">Recomendaciones</h2>
                                    </div>
                                    <div className="prose prose-sm max-w-none text-neutral-700 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_p]:mb-2">
                                        <ReactMarkdown>{conversacion.recomendaciones}</ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Inconsistencias */}
                        {conversacion.inconsistencias && (
                            <div className="bg-white rounded-2xl border-l-4 border-activa-amber shadow-sm overflow-hidden">
                                <div className="p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-7 h-7 rounded-full bg-activa-amber/10 flex items-center justify-center flex-shrink-0">
                                            <svg className="w-4 h-4 text-activa-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                        </div>
                                        <h2 className="text-base font-extrabold text-activa-amber">Inconsistencias Detectadas</h2>
                                    </div>
                                    <div className="prose prose-sm max-w-none text-neutral-700 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_p]:mb-2">
                                        <ReactMarkdown>{conversacion.inconsistencias}</ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Botones de acción */}
                        <div className="flex flex-wrap justify-center items-center gap-3">
                            {/* Ver Conversación */}
                            <button
                                onClick={() => setShowConversacion(!showConversacion)}
                                className="px-6 py-2.5 text-white rounded-xl font-semibold transition-colors flex items-center gap-2 text-sm"
                                style={{ backgroundColor: '#00AEEF' }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#0096CC')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#00AEEF')}
                            >
                                {showConversacion ? (
                                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>Ocultar Conversación</>
                                ) : (
                                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>Ver Conversación</>
                                )}
                            </button>

                            {/* Asignar Tarea */}
                            <button
                                onClick={handleShowTaskForm}
                                disabled={!selectedDiagnostico}
                                className="px-6 py-2.5 bg-activa-teal hover:bg-activa-dark-teal disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors flex items-center gap-2 text-sm"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                                Asignar Tarea
                            </button>

                            {/* Botón Contactar por WhatsApp */}
                            {(() => {
                                const emp = emprendedores.find(e => e.id_usuario === selectedEmprendedor);
                                const celular = emp?.celular;
                                if (!celular) return null;
                                const mensaje = encodeURIComponent(
                                    `Hola ${emp.nombre}, soy uno de los mentores de la incubadora de JCI Empresarios La Paz. He revisado los resultados de tu diagnóstico y me gustaría conversar contigo sobre cómo podemos mejorar tu emprendimiento. ¿Tienes un momento?`
                                );
                                const whatsappUrl = `https://wa.me/591${celular}?text=${mensaje}`;
                                return (
                                    <a
                                        href={whatsappUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-8 py-3 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                                        style={{ backgroundColor: '#25D366' }}
                                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1DA851')}
                                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#25D366')}
                                    >
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                        </svg>
                                        Contactar por WhatsApp
                                    </a>
                                );
                            })()}

                            {/* Botón Generar Reporte Individual */}
                            <button
                                onClick={handleGenerarReporteIndividual}
                                disabled={generatingPdf || !selectedEmprendedor}
                                className="px-6 py-2.5 bg-activa-coral hover:bg-activa-coral/80 disabled:opacity-40 text-white rounded-xl font-semibold transition-colors flex items-center gap-2 text-sm"
                            >
                                {generatingPdf ? (
                                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>Generando...</>
                                ) : (
                                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>Generar Reporte Individual</>
                                )}
                            </button>

                            {/* Toggle Habilitado Diagnóstico */}
                            <div className="flex items-center gap-3 px-5 py-2.5 bg-white rounded-lg border border-gray-200 shadow-sm">
                                <span className="text-sm font-medium text-gray-700">Diagnóstico</span>
                                <button
                                    onClick={handleToggleDiag}
                                    disabled={togglingDiag}
                                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none ${habilitadoDiag ? 'bg-green-500' : 'bg-gray-300'
                                        } ${togglingDiag ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                                >
                                    <span
                                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${habilitadoDiag ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                                <span className={`text-xs font-semibold ${habilitadoDiag ? 'text-green-600' : 'text-red-500'}`}>
                                    {habilitadoDiag ? 'Habilitado' : 'Deshabilitado'}
                                </span>
                            </div>
                        </div>

                        {/* Sección de Conversación (expandible) */}
                        {showConversacion && (
                            <div className="bg-white/80 backdrop-blur-md rounded-xl p-6 border border-light-border/50 shadow-xl animate-fadeIn">
                                <h2 className="text-xl font-semibold text-neutral-900 mb-2">
                                    Conversación Completa
                                </h2>
                                <p className="text-xs text-neutral-500 mb-6 flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Haz click en la calificación de cada respuesta para editarla
                                </p>
                                <div className="space-y-6">
                                    {conversacion.conversacion.map((area) => (
                                        <div key={area.id_area} className="border-l-4 border-primary-500 pl-4">
                                            <h3 className="text-lg font-semibold text-primary-500 mb-4">
                                                {area.area_nombre}
                                            </h3>
                                            <div className="space-y-4">
                                                {area.preguntas.map((qa) => (
                                                    <div key={qa.id_detalle} className="space-y-2">
                                                        {/* Pregunta */}
                                                        <div className="flex justify-start">
                                                            <div className="bg-neutral-50/50 rounded-lg px-4 py-3 max-w-[80%]">
                                                                <div className="text-neutral-700 text-sm">{qa.pregunta}</div>
                                                            </div>
                                                        </div>
                                                        {/* Respuesta + Calificación */}
                                                        <div className="flex justify-end">
                                                            <div className="max-w-[80%]">
                                                                <div className="bg-primary-500/30 rounded-lg px-4 py-3">
                                                                    <div className="text-neutral-900 text-sm">{qa.respuesta}</div>
                                                                </div>
                                                                {/* Badge de calificación editable */}
                                                                <div className="flex justify-end mt-1.5">
                                                                    {editingDetalle === qa.id_detalle ? (
                                                                        <div className="animate-fadeIn">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <input
                                                                                    type="number"
                                                                                    min={0}
                                                                                    max={100}
                                                                                    step={1}
                                                                                    value={editPuntaje}
                                                                                    onChange={(e) => {
                                                                                        const val = e.target.value;
                                                                                        // Permitir campo vacío para borrar y reescribir
                                                                                        if (val === '' || val === '-') {
                                                                                            setEditPuntaje(val);
                                                                                            setCalificacionError('');
                                                                                            return;
                                                                                        }
                                                                                        const num = parseFloat(val);
                                                                                        if (isNaN(num)) return;
                                                                                        // Clamp: no permitir valores fuera de rango
                                                                                        if (num > 100) {
                                                                                            setEditPuntaje('100');
                                                                                            setCalificacionError('Máximo permitido: 100');
                                                                                            return;
                                                                                        }
                                                                                        if (num < 0) {
                                                                                            setEditPuntaje('0');
                                                                                            setCalificacionError('Mínimo permitido: 0');
                                                                                            return;
                                                                                        }
                                                                                        setEditPuntaje(val);
                                                                                        setCalificacionError('');
                                                                                    }}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter') handleUpdateCalificacion(qa.id_detalle);
                                                                                        if (e.key === 'Escape') { setEditingDetalle(null); setEditPuntaje(''); setCalificacionError(''); }
                                                                                    }}
                                                                                    autoFocus
                                                                                    disabled={savingCalificacion}
                                                                                    className={`w-16 px-2 py-1 text-xs font-bold text-center border-2 rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 ${calificacionError ? 'border-red-400 focus:ring-red-300/30' : 'border-primary-500 focus:ring-primary-500/30'}`}
                                                                                />
                                                                                <button
                                                                                    onClick={() => handleUpdateCalificacion(qa.id_detalle)}
                                                                                    disabled={savingCalificacion}
                                                                                    className="p-1 rounded-md bg-activa-teal text-white hover:bg-activa-dark-teal transition-colors disabled:opacity-50"
                                                                                    title="Confirmar"
                                                                                >
                                                                                    {savingCalificacion ? (
                                                                                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                                                    ) : (
                                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                                        </svg>
                                                                                    )}
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => { setEditingDetalle(null); setEditPuntaje(''); setCalificacionError(''); }}
                                                                                    disabled={savingCalificacion}
                                                                                    className="p-1 rounded-md bg-neutral-200 text-neutral-600 hover:bg-neutral-300 transition-colors disabled:opacity-50"
                                                                                    title="Cancelar"
                                                                                >
                                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                                                                    </svg>
                                                                                </button>
                                                                            </div>
                                                                            {calificacionError && (
                                                                                <p className="text-[10px] text-red-500 font-medium mt-0.5 text-right">{calificacionError}</p>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => {
                                                                                setEditingDetalle(qa.id_detalle);
                                                                                setEditPuntaje(String(Math.round(qa.puntaje)));
                                                                            }}
                                                                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border cursor-pointer transition-all hover:scale-105 hover:shadow-sm ${getPuntajeColor(qa.puntaje)}`}
                                                                            title="Click para editar calificación"
                                                                        >
                                                                            <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                            </svg>
                                                                            {Math.round(qa.puntaje)}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Modal Formulario de Tarea */}
                {showTaskForm && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl p-8 max-w-2xl w-full border-t-4 border-t-activa-teal shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-extrabold text-neutral-900 tracking-tight">Asignar Nueva Tarea</h2>
                                <button
                                    onClick={handleCloseTaskForm}
                                    className="text-neutral-400 hover:text-neutral-700 bg-neutral-100/50 hover:bg-neutral-100 rounded-full p-2 transition-colors"
                                    disabled={isCreatingTask}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Mensaje de éxito */}
                            {taskSuccess && (
                                <div className="mb-4 p-3 bg-activa-teal/10 border border-activa-teal/30 rounded-xl flex items-center gap-2 text-activa-dark-teal text-sm font-medium">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    {taskSuccess}
                                </div>
                            )}

                            {/* Mensaje de error */}
                            {taskError && (
                                <div className="mb-4 p-3 bg-activa-coral/10 border border-activa-coral/30 rounded-xl flex items-center gap-2 text-activa-coral text-sm font-medium">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {taskError}
                                </div>
                            )}

                            <div className="space-y-4">
                                {/* Título */}
                                <div>
                                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                                        Título <span className="text-activa-coral">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        lang="es"
                                        value={taskFormData.titulo}
                                        onChange={(e) => handleChangeTaskForm('titulo', e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-activa-teal/50 focus:border-activa-teal transition-all"
                                        placeholder="Ej: Mejorar plan de marketing"
                                        maxLength={200}
                                        disabled={isCreatingTask}
                                    />
                                </div>

                                {/* Descripción */}
                                <div>
                                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                                        Descripción
                                    </label>
                                    <textarea
                                        lang="es"
                                        value={taskFormData.descripcion}
                                        onChange={(e) => handleChangeTaskForm('descripcion', e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-activa-teal/50 focus:border-activa-teal h-32 resize-none transition-all"
                                        placeholder="Detalles adicionales sobre la tarea..."
                                        disabled={isCreatingTask}
                                    />
                                </div>

                                {/* Fecha de Expiración */}
                                <div>
                                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                                        Fecha de Expiración <span className="text-activa-coral">*</span>
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={taskFormData.fecha_expiracion}
                                        onChange={(e) => handleChangeTaskForm('fecha_expiracion', e.target.value)}
                                        min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-activa-teal/50 focus:border-activa-teal transition-all"
                                        disabled={isCreatingTask}
                                    />
                                    <p className="text-xs text-neutral-500 mt-1.5 flex items-center gap-1">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Debe ser al menos 1 día en el futuro
                                    </p>
                                </div>

                                {/* Botones */}
                                <div className="flex gap-3 mt-8 pt-4 border-t border-slate-100">
                                    <button
                                        onClick={handleCreateTask}
                                        disabled={isCreatingTask}
                                        className="flex-1 px-6 py-3 bg-activa-teal hover:bg-activa-dark-teal text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm hover:shadow active:scale-[0.98]"
                                    >
                                        {isCreatingTask ? (
                                            <>
                                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Asignando...
                                            </>
                                        ) : (
                                            'Asignar Tarea'
                                        )}
                                    </button>
                                    <button
                                        onClick={handleClearTaskForm}
                                        disabled={isCreatingTask}
                                        className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors disabled:opacity-50"
                                    >
                                        Limpiar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};
