/**
 * Página de Resultados de Diagnóstico para Super Administrador (Spec 004)
 * Modo estricto de solo lectura y supervisión (auditoría de respuestas, estados y rúbricas IMESUN).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/common/Layout';
import { useAuth } from '../../hooks/useAuth';
import { SUPERADMIN_MENU_ITEMS } from '../../constants/superAdminMenu';
import { SuperAdminFilterBar } from '../../components/superadmin/SuperAdminFilterBar';
import { useSuperAdminFilters } from '../../context/SuperAdminFilterContext';
import { PaginationControls } from '../../components/common/PaginationControls';
import { superAdminService } from '../../services/superAdminService';
import { DiagnosticoSupervisionItem } from '../../types/superAdmin';
import { reporteService } from '../../services/reporteService';
import ReactMarkdown from 'react-markdown';
import toast, { Toaster } from 'react-hot-toast';

export const SuperAdminDiagnosticos: React.FC = () => {
    const { logout } = useAuth();
    const { selectedOrgId, selectedProgId } = useSuperAdminFilters();

    const [diagnosticos, setDiagnosticos] = useState<DiagnosticoSupervisionItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);

    // Modal de inspección de diagnóstico en solo lectura
    const [inspeccionandoItem, setInspeccionandoItem] = useState<DiagnosticoSupervisionItem | null>(null);
    const [descargandoId, setDescargandoId] = useState<string | null>(null);

    const getErrorMessage = (error: any, fallback: string): string => {
        const detail = error?.response?.data?.detail;
        if (typeof detail === 'string') return detail;
        if (Array.isArray(detail) && detail.length > 0) {
            const first = detail[0];
            if (typeof first === 'string') return first;
            if (first && typeof first === 'object' && first.msg) return first.msg;
        }
        if (detail && typeof detail === 'object' && detail.msg) return detail.msg;
        return error?.message || fallback;
    };

    const fetchDiagnosticos = useCallback(async () => {
        if (!selectedOrgId) return;
        setLoading(true);
        try {
            const progId = selectedProgId === 'todos' ? null : selectedProgId;
            const res = await superAdminService.obtenerDiagnosticos(selectedOrgId, progId, page, 15);
            setDiagnosticos(res.items);
            setTotal(res.total);
            setTotalPages(res.total_pages);
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Error al cargar diagnósticos'));
        } finally {
            setLoading(false);
        }
    }, [selectedOrgId, selectedProgId, page]);

    useEffect(() => {
        if (selectedOrgId) {
            fetchDiagnosticos();
        } else {
            setDiagnosticos([]);
        }
    }, [selectedOrgId, selectedProgId, fetchDiagnosticos]);

    const handleDescargarReporteIndividual = async (item: DiagnosticoSupervisionItem) => {
        setDescargandoId(item.id_emprendedor);
        try {
            const blob = await reporteService.generarReporteEmprendedor({
                id_emprendedor: item.id_emprendedor,
                id_programa: item.id_programa,
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Reporte_${item.nombre}_${item.apellido}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success('Reporte descargado correctamente');
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Error al descargar reporte'));
        } finally {
            setDescargandoId(null);
        }
    };

    return (
        <Layout menuItems={SUPERADMIN_MENU_ITEMS} onLogout={logout}>
            <Toaster position="top-right" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Encabezado */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Supervisión de Diagnósticos</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Auditoría en modo de solo lectura de las evaluaciones y puntajes IMESUN (OIT).
                        </p>
                    </div>
                    <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-800 self-start sm:self-auto">
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>Modo Solo Lectura (Supervisión)</span>
                    </div>
                </div>

                {/* Filtro jerárquico */}
                <SuperAdminFilterBar />

                {!selectedOrgId ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
                        <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800">Seleccione una organización</h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                            Por favor, seleccione una organización en el filtro superior para supervisar los diagnósticos.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {loading ? (
                            <div className="p-12 text-center text-gray-500">Cargando diagnósticos...</div>
                        ) : diagnosticos.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                No se registran diagnósticos para el filtro seleccionado.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider text-left">
                                        <tr>
                                            <th className="px-6 py-3.5">Emprendedor</th>
                                            <th className="px-6 py-3.5">Programa</th>
                                            <th className="px-6 py-3.5 text-center">Estado</th>
                                            <th className="px-6 py-3.5 text-center">Puntaje Global</th>
                                            <th className="px-6 py-3.5 text-center">Fecha Inicio</th>
                                            <th className="px-6 py-3.5 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
                                        {diagnosticos.map((item, idx) => (
                                            <tr key={`${item.id_emprendedor}-${item.id_programa}-${idx}`} className="hover:bg-gray-50/80 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="font-semibold text-gray-900">
                                                        {item.nombre} {item.apellido}
                                                    </div>
                                                    {item.emprendimiento && (
                                                        <div className="text-xs text-gray-500">{item.emprendimiento}</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-1 rounded-full">
                                                        {item.nombre_programa}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center whitespace-nowrap">
                                                    <span
                                                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                            item.estado_diagnostico === 'Sin diagnóstico'
                                                                ? 'bg-amber-100 text-amber-800'
                                                                : 'bg-emerald-100 text-emerald-800'
                                                        }`}
                                                    >
                                                        {item.estado_diagnostico}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center whitespace-nowrap">
                                                    {item.promedio_general !== null && item.promedio_general !== undefined ? (
                                                        <span className="font-bold text-gray-900 text-sm">
                                                            {item.promedio_general} / 100
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 italic text-xs">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center text-xs text-gray-500 whitespace-nowrap">
                                                    {item.fecha_inicio
                                                        ? new Date(item.fecha_inicio).toLocaleDateString('es-ES', {
                                                              year: 'numeric',
                                                              month: 'short',
                                                              day: 'numeric',
                                                          })
                                                        : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setInspeccionandoItem(item)}
                                                            className="text-xs font-medium text-teal-600 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors"
                                                        >
                                                            Ver Rúbricas
                                                        </button>
                                                        {item.estado_diagnostico !== 'Sin diagnóstico' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDescargarReporteIndividual(item)}
                                                                disabled={descargandoId === item.id_emprendedor}
                                                                className="text-xs font-medium text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                                            >
                                                                {descargandoId === item.id_emprendedor ? 'Descargando...' : 'Descargar PDF'}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <PaginationControls
                            page={page}
                            totalPages={totalPages}
                            totalItems={total}
                            limit={15}
                            onPageChange={setPage}
                            disabled={loading}
                        />
                    </div>
                )}
            </div>

            {/* Modal de Inspección de Rúbricas (Solo Lectura) */}
            {inspeccionandoItem && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl border border-gray-100 animate-fadeIn">
                        <div className="flex items-start justify-between pb-4 border-b border-gray-100 mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">
                                    Diagnóstico: {inspeccionandoItem.nombre} {inspeccionandoItem.apellido}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                    {inspeccionandoItem.emprendimiento && (
                                        <span className="text-xs font-semibold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200">
                                            {inspeccionandoItem.emprendimiento}
                                        </span>
                                    )}
                                    <span className="text-xs text-gray-500">
                                        Programa: <span className="font-semibold text-gray-700">{inspeccionandoItem.nombre_programa}</span>
                                    </span>
                                    {inspeccionandoItem.resultado && (
                                        <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                                            {inspeccionandoItem.resultado}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <span className="text-xs font-semibold px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full shrink-0">
                                Solo Lectura
                            </span>
                        </div>

                        {inspeccionandoItem.estado_diagnostico === 'Sin diagnóstico' ? (
                            <div className="py-8 text-center text-gray-500 text-sm">
                                Este participante aún no cuenta con una evaluación completada en este programa.
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-teal-50/60 p-4 rounded-xl border border-teal-100 flex items-center justify-between">
                                    <span className="font-bold text-gray-800 text-sm">Puntaje Global IMESUN (OIT)</span>
                                    <span className="text-xl font-extrabold text-teal-700">
                                        {inspeccionandoItem.promedio_general !== null && inspeccionandoItem.promedio_general !== undefined
                                            ? `${inspeccionandoItem.promedio_general} / 100`
                                            : '-'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <div className="text-xs text-gray-500 font-medium">Costos (CF)</div>
                                        <div className="text-base font-bold text-gray-800 mt-1">{inspeccionandoItem.promedio_cf ?? '-'}</div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <div className="text-xs text-gray-500 font-medium">Gobernanza (GP)</div>
                                        <div className="text-base font-bold text-gray-800 mt-1">{inspeccionandoItem.promedio_gp ?? '-'}</div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <div className="text-xs text-gray-500 font-medium">Mercadeo (M)</div>
                                        <div className="text-base font-bold text-gray-800 mt-1">{inspeccionandoItem.promedio_m ?? '-'}</div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <div className="text-xs text-gray-500 font-medium">Ventas (V)</div>
                                        <div className="text-base font-bold text-gray-800 mt-1">{inspeccionandoItem.promedio_v ?? '-'}</div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <div className="text-xs text-gray-500 font-medium">Operaciones (TP)</div>
                                        <div className="text-base font-bold text-gray-800 mt-1">{inspeccionandoItem.promedio_tp ?? '-'}</div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <div className="text-xs text-gray-500 font-medium">Talento (RH)</div>
                                        <div className="text-base font-bold text-gray-800 mt-1">{inspeccionandoItem.promedio_rh ?? '-'}</div>
                                    </div>
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <div className="text-xs text-gray-500 font-medium">Estrategia (EC)</div>
                                        <div className="text-base font-bold text-gray-800 mt-1">{inspeccionandoItem.promedio_ec ?? '-'}</div>
                                    </div>
                                </div>

                                {inspeccionandoItem.conclusion && (
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Conclusión</h4>
                                        <div className="text-xs text-slate-600 prose prose-sm max-w-none">
                                            <ReactMarkdown>{inspeccionandoItem.conclusion}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}

                                {inspeccionandoItem.recomendaciones && (
                                    <div className="bg-teal-50/50 p-4 rounded-xl border border-teal-100">
                                        <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-1.5">Recomendaciones</h4>
                                        <div className="text-xs text-teal-900 prose prose-sm max-w-none">
                                            <ReactMarkdown>{inspeccionandoItem.recomendaciones}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}

                                {inspeccionandoItem.inconsistencias && (
                                    <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200">
                                        <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1.5">Inconsistencias Detectadas</h4>
                                        <div className="text-xs text-amber-900 prose prose-sm max-w-none">
                                            <ReactMarkdown>{inspeccionandoItem.inconsistencias}</ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-6 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setInspeccionandoItem(null)}
                                className="px-5 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};
