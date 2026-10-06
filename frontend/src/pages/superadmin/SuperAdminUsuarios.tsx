/**
 * Página de Gestión de Usuarios para Super Administrador (Spec 004)
 * Permite cambiar rol (1-4), activar/desactivar estado y matricular usuarios sin programa.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/common/Layout';
import { useAuth } from '../../hooks/useAuth';
import { SUPERADMIN_MENU_ITEMS } from '../../constants/superAdminMenu';
import { SuperAdminFilterBar } from '../../components/superadmin/SuperAdminFilterBar';
import { useSuperAdminFilters } from '../../context/SuperAdminFilterContext';
import { PaginationControls } from '../../components/common/PaginationControls';
import { superAdminService } from '../../services/superAdminService';
import { SuperAdminUsuario } from '../../types/superAdmin';
import toast, { Toaster } from 'react-hot-toast';

export const SuperAdminUsuarios: React.FC = () => {
    const { logout } = useAuth();
    const { selectedOrgId, selectedProgId, programas } = useSuperAdminFilters();

    const [activeTab, setActiveTab] = useState<'matriculados' | 'sin_programa'>('matriculados');

    // Estado para usuarios matriculados
    const [usuarios, setUsuarios] = useState<SuperAdminUsuario[]>([]);
    const [totalMatriculados, setTotalMatriculados] = useState(0);
    const [pageMatriculados, setPageMatriculados] = useState(1);
    const [totalPagesMatriculados, setTotalPagesMatriculados] = useState(1);
    const [loadingMatriculados, setLoadingMatriculados] = useState(false);

    // Estado para usuarios sin programa
    const [usuariosSinProg, setUsuariosSinProg] = useState<SuperAdminUsuario[]>([]);
    const [totalSinProg, setTotalSinProg] = useState(0);
    const [pageSinProg, setPageSinProg] = useState(1);
    const [totalPagesSinProg, setTotalPagesSinProg] = useState(1);
    const [loadingSinProg, setLoadingSinProg] = useState(false);

    // Modal de matriculación
    const [matricularUser, setMatricularUser] = useState<SuperAdminUsuario | null>(null);
    const [selectedMatriculaProg, setSelectedMatriculaProg] = useState<number | ''>('');
    const [matriculando, setMatriculando] = useState(false);

    // Modal para cambio de rol
    const [cambiarRolUser, setCambiarRolUser] = useState<SuperAdminUsuario | null>(null);
    const [nuevoRol, setNuevoRol] = useState<number>(2);
    const [guardandoRol, setGuardandoRol] = useState(false);

    // Cargar usuarios matriculados
    const fetchUsuariosMatriculados = useCallback(async () => {
        if (!selectedOrgId) return;
        setLoadingMatriculados(true);
        try {
            const progId = selectedProgId === 'todos' ? null : selectedProgId;
            const res = await superAdminService.obtenerUsuariosPaginados(selectedOrgId, progId, pageMatriculados, 15);
            setUsuarios(res.items);
            setTotalMatriculados(res.total);
            setTotalPagesMatriculados(res.total_pages);
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Error al cargar usuarios matriculados');
        } finally {
            setLoadingMatriculados(false);
        }
    }, [selectedOrgId, selectedProgId, pageMatriculados]);

    // Cargar usuarios sin programa
    const fetchUsuariosSinPrograma = useCallback(async () => {
        if (!selectedOrgId) return;
        setLoadingSinProg(true);
        try {
            const res = await superAdminService.obtenerUsuariosSinPrograma(selectedOrgId, pageSinProg, 15);
            setUsuariosSinProg(res.items);
            setTotalSinProg(res.total);
            setTotalPagesSinProg(res.total_pages);
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Error al cargar usuarios sin programa');
        } finally {
            setLoadingSinProg(false);
        }
    }, [selectedOrgId, pageSinProg]);

    useEffect(() => {
        if (selectedOrgId) {
            if (activeTab === 'matriculados') {
                fetchUsuariosMatriculados();
            } else {
                fetchUsuariosSinPrograma();
            }
        } else {
            setUsuarios([]);
            setUsuariosSinProg([]);
        }
    }, [selectedOrgId, selectedProgId, activeTab, fetchUsuariosMatriculados, fetchUsuariosSinPrograma]);

    // Alternar estado activo/inactivo
    const handleToggleEstado = async (u: SuperAdminUsuario) => {
        const nuevoEstado = !u.estado;
        try {
            await superAdminService.cambiarEstadoUsuario(u.id_usuario, nuevoEstado);
            toast.success(`Usuario ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`);
            if (activeTab === 'matriculados') {
                fetchUsuariosMatriculados();
            } else {
                fetchUsuariosSinPrograma();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Error al actualizar estado del usuario');
        }
    };

    // Guardar nuevo rol
    const handleGuardarRol = async () => {
        if (!cambiarRolUser) return;
        setGuardandoRol(true);
        try {
            await superAdminService.cambiarRol(cambiarRolUser.id_usuario, nuevoRol);
            toast.success('Rol actualizado con éxito');
            setCambiarRolUser(null);
            if (activeTab === 'matriculados') {
                fetchUsuariosMatriculados();
            } else {
                fetchUsuariosSinPrograma();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Error al cambiar rol del usuario');
        } finally {
            setGuardandoRol(false);
        }
    };

    // Confirmar matriculación en programa
    const handleConfirmarMatricula = async () => {
        if (!matricularUser || !selectedMatriculaProg) return;
        setMatriculando(true);
        try {
            await superAdminService.matricularUsuario(matricularUser.id_usuario, Number(selectedMatriculaProg));
            toast.success('Usuario matriculado exitosamente');
            setMatricularUser(null);
            setSelectedMatriculaProg('');
            fetchUsuariosSinPrograma();
            fetchUsuariosMatriculados();
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Error al matricular usuario');
        } finally {
            setMatriculando(false);
        }
    };

    return (
        <Layout menuItems={SUPERADMIN_MENU_ITEMS} onLogout={logout}>
            <Toaster position="top-right" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Encabezado */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Gestión de Usuarios</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Audita estados, actualiza roles y matricula participantes en los programas de la organización.
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
                            Por favor, seleccione una organización en el filtro superior para gestionar a sus usuarios y participantes.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Pestañas de navegación */}
                        <div className="flex border-b border-gray-200 mb-6 gap-8">
                            <button
                                type="button"
                                onClick={() => setActiveTab('matriculados')}
                                className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                                    activeTab === 'matriculados'
                                        ? 'border-teal-600 text-teal-700'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Usuarios Matriculados ({totalMatriculados})
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('sin_programa')}
                                className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                                    activeTab === 'sin_programa'
                                        ? 'border-teal-600 text-teal-700'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                Usuarios sin programa asignado ({totalSinProg})
                            </button>
                        </div>

                        {/* Pestaña: Usuarios Matriculados */}
                        {activeTab === 'matriculados' && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                {loadingMatriculados ? (
                                    <div className="p-12 text-center text-gray-500">Cargando usuarios matriculados...</div>
                                ) : usuarios.length === 0 ? (
                                    <div className="p-12 text-center text-gray-500">
                                        No hay usuarios matriculados registrados para el filtro seleccionado.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider text-left">
                                                <tr>
                                                    <th className="px-6 py-3.5">Usuario</th>
                                                    <th className="px-6 py-3.5">Correo</th>
                                                    <th className="px-6 py-3.5">Rol</th>
                                                    <th className="px-6 py-3.5">Programas</th>
                                                    <th className="px-6 py-3.5 text-center">Estado</th>
                                                    <th className="px-6 py-3.5 text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
                                                {usuarios.map((u) => (
                                                    <tr key={u.id_usuario} className="hover:bg-gray-50/80 transition-colors">
                                                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                                            {u.nombre} {u.apellido}
                                                        </td>
                                                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{u.correo}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span
                                                                className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                                    u.id_rol === 1
                                                                        ? 'bg-blue-100 text-blue-800'
                                                                        : u.id_rol === 3
                                                                        ? 'bg-purple-100 text-purple-800'
                                                                        : u.id_rol === 4
                                                                        ? 'bg-rose-100 text-rose-800'
                                                                        : 'bg-teal-100 text-teal-800'
                                                                }`}
                                                            >
                                                                {u.nombre_rol || 'Emprendedor'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-wrap gap-1">
                                                                {u.programas_nombres.length > 0 ? (
                                                                    u.programas_nombres.map((p, idx) => (
                                                                        <span key={idx} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                                                                            {p}
                                                                        </span>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-gray-400 text-xs italic">Sin programas</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleEstado(u)}
                                                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                                    u.estado ? 'bg-teal-600' : 'bg-gray-300'
                                                                }`}
                                                            >
                                                                <span
                                                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                                        u.estado ? 'translate-x-5' : 'translate-x-0'
                                                                    }`}
                                                                />
                                                            </button>
                                                        </td>
                                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setCambiarRolUser(u);
                                                                    setNuevoRol(u.id_rol);
                                                                }}
                                                                className="text-xs font-semibold text-teal-600 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-lg transition-colors"
                                                            >
                                                                Cambiar Rol
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                <PaginationControls
                                    page={pageMatriculados}
                                    totalPages={totalPagesMatriculados}
                                    totalItems={totalMatriculados}
                                    limit={15}
                                    onPageChange={setPageMatriculados}
                                    disabled={loadingMatriculados}
                                />
                            </div>
                        )}

                        {/* Pestaña: Usuarios Sin Programa */}
                        {activeTab === 'sin_programa' && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                {loadingSinProg ? (
                                    <div className="p-12 text-center text-gray-500">Cargando usuarios sin programa...</div>
                                ) : usuariosSinProg.length === 0 ? (
                                    <div className="p-12 text-center text-gray-500">
                                        No hay usuarios pendientes de matrícula en esta organización.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider text-left">
                                                <tr>
                                                    <th className="px-6 py-3.5">Usuario</th>
                                                    <th className="px-6 py-3.5">Correo</th>
                                                    <th className="px-6 py-3.5">Rol</th>
                                                    <th className="px-6 py-3.5 text-center">Estado</th>
                                                    <th className="px-6 py-3.5 text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
                                                {usuariosSinProg.map((u) => (
                                                    <tr key={u.id_usuario} className="hover:bg-gray-50/80 transition-colors">
                                                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                                            {u.nombre} {u.apellido}
                                                        </td>
                                                        <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{u.correo}</td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                                                                {u.nombre_rol || 'Emprendedor'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center whitespace-nowrap">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleEstado(u)}
                                                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                                    u.estado ? 'bg-teal-600' : 'bg-gray-300'
                                                                }`}
                                                            >
                                                                <span
                                                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                                        u.estado ? 'translate-x-5' : 'translate-x-0'
                                                                    }`}
                                                                />
                                                            </button>
                                                        </td>
                                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setMatricularUser(u);
                                                                    setSelectedMatriculaProg('');
                                                                }}
                                                                className="text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 px-3.5 py-1.5 rounded-lg transition-colors shadow-sm"
                                                            >
                                                                Matricular en Programa
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                                <PaginationControls
                                    page={pageSinProg}
                                    totalPages={totalPagesSinProg}
                                    totalItems={totalSinProg}
                                    limit={15}
                                    onPageChange={setPageSinProg}
                                    disabled={loadingSinProg}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modal para Matricular Usuario */}
            {matricularUser && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 animate-fadeIn">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Matricular Usuario en Programa</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Selecciona el programa activo al que deseas incorporar a{' '}
                            <span className="font-semibold text-gray-800">
                                {matricularUser.nombre} {matricularUser.apellido}
                            </span>.
                        </p>

                        <div className="mb-5">
                            <label htmlFor="prog-select-matricula" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                                Programa Activo
                            </label>
                            <select
                                id="prog-select-matricula"
                                value={selectedMatriculaProg}
                                onChange={(e) => setSelectedMatriculaProg(Number(e.target.value))}
                                className="w-full h-11 px-3 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            >
                                <option value="">-- Seleccione un programa --</option>
                                {programas.map((p) => (
                                    <option key={p.id_programa} value={p.id_programa}>
                                        {p.nombre_programa}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setMatricularUser(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmarMatricula}
                                disabled={!selectedMatriculaProg || matriculando}
                                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50 transition-colors shadow-sm"
                            >
                                {matriculando ? 'Matriculando...' : 'Confirmar Matrícula'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal para Cambiar Rol */}
            {cambiarRolUser && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 animate-fadeIn">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Cambiar Rol de Usuario</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Modifica el nivel de acceso en la plataforma para{' '}
                            <span className="font-semibold text-gray-800">
                                {cambiarRolUser.nombre} {cambiarRolUser.apellido}
                            </span>.
                        </p>

                        <div className="mb-5">
                            <label htmlFor="select-cambiar-rol" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                                Rol Asignado
                            </label>
                            <select
                                id="select-cambiar-rol"
                                value={nuevoRol}
                                onChange={(e) => setNuevoRol(Number(e.target.value))}
                                className="w-full h-11 px-3 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                            >
                                <option value={2}>Emprendedor</option>
                                <option value={3}>Mentor</option>
                                <option value={1}>Administrador</option>
                                <option value={4}>Super Administrador</option>
                            </select>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setCambiarRolUser(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleGuardarRol}
                                disabled={guardandoRol}
                                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50 transition-colors shadow-sm"
                            >
                                {guardandoRol ? 'Guardando...' : 'Guardar Cambio'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};
