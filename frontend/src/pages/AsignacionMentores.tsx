/**
 * Página de Asignación de Mentores a Emprendedores
 * Solo accesible para Administradores
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/common/Layout';
import {
    obtenerMentores,
    obtenerEmprendedoresSinMentor,
    obtenerEmprendedoresConMentor,
    asignarMentores,
    quitarAsignacion,
    Usuario,
    EmprendedorConMentor
} from '../services/asignacionService';
import toast from 'react-hot-toast';
import { ADMIN_MENU_ITEMS } from '../constants/adminMenu';
import { programaService } from '../services/programaService';


export const AsignacionMentores = () => {
    const { user, logout } = useAuth();

    const [mentores, setMentores] = useState<Usuario[]>([]);
    const [emprendedores, setEmprendedores] = useState<Usuario[]>([]);
    const [emprendedoresConMentor, setEmprendedoresConMentor] = useState<EmprendedorConMentor[]>([]);
    const [mentorSeleccionado, setMentorSeleccionado] = useState<string>('');
    const [emprendedoresSeleccionados, setEmprendedoresSeleccionados] = useState<Set<string>>(new Set());
    const [programasMap, setProgramasMap] = useState<Record<number, string>>({});
    const [loading, setLoading] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [quitando, setQuitando] = useState<string | null>(null); // id_emprendedor que se está quitando

    useEffect(() => {
        if (!user?.id_usuario) return;
        cargarDatos();
    }, [user?.id_usuario]);

    const cargarDatos = async () => {
        if (!user?.id_usuario) return;
        try {
            setLoading(true);
            const [mentoresData, emprendedoresData, conMentorData, progsData] = await Promise.all([
                obtenerMentores(user.id_usuario),
                obtenerEmprendedoresSinMentor(user.id_usuario),
                obtenerEmprendedoresConMentor(user.id_usuario),
                programaService.obtenerMisProgramas(user.id_usuario)
            ]);

            setMentores(mentoresData);
            setEmprendedores(emprendedoresData);
            setEmprendedoresConMentor(conMentorData);

            const mapP: Record<number, string> = {};
            for (const p of progsData) {
                mapP[p.id_programa] = p.nombre_programa;
            }
            setProgramasMap(mapP);
        } catch (error) {
            console.error('Error al cargar datos:', error);
            toast.error('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const toggleEmprendedor = (id: string) => {
        const nuevaSeleccion = new Set(emprendedoresSeleccionados);
        if (nuevaSeleccion.has(id)) {
            nuevaSeleccion.delete(id);
        } else {
            nuevaSeleccion.add(id);
        }
        setEmprendedoresSeleccionados(nuevaSeleccion);
    };

    const handleGuardar = async () => {
        if (!mentorSeleccionado) {
            toast.error('Debes seleccionar un mentor');
            return;
        }

        if (emprendedoresSeleccionados.size === 0) {
            toast.error('Debes seleccionar al menos un emprendedor');
            return;
        }

        try {
            setGuardando(true);
            const response = await asignarMentores({
                id_mentor: mentorSeleccionado,
                id_emprendedores: Array.from(emprendedoresSeleccionados)
            });

            toast.success(`✅ ${response.cantidad} emprendedor(es) asignado(s) correctamente`);

            // Limpiar selecciones
            setMentorSeleccionado('');
            setEmprendedoresSeleccionados(new Set());

            // Recargar lista de emprendedores
            await cargarDatos();
        } catch (error) {
            console.error('Error al asignar mentores:', error);
            toast.error('Error al asignar mentores');
        } finally {
            setGuardando(false);
        }
    };

    const getNombreCompleto = (usuario: Usuario) => {
        if (usuario.nombre && usuario.apellido) {
            return `${usuario.nombre} ${usuario.apellido}`;
        }
        return usuario.email;
    };

    const handleQuitarAsignacion = async (idEmprendedor: string) => {
        try {
            setQuitando(idEmprendedor);
            await quitarAsignacion(idEmprendedor);
            toast.success('Asignación eliminada correctamente');
            await cargarDatos();
        } catch (error) {
            console.error('Error al quitar asignación:', error);
            toast.error('Error al quitar la asignación');
        } finally {
            setQuitando(null);
        }
    };

    // Mentor seleccionado y lista de emprendedores filtrados reactivamente por programas compartidos
    const mentorActual = mentores.find((m) => m.id_usuario === mentorSeleccionado);
    const emprendedoresFiltrados = mentorActual && mentorActual.programas_ids && mentorActual.programas_ids.length > 0
        ? emprendedores.filter((emp) => {
            const empProgs = emp.programas_ids || [];
            return empProgs.some((pid) => mentorActual.programas_ids!.includes(pid));
        })
        : emprendedores;

    return (
        <Layout menuItems={ADMIN_MENU_ITEMS} onLogout={logout}>
            <div>
                {/* Header */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-800 tracking-tight mb-1">
                            Asignar Mentores
                        </h1>
                        <p className="text-sm text-neutral-500 font-medium">
                            Selecciona un mentor y los emprendedores que deseas asignarle
                        </p>
                    </div>
                </div>

                {/* Barra de herramientas superior */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-5">
                    <div className="flex gap-4 items-end">
                        {/* Dropdown de mentores */}
                        <div className="flex-1">
                            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                                Selecciona un Mentor
                            </label>
                            <select
                                value={mentorSeleccionado}
                                onChange={(e) => {
                                    setMentorSeleccionado(e.target.value);
                                    setEmprendedoresSeleccionados(new Set());
                                }}
                                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-activa-teal/50 focus:border-activa-teal shadow-sm"
                                disabled={loading || guardando}
                            >
                                <option value="">Selecciona un mentor...</option>
                                {mentores.map((mentor) => (
                                    <option key={mentor.id_usuario} value={mentor.id_usuario}>
                                        {getNombreCompleto(mentor)}
                                    </option>
                                ))}
                            </select>

                            {/* Programas del mentor seleccionado */}
                            {mentorActual && mentorActual.programas_ids && mentorActual.programas_ids.length > 0 && (
                                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[11px] font-bold text-neutral-400">Programas del mentor:</span>
                                    {mentorActual.programas_ids.map((pid) => (
                                        <span
                                            key={pid}
                                            className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-secondary-50 text-activa-dark-teal border border-secondary-100"
                                        >
                                            {programasMap[pid] || `Programa #${pid}`}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Botón Guardar */}
                        <button
                            onClick={handleGuardar}
                            disabled={!mentorSeleccionado || emprendedoresSeleccionados.size === 0 || guardando}
                            className="px-6 py-2.5 bg-activa-teal hover:bg-activa-dark-teal disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors flex items-center gap-2"
                        >
                            {guardando ? (
                                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>Guardando...</>
                            ) : (
                                <>Guardar</>
                            )}
                        </button>
                    </div>

                    {/* Info de selección */}
                    {emprendedoresSeleccionados.size > 0 && (
                        <div className="mt-3 text-sm font-semibold text-activa-teal">
                            {emprendedoresSeleccionados.size} emprendedor(es) seleccionado(s)
                        </div>
                    )}
                </div>

                {/* Lista de emprendedores sin mentor */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-5 bg-activa-coral rounded-full"></div>
                        <h2 className="text-base font-extrabold text-neutral-800 tracking-tight">
                            Emprendedores sin Mentor Asignado
                        </h2>
                        {mentorSeleccionado && (
                            <span className="ml-auto text-xs text-neutral-400 font-medium">
                                {emprendedoresFiltrados.length} compatible(s)
                            </span>
                        )}
                    </div>

                    {loading ? (
                        <div className="text-center py-8">
                            <svg className="animate-spin h-7 w-7 text-activa-teal mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <p className="text-neutral-500 text-sm">Cargando...</p>
                        </div>
                    ) : emprendedoresFiltrados.length === 0 ? (
                        <div className="text-center py-8 text-neutral-500 text-sm">
                            {mentorSeleccionado
                                ? 'No hay emprendedores sin mentor disponibles que pertenezcan a los programas de este mentor'
                                : 'No hay emprendedores sin mentor asignado'}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {emprendedoresFiltrados.map((emprendedor) => {
                                const isSelected = emprendedoresSeleccionados.has(emprendedor.id_usuario);
                                return (
                                    <label
                                        key={emprendedor.id_usuario}
                                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                                            isSelected
                                                ? 'bg-activa-teal/5 border-activa-teal/30'
                                                : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleEmprendedor(emprendedor.id_usuario)}
                                            className="w-4 h-4 rounded border-slate-300 text-activa-teal focus:ring-activa-teal/50 focus:ring-offset-white"
                                            disabled={guardando}
                                        />
                                        <div className="flex-1">
                                            <div className="text-neutral-900 font-medium text-sm">
                                                {getNombreCompleto(emprendedor)}
                                            </div>
                                            <div className="text-xs text-neutral-500">
                                                {emprendedor.email}
                                            </div>
                                            {/* Badges de programas del emprendedor */}
                                            {emprendedor.programas_ids && emprendedor.programas_ids.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                                    {emprendedor.programas_ids.map((pid) => (
                                                        <span
                                                            key={pid}
                                                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-50 text-jci-blue border border-primary-100 shadow-2xs"
                                                        >
                                                            {programasMap[pid] || `Programa #${pid}`}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Sección: Quitar Asignación */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mt-5">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-5 bg-red-400 rounded-full"></div>
                        <h2 className="text-base font-extrabold text-neutral-800 tracking-tight">
                            Emprendedores con Mentor Asignado
                        </h2>
                        <span className="ml-auto text-xs text-neutral-400 font-medium">
                            {emprendedoresConMentor.length} asignación(es)
                        </span>
                    </div>
                    <p className="text-xs text-neutral-500 mb-4">
                        Aquí puedes quitar la asignación de un emprendedor para que pueda ser reasignado a otro mentor.
                    </p>

                    {loading ? (
                        <div className="text-center py-6">
                            <svg className="animate-spin h-6 w-6 text-activa-teal mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    ) : emprendedoresConMentor.length === 0 ? (
                        <div className="text-center py-6 text-neutral-500 text-sm">
                            No hay asignaciones activas actualmente
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {emprendedoresConMentor.map((item) => (
                                <div
                                    key={item.id_emprendedor}
                                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition-colors"
                                >
                                    {/* Emprendedor */}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-base font-bold text-neutral-800 truncate">
                                            {getNombreCompleto(item.emprendedor)}
                                        </div>
                                        {item.emprendedor.nombre_emprendimiento && (
                                            <div className="text-sm text-neutral-500 truncate">
                                                {item.emprendedor.nombre_emprendimiento}
                                            </div>
                                        )}
                                    </div>

                                    {/* Flecha */}
                                    <div className="flex-shrink-0 text-neutral-300">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                        </svg>
                                    </div>

                                    {/* Mentor */}
                                    <div className="flex-1 min-w-0 text-right">
                                        <div className="text-sm font-bold text-activa-teal truncate">
                                            {getNombreCompleto(item.mentor)}
                                        </div>
                                        <div className="text-xs text-neutral-400 truncate">Mentor</div>
                                    </div>

                                    {/* Botón quitar */}
                                    <button
                                        onClick={() => handleQuitarAsignacion(item.emprendedor.id_usuario)}
                                        disabled={quitando === item.emprendedor.id_usuario}
                                        className="flex-shrink-0 ml-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center gap-1"
                                        title="Quitar asignación"
                                    >
                                        {quitando === item.emprendedor.id_usuario ? (
                                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-500"></div>
                                        ) : (
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        )}
                                        Quitar
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};
