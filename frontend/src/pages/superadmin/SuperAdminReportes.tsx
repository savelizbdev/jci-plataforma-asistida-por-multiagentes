/**
 * Centro de Reportes para Super Administrador (Spec 004)
 * Permite emitir reportes PDF consolidados de la organización o acotados a un programa activo.
 */
import React, { useState, useEffect } from 'react';
import { Layout } from '../../components/common/Layout';
import { useAuth } from '../../hooks/useAuth';
import { SUPERADMIN_MENU_ITEMS } from '../../constants/superAdminMenu';
import { SuperAdminFilterBar } from '../../components/superadmin/SuperAdminFilterBar';
import { useSuperAdminFilters } from '../../context/SuperAdminFilterContext';
import { reporteService } from '../../services/reporteService';
import { superAdminService } from '../../services/superAdminService';
import { SuperAdminUsuario } from '../../types/superAdmin';
import toast, { Toaster } from 'react-hot-toast';

export const SuperAdminReportes: React.FC = () => {
    const { logout } = useAuth();
    const { selectedOrgId, selectedProgId, organizaciones, programas } = useSuperAdminFilters();

    const [fechaInicio, setFechaInicio] = useState('2025-01-01');
    const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);

    // Listas para selectores específicos
    const [mentores, setMentores] = useState<SuperAdminUsuario[]>([]);
    const [emprendedores, setEmprendedores] = useState<SuperAdminUsuario[]>([]);
    const [selectedMentorId, setSelectedMentorId] = useState('');
    const [selectedEmprendedorId, setSelectedEmprendedorId] = useState('');

    const [generating, setGenerating] = useState<string | null>(null);

    // Cargar mentores y emprendedores de la organización para los selectores individuales
    useEffect(() => {
        if (!selectedOrgId) {
            setMentores([]);
            setEmprendedores([]);
            return;
        }

        const cargarParticipantes = async () => {
            try {
                const progId = selectedProgId === 'todos' ? null : selectedProgId;
                const asigRes = await superAdminService.obtenerAsignaciones(selectedOrgId, progId, 1, 1, 1, 100);
                setMentores(asigRes.mentores.items);

                // Emprendedores: juntar sin mentor y con mentor
                const uRes = await superAdminService.obtenerUsuariosPaginados(selectedOrgId, progId, 1, 100);
                const emps = uRes.items.filter((u) => u.id_rol === 2);
                setEmprendedores(emps);
            } catch (error) {
                console.error('Error cargando participantes para reportes:', error);
            }
        };

        cargarParticipantes();
    }, [selectedOrgId, selectedProgId]);

    const descargarBlob = (blob: Blob, nombreArchivo: string) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const orgActual = organizaciones.find((o) => o.id_organizacion === selectedOrgId);
    const progIdActivo = selectedProgId === 'todos' ? null : selectedProgId;
    const progActual = programas.find((p) => p.id_programa === progIdActivo);

    // 1. Reporte de Todos los Emprendedores
    const handleGenerarTodosEmprendedores = async () => {
        if (!selectedOrgId) return;
        setGenerating('todos-emprendedores');
        try {
            const blob = await reporteService.generarReporteAdmin({
                fecha_inicio: new Date(`${fechaInicio}T00:00:00Z`).toISOString(),
                fecha_fin: new Date(`${fechaFin}T23:59:59Z`).toISOString(),
                id_programa: progIdActivo,
            });
            const etiqueta = progActual ? progActual.nombre_programa.replace(/\s+/g, '_') : 'Consolidado';
            descargarBlob(blob, `Reporte_Emprendedores_${etiqueta}.pdf`);
            toast.success('Reporte generado correctamente');
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Error al generar reporte');
        } finally {
            setGenerating(null);
        }
    };

    // 2. Reporte Comparativo de Mentores
    const handleGenerarTodosMentores = async () => {
        if (!selectedOrgId) return;
        setGenerating('todos-mentores');
        try {
            const blob = await reporteService.generarReporteTodosMentores(undefined, progIdActivo);
            const etiqueta = progActual ? progActual.nombre_programa.replace(/\s+/g, '_') : 'Consolidado';
            descargarBlob(blob, `Reporte_Comparativo_Mentores_${etiqueta}.pdf`);
            toast.success('Reporte comparativo generado correctamente');
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Error al generar reporte de mentores');
        } finally {
            setGenerating(null);
        }
    };

    // 3. Reporte de Mentor Específico
    const handleGenerarMentorEspecifico = async () => {
        if (!selectedMentorId) {
            toast.error('Seleccione un mentor');
            return;
        }
        setGenerating('mentor-especifico');
        try {
            const blob = await reporteService.generarReporteMentor({
                id_mentor: selectedMentorId,
                id_programa: progIdActivo,
            });
            const m = mentores.find((item) => item.id_usuario === selectedMentorId);
            const mNom = m ? `${m.nombre}_${m.apellido}` : 'Mentor';
            descargarBlob(blob, `Reporte_Mentor_${mNom}.pdf`);
            toast.success('Reporte individual del mentor generado');
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Error al generar reporte del mentor');
        } finally {
            setGenerating(null);
        }
    };

    // 4. Reporte de Emprendedor Específico
    const handleGenerarEmprendedorEspecifico = async () => {
        if (!selectedEmprendedorId) {
            toast.error('Seleccione un emprendedor');
            return;
        }
        setGenerating('emprendedor-especifico');
        try {
            const blob = await reporteService.generarReporteEmprendedor({
                id_emprendedor: selectedEmprendedorId,
                id_programa: progIdActivo,
            });
            const e = emprendedores.find((item) => item.id_usuario === selectedEmprendedorId);
            const eNom = e ? `${e.nombre}_${e.apellido}` : 'Emprendedor';
            descargarBlob(blob, `Reporte_Emprendedor_${eNom}.pdf`);
            toast.success('Reporte individual del emprendedor generado');
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Error al generar reporte del emprendedor');
        } finally {
            setGenerating(null);
        }
    };

    return (
        <Layout menuItems={SUPERADMIN_MENU_ITEMS} onLogout={logout}>
            <Toaster position="top-right" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Encabezado */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Centro de Reportes</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Genera y descarga informes ejecutivos en PDF filtrados por organización y programa.
                    </p>
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
                            Por favor, seleccione una organización en el filtro superior para acceder a los informes ejecutivos.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Selector de Rango de Fechas */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-8">
                            <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
                                Periodo de Evaluación
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="fecha-inicio-rep" className="block text-xs font-medium text-gray-600 mb-1">
                                        Fecha Inicial
                                    </label>
                                    <input
                                        id="fecha-inicio-rep"
                                        type="date"
                                        value={fechaInicio}
                                        onChange={(e) => setFechaInicio(e.target.value)}
                                        className="w-full h-11 px-3 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="fecha-fin-rep" className="block text-xs font-medium text-gray-600 mb-1">
                                        Fecha Final
                                    </label>
                                    <input
                                        id="fecha-fin-rep"
                                        type="date"
                                        value={fechaFin}
                                        onChange={(e) => setFechaFin(e.target.value)}
                                        className="w-full h-11 px-3 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Tarjetas de Reportes */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* 1. Todos los Emprendedores */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                                <div>
                                    <div className="w-12 h-12 bg-teal-500 text-white rounded-xl flex items-center justify-center mb-4 shadow-sm">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-base font-bold text-gray-900 mb-1">Reporte de Emprendedores</h3>
                                    <p className="text-xs text-gray-500 mb-4">
                                        Descarga el consolidado de participantes evaluados y sin diagnóstico en{' '}
                                        <span className="font-semibold text-gray-700">
                                            {progActual ? progActual.nombre_programa : 'todos los programas de ' + (orgActual?.nombre || '')}
                                        </span>.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleGenerarTodosEmprendedores}
                                    disabled={generating === 'todos-emprendedores'}
                                    className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors shadow-sm"
                                >
                                    {generating === 'todos-emprendedores' ? 'Generando PDF...' : 'Descargar Reporte PDF'}
                                </button>
                            </div>

                            {/* 2. Comparativo de Mentores */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                                <div>
                                    <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center mb-4 shadow-sm">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-base font-bold text-gray-900 mb-1">Comparativo de Mentores</h3>
                                    <p className="text-xs text-gray-500 mb-4">
                                        Métricas de acompañamiento y promedios por área de todos los mentores asignados al programa o consolidado.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleGenerarTodosMentores}
                                    disabled={generating === 'todos-mentores'}
                                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors shadow-sm"
                                >
                                    {generating === 'todos-mentores' ? 'Generando PDF...' : 'Descargar Comparativo PDF'}
                                </button>
                            </div>

                            {/* 3. Mentor Específico */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                                <div>
                                    <div className="w-12 h-12 bg-purple-600 text-white rounded-xl flex items-center justify-center mb-4 shadow-sm">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-base font-bold text-gray-900 mb-1">Mentor Específico</h3>
                                    <p className="text-xs text-gray-500 mb-3">
                                        Historial completo y métricas de desempeño de un mentor particular.
                                    </p>
                                    <div className="mb-4">
                                        <select
                                            value={selectedMentorId}
                                            onChange={(e) => setSelectedMentorId(e.target.value)}
                                            className="w-full h-10 px-3 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-800 focus:ring-2 focus:ring-purple-500"
                                        >
                                            <option value="">-- Seleccione un mentor --</option>
                                            {mentores.map((m) => (
                                                <option key={m.id_usuario} value={m.id_usuario}>
                                                    {m.nombre} {m.apellido}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleGenerarMentorEspecifico}
                                    disabled={!selectedMentorId || generating === 'mentor-especifico'}
                                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors shadow-sm"
                                >
                                    {generating === 'mentor-especifico' ? 'Generando PDF...' : 'Descargar Reporte de Mentor'}
                                </button>
                            </div>

                            {/* 4. Emprendedor Específico */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                                <div>
                                    <div className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center mb-4 shadow-sm">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-base font-bold text-gray-900 mb-1">Emprendedor Específico</h3>
                                    <p className="text-xs text-gray-500 mb-3">
                                        Evolución y respuestas de diagnóstico de un emprendedor concreto.
                                    </p>
                                    <div className="mb-4">
                                        <select
                                            value={selectedEmprendedorId}
                                            onChange={(e) => setSelectedEmprendedorId(e.target.value)}
                                            className="w-full h-10 px-3 bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-800 focus:ring-2 focus:ring-emerald-500"
                                        >
                                            <option value="">-- Seleccione un emprendedor --</option>
                                            {emprendedores.map((e) => (
                                                <option key={e.id_usuario} value={e.id_usuario}>
                                                    {e.nombre} {e.apellido}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleGenerarEmprendedorEspecifico}
                                    disabled={!selectedEmprendedorId || generating === 'emprendedor-especifico'}
                                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors shadow-sm"
                                >
                                    {generating === 'emprendedor-especifico' ? 'Generando PDF...' : 'Descargar Reporte Individual'}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
};
