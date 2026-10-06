/**
 * Página de Asignación de Mentores para Super Administrador (Spec 004)
 * - Auto-selecciona el primer programa activo al ingresar con una organización
 * - Deshabilita asignación y muestra banner orientador cuando está en "Todos los programas"
 * - Maneja paginación independiente de 15 en 15 para las tres listas
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/common/Layout';
import { useAuth } from '../../hooks/useAuth';
import { SUPERADMIN_MENU_ITEMS } from '../../constants/superAdminMenu';
import { SuperAdminFilterBar } from '../../components/superadmin/SuperAdminFilterBar';
import { useSuperAdminFilters } from '../../context/SuperAdminFilterContext';
import { PaginationControls } from '../../components/common/PaginationControls';
import { superAdminService } from '../../services/superAdminService';
import { SuperAdminUsuario, EmprendedorConMentorItem } from '../../types/superAdmin';
import toast, { Toaster } from 'react-hot-toast';

export const SuperAdminAsignarMentores: React.FC = () => {
    const { logout } = useAuth();
    const {
        selectedOrgId,
        selectedProgId,
        programas,
        setSelectedProgId,
    } = useSuperAdminFilters();

    // Estado de selección para asignación activa
    const [mentorSeleccionado, setMentorSeleccionado] = useState<string>('');
    const [emprendedoresSeleccionados, setEmprendedoresSeleccionados] = useState<Set<string>>(new Set());

    // Listas paginadas
    const [mentores, setMentores] = useState<SuperAdminUsuario[]>([]);
    const [totalMentores, setTotalMentores] = useState(0);
    const [pageMentores, setPageMentores] = useState(1);
    const [totalPagesMentores, setTotalPagesMentores] = useState(1);

    const [sinMentor, setSinMentor] = useState<SuperAdminUsuario[]>([]);
    const [totalSinMentor, setTotalSinMentor] = useState(0);
    const [pageSinMentor, setPageSinMentor] = useState(1);
    const [totalPagesSinMentor, setTotalPagesSinMentor] = useState(1);

    const [conMentor, setConMentor] = useState<EmprendedorConMentorItem[]>([]);
    const [totalConMentor, setTotalConMentor] = useState(0);
    const [pageConMentor, setPageConMentor] = useState(1);
    const [totalPagesConMentor, setTotalPagesConMentor] = useState(1);

    const [loading, setLoading] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [quitandoId, setQuitandoId] = useState<string | null>(null);

    // Auto-selección del primer programa activo si no se ha elegido uno específico
    useEffect(() => {
        if (selectedOrgId && programas.length > 0) {
            if (selectedProgId === null || selectedProgId === 'todos') {
                setSelectedProgId(programas[0].id_programa);
            }
        }
    }, [selectedOrgId, programas, selectedProgId, setSelectedProgId]);

    // Cargar datos de asignaciones
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

    const fetchAsignaciones = useCallback(async () => {
        if (!selectedOrgId) return;
        setLoading(true);
        try {
            const progId = selectedProgId === 'todos' ? null : selectedProgId;
            const res = await superAdminService.obtenerAsignaciones(
                selectedOrgId,
                progId,
                pageMentores,
                pageSinMentor,
                pageConMentor,
                15
            );
            setMentores(res.mentores.items);
            setTotalMentores(res.mentores.total);
            setTotalPagesMentores(res.mentores.total_pages);

            setSinMentor(res.emprendedores_sin_mentor.items);
            setTotalSinMentor(res.emprendedores_sin_mentor.total);
            setTotalPagesSinMentor(res.emprendedores_sin_mentor.total_pages);

            setConMentor(res.emprendedores_con_mentor.items);
            setTotalConMentor(res.emprendedores_con_mentor.total);
            setTotalPagesConMentor(res.emprendedores_con_mentor.total_pages);
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Error al cargar asignaciones'));
        } finally {
            setLoading(false);
        }
    }, [selectedOrgId, selectedProgId, pageMentores, pageSinMentor, pageConMentor]);

    useEffect(() => {
        if (selectedOrgId) {
            fetchAsignaciones();
        } else {
            setMentores([]);
            setSinMentor([]);
            setConMentor([]);
        }
    }, [selectedOrgId, selectedProgId, fetchAsignaciones]);

    // Manejar selección de emprendedor para asignación
    const toggleEmprendedor = (idUsuario: string) => {
        const next = new Set(emprendedoresSeleccionados);
        if (next.has(idUsuario)) {
            next.delete(idUsuario);
        } else {
            next.add(idUsuario);
        }
        setEmprendedoresSeleccionados(next);
    };

    // Asignar seleccionados
    const handleAsignar = async () => {
        if (!mentorSeleccionado) {
            toast.error('Debe seleccionar un mentor de la lista');
            return;
        }
        if (emprendedoresSeleccionados.size === 0) {
            toast.error('Debe seleccionar al menos un emprendedor');
            return;
        }

        setGuardando(true);
        try {
            await superAdminService.asignarMentor(mentorSeleccionado, Array.from(emprendedoresSeleccionados));
            toast.success('Emprendedores asignados exitosamente');
            setEmprendedoresSeleccionados(new Set());
            setMentorSeleccionado('');
            fetchAsignaciones();
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Error al asignar mentor'));
        } finally {
            setGuardando(false);
        }
    };

    // Quitar asignación
    const handleDesasignar = async (idEmprendedor: string) => {
        setQuitandoId(idEmprendedor);
        try {
            await superAdminService.desasignarMentor(idEmprendedor);
            toast.success('Asignación revocada con éxito');
            fetchAsignaciones();
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Error al revocar asignación'));
        } finally {
            setQuitandoId(null);
        }
    };

    const isModoConsulta = selectedProgId === 'todos';

    return (
        <Layout menuItems={SUPERADMIN_MENU_ITEMS} onLogout={logout}>
            <Toaster position="top-right" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Encabezado */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Asignación de Mentores</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Vincula mentores con emprendedores dentro del programa activo seleccionado.
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
                            Por favor, seleccione una organización en el filtro superior para gestionar las asignaciones de mentoría.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Banner de modo consulta si está en "Todos los programas" */}
                        {isModoConsulta && (
                            <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-xl shadow-sm flex items-start gap-3">
                                <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div>
                                    <h4 className="text-sm font-semibold text-blue-900">Vista general consolidada (Modo Consulta)</h4>
                                    <p className="text-xs text-blue-700 mt-0.5">
                                        Para realizar o modificar asignaciones, debe seleccionar un programa específico en el filtro superior.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {/* Columna 1: Mentores */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col justify-between">
                                <div>
                                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                                            Mentores Disponibles ({totalMentores})
                                        </h3>
                                    </div>
                                    {loading ? (
                                        <div className="p-8 text-center text-gray-400 text-sm">Cargando mentores...</div>
                                    ) : mentores.length === 0 ? (
                                        <div className="p-8 text-center text-gray-400 text-sm">No hay mentores registrados en este programa.</div>
                                    ) : (
                                        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                                            {mentores.map((m) => (
                                                <label
                                                    key={m.id_usuario}
                                                    className={`p-3.5 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                                                        mentorSeleccionado === m.id_usuario ? 'bg-teal-50/70 border-l-4 border-teal-600' : ''
                                                    }`}
                                                >
                                                    {!isModoConsulta && (
                                                        <input
                                                            type="radio"
                                                            name="mentor-select"
                                                            value={m.id_usuario}
                                                            checked={mentorSeleccionado === m.id_usuario}
                                                            onChange={() => setMentorSeleccionado(m.id_usuario)}
                                                            className="text-teal-600 focus:ring-teal-500 h-4 w-4"
                                                        />
                                                    )}
                                                    <div>
                                                        <div className="font-semibold text-sm text-gray-900">
                                                            {m.nombre} {m.apellido}
                                                        </div>
                                                        <div className="text-xs text-gray-500">{m.correo}</div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <PaginationControls
                                    page={pageMentores}
                                    totalPages={totalPagesMentores}
                                    totalItems={totalMentores}
                                    limit={15}
                                    onPageChange={setPageMentores}
                                    disabled={loading}
                                />
                            </div>

                            {/* Columna 2: Emprendedores sin Mentor */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col justify-between">
                                <div>
                                    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                                            Emprendedores sin Mentor ({totalSinMentor})
                                        </h3>
                                    </div>
                                    {loading ? (
                                        <div className="p-8 text-center text-gray-400 text-sm">Cargando emprendedores...</div>
                                    ) : sinMentor.length === 0 ? (
                                        <div className="p-8 text-center text-gray-400 text-sm">
                                            Todos los emprendedores de este programa ya tienen un mentor asignado.
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                                            {sinMentor.map((e) => (
                                                <label
                                                    key={e.id_usuario}
                                                    className={`p-3.5 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                                                        emprendedoresSeleccionados.has(e.id_usuario)
                                                            ? 'bg-teal-50/70 border-l-4 border-teal-600'
                                                            : ''
                                                    }`}
                                                >
                                                    {!isModoConsulta && (
                                                        <input
                                                            type="checkbox"
                                                            checked={emprendedoresSeleccionados.has(e.id_usuario)}
                                                            onChange={() => toggleEmprendedor(e.id_usuario)}
                                                            className="text-teal-600 focus:ring-teal-500 rounded h-4 w-4"
                                                        />
                                                    )}
                                                    <div>
                                                        <div className="font-semibold text-sm text-gray-900">
                                                            {e.nombre} {e.apellido}
                                                        </div>
                                                        <div className="text-xs text-gray-500">{e.correo}</div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <PaginationControls
                                    page={pageSinMentor}
                                    totalPages={totalPagesSinMentor}
                                    totalItems={totalSinMentor}
                                    limit={15}
                                    onPageChange={setPageSinMentor}
                                    disabled={loading}
                                />
                            </div>
                        </div>

                        {/* Botón de acción para vincular */}
                        {!isModoConsulta && (
                            <div className="flex justify-end mb-8">
                                <button
                                    type="button"
                                    onClick={handleAsignar}
                                    disabled={!mentorSeleccionado || emprendedoresSeleccionados.size === 0 || guardando}
                                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm rounded-xl shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {guardando
                                        ? 'Asignando...'
                                        : `Asignar ${emprendedoresSeleccionados.size} emprendedor(es) al mentor`}
                                </button>
                            </div>
                        )}

                        {/* Columna 3: Asignaciones Existentes */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                                    Asignaciones Actuales ({totalConMentor})
                                </h3>
                            </div>
                            {loading ? (
                                <div className="p-12 text-center text-gray-400">Cargando asignaciones...</div>
                            ) : conMentor.length === 0 ? (
                                <div className="p-12 text-center text-gray-400">No se registran asignaciones activas.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider text-left">
                                            <tr>
                                                <th className="px-6 py-3.5">Emprendedor</th>
                                                <th className="px-6 py-3.5">Mentor Asignado</th>
                                                {isModoConsulta && <th className="px-6 py-3.5">Programa</th>}
                                                {!isModoConsulta && <th className="px-6 py-3.5 text-right">Acción</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
                                            {conMentor.map((item) => (
                                                <tr key={item.id_emprendedor} className="hover:bg-gray-50/80 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="font-semibold text-gray-900">
                                                            {item.nombre} {item.apellido}
                                                        </div>
                                                        <div className="text-xs text-gray-500">{item.correo}</div>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="font-semibold text-gray-900">
                                                            {item.mentor_nombre} {item.mentor_apellido}
                                                        </div>
                                                        <div className="text-xs text-purple-700 font-medium">Mentor</div>
                                                    </td>
                                                    {isModoConsulta && (
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full text-xs font-medium">
                                                                {item.nombre_programa || 'Programa'}
                                                            </span>
                                                        </td>
                                                    )}
                                                    {!isModoConsulta && (
                                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDesasignar(item.id_emprendedor)}
                                                                disabled={quitandoId === item.id_emprendedor}
                                                                className="text-xs font-medium text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                                                            >
                                                                {quitandoId === item.id_emprendedor ? 'Quitando...' : 'Quitar asignación'}
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <PaginationControls
                                page={pageConMentor}
                                totalPages={totalPagesConMentor}
                                totalItems={totalConMentor}
                                limit={15}
                                onPageChange={setPageConMentor}
                                disabled={loading}
                            />
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
};
