import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/common/Layout';
import { MenuItem } from '../components/common/Sidebar';
import { programaService } from '../services/programaService';
import { OrganizacionItem } from '../types/programa';
import toast, { Toaster } from 'react-hot-toast';

const menuItems: MenuItem[] = [
    { label: 'Organizaciones y Programas', path: '/superadmin/home' },
];

export const SuperAdminHome = () => {
    const { logout } = useAuth();

    const [organizaciones, setOrganizaciones] = useState<OrganizacionItem[]>([]);
    const [programas, setProgramas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modals (Create / Edit)
    const [showOrgModal, setShowOrgModal] = useState(false);
    const [editingOrgId, setEditingOrgId] = useState<number | null>(null);
    const [showProgModal, setShowProgModal] = useState(false);
    const [editingProgId, setEditingProgId] = useState<number | null>(null);

    // Form inputs
    const [orgNombre, setOrgNombre] = useState('');
    const [orgDesc, setOrgDesc] = useState('');
    const [progOrgId, setProgOrgId] = useState<number | ''>('');
    const [progNombre, setProgNombre] = useState('');
    const [progCodigo, setProgCodigo] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [orgsData, progsData] = await Promise.all([
                programaService.listarOrganizaciones(),
                programaService.listarProgramas(),
            ]);
            setOrganizaciones(orgsData);
            setProgramas(progsData);
            if (orgsData.length > 0 && progOrgId === '') {
                setProgOrgId(orgsData[0].id_organizacion);
            }
        } catch (error) {
            console.error('Error al cargar datos:', error);
            toast.error('Error al cargar organizaciones y programas');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Generar código aleatorio de 8 caracteres alfanuméricos
    const generarCodigoAleatorio = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setProgCodigo(code);
    };

    const openNuevaOrgModal = () => {
        setEditingOrgId(null);
        setOrgNombre('');
        setOrgDesc('');
        setShowOrgModal(true);
    };

    const openEditarOrgModal = (org: OrganizacionItem) => {
        setEditingOrgId(org.id_organizacion);
        setOrgNombre(org.nombre);
        setOrgDesc(org.descripcion || '');
        setShowOrgModal(true);
    };

    const openNuevoProgModal = () => {
        if (organizaciones.length === 0) {
            toast.error('Primero debes registrar al menos una organización');
            return;
        }
        setEditingProgId(null);
        setProgOrgId(organizaciones[0].id_organizacion);
        setProgNombre('');
        generarCodigoAleatorio();
        setShowProgModal(true);
    };

    const openEditarProgModal = (prog: any) => {
        setEditingProgId(prog.id_programa);
        setProgOrgId(prog.id_organizacion);
        setProgNombre(prog.nombre);
        setProgCodigo(prog.codigo);
        setShowProgModal(true);
    };

    const handleSubmitOrganizacion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgNombre.trim()) {
            toast.error('El nombre de la organización es obligatorio');
            return;
        }

        setSubmitting(true);
        try {
            if (editingOrgId !== null) {
                await programaService.actualizarOrganizacion(editingOrgId, orgNombre, orgDesc);
                toast.success('Organización actualizada con éxito');
            } else {
                await programaService.crearOrganizacion(orgNombre, orgDesc);
                toast.success('Organización creada con éxito');
            }
            setOrgNombre('');
            setOrgDesc('');
            setEditingOrgId(null);
            setShowOrgModal(false);
            fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Error al guardar la organización');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitPrograma = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!progOrgId || !progNombre.trim() || progCodigo.trim().length !== 8) {
            toast.error('Completa todos los campos y asegúrate de que el código tenga 8 caracteres');
            return;
        }

        setSubmitting(true);
        try {
            if (editingProgId !== null) {
                await programaService.actualizarPrograma(editingProgId, Number(progOrgId), progNombre, progCodigo);
                toast.success('Programa actualizado con éxito');
            } else {
                await programaService.crearPrograma(Number(progOrgId), progNombre, progCodigo);
                toast.success('Programa creado con éxito');
            }
            setProgNombre('');
            setProgCodigo('');
            setEditingProgId(null);
            setShowProgModal(false);
            fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Error al guardar el programa');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Layout menuItems={menuItems} onLogout={logout}>
            <Toaster position="top-right" />
            <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
                {/* Header Institucional */}
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-jci-blue via-activa-teal to-activa-coral"></div>
                    <div>
                        <div className="flex items-center gap-2.5 mb-1.5">
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary-50 text-jci-blue border border-primary-200">
                                Super Administrador
                            </span>
                            <span className="text-neutral-400 text-xs">JCI Empresarios La Paz</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-800 tracking-tight">
                            Organizaciones y Programas
                        </h1>
                        <p className="text-neutral-500 text-sm font-medium tracking-wide mt-1">
                            Crea, edita y administra las organizaciones y programas con sus códigos de acceso alfanuméricos.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={openNuevaOrgModal}
                            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-neutral-700 font-semibold rounded-xl border border-slate-200 text-sm transition-all shadow-sm hover:border-slate-300 flex items-center gap-2"
                        >
                            <svg className="w-4 h-4 text-jci-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>Nueva Organización</span>
                        </button>

                        <button
                            onClick={openNuevoProgModal}
                            className="px-4 py-2.5 bg-jci-blue hover:bg-primary-600 text-white font-semibold rounded-xl text-sm shadow-sm hover:shadow transition-all flex items-center gap-2"
                        >
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>Nuevo Programa</span>
                        </button>
                    </div>
                </div>

                {/* Grid con Organizaciones y Programas */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Columna Izquierda: Organizaciones */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-bold text-neutral-800 flex items-center gap-2">
                                <span>Organizaciones Registradas</span>
                                <span className="text-xs bg-slate-100 text-neutral-600 font-bold px-2.5 py-0.5 rounded-full">
                                    {organizaciones.length}
                                </span>
                            </h2>
                        </div>

                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2].map((n) => (
                                    <div key={n} className="h-24 bg-white rounded-2xl border border-slate-100 p-4 animate-pulse"></div>
                                ))}
                            </div>
                        ) : organizaciones.length === 0 ? (
                            <div className="p-8 bg-white rounded-2xl border border-slate-100 text-center text-sm text-neutral-500 shadow-sm">
                                No hay organizaciones registradas aún.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {organizaciones.map((org) => {
                                    const progsCount = programas.filter((p) => p.id_organizacion === org.id_organizacion).length;
                                    return (
                                        <div
                                            key={org.id_organizacion}
                                            className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md hover:border-jci-blue/30 transition-all duration-300 relative overflow-hidden group"
                                        >
                                            <div className="absolute top-0 left-0 w-1 h-full bg-jci-blue opacity-80"></div>
                                            <div className="flex items-start justify-between gap-3 pl-2">
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="font-bold text-neutral-800 group-hover:text-jci-blue transition-colors truncate">
                                                        {org.nombre}
                                                    </h3>
                                                    {org.descripcion && (
                                                        <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                                                            {org.descripcion}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-[11px] font-bold bg-primary-50 text-jci-blue border border-primary-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                                                        {progsCount} {progsCount === 1 ? 'programa' : 'programas'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditarOrgModal(org)}
                                                        title="Editar organización"
                                                        className="p-1.5 rounded-lg text-neutral-400 hover:text-jci-blue hover:bg-primary-50 border border-transparent hover:border-primary-100 transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Columna Derecha: Programas */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-base font-bold text-neutral-800 flex items-center gap-2">
                                <span>Programas y Códigos de Acceso</span>
                                <span className="text-xs bg-slate-100 text-neutral-600 font-bold px-2.5 py-0.5 rounded-full">
                                    {programas.length}
                                </span>
                            </h2>
                        </div>

                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map((n) => (
                                    <div key={n} className="h-20 bg-white rounded-2xl border border-slate-100 animate-pulse"></div>
                                ))}
                            </div>
                        ) : programas.length === 0 ? (
                            <div className="p-10 bg-white rounded-2xl border border-slate-100 text-center text-sm text-neutral-500 shadow-sm space-y-2">
                                <p className="font-semibold text-neutral-700">No hay programas creados aún</p>
                                <p className="text-xs text-neutral-400">Crea uno para que los usuarios puedan unirse con su código</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold text-neutral-500 uppercase tracking-wider">
                                            <th className="py-3.5 px-5">Programa</th>
                                            <th className="py-3.5 px-5">Organización</th>
                                            <th className="py-3.5 px-5 text-center">Código de Acceso</th>
                                            <th className="py-3.5 px-5 text-right">Creado</th>
                                            <th className="py-3.5 px-5 text-right">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
                                        {programas.map((prog) => (
                                            <tr key={prog.id_programa} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-4 px-5 font-bold text-neutral-800">
                                                    {prog.nombre}
                                                </td>
                                                <td className="py-4 px-5 text-neutral-600 text-xs">
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-slate-100 font-medium">
                                                        {prog.organizacion?.nombre ||
                                                            organizaciones.find((o) => o.id_organizacion === prog.id_organizacion)?.nombre ||
                                                            'Organización'}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-5 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(prog.codigo);
                                                            toast.success(`Código ${prog.codigo} copiado al portapapeles`);
                                                        }}
                                                        title="Haz clic para copiar"
                                                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-50 hover:bg-primary-100 text-jci-blue font-mono font-bold text-xs rounded-lg border border-primary-200 transition-colors shadow-2xs group"
                                                    >
                                                        <span>{prog.codigo}</span>
                                                        <svg className="w-3.5 h-3.5 text-primary-400 group-hover:text-jci-blue transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                    </button>
                                                </td>
                                                <td className="py-4 px-5 text-right text-xs text-neutral-400 font-medium">
                                                    {prog.created_at ? new Date(prog.created_at).toLocaleDateString('es-ES') : '-'}
                                                </td>
                                                <td className="py-4 px-5 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditarProgModal(prog)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-jci-blue bg-primary-50 hover:bg-primary-100 border border-primary-100 rounded-lg transition-colors"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                        <span>Editar</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal Crear / Editar Organización */}
            {showOrgModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 relative">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-neutral-800">
                                {editingOrgId !== null ? 'Editar Organización' : 'Nueva Organización'}
                            </h3>
                            <button
                                onClick={() => setShowOrgModal(false)}
                                className="text-neutral-400 hover:text-neutral-600 p-1"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmitOrganizacion} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wide mb-1.5">Nombre</label>
                                <input
                                    type="text"
                                    required
                                    value={orgNombre}
                                    onChange={(e) => setOrgNombre(e.target.value)}
                                    placeholder="Ej: JCI Empresarios La Paz"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-jci-blue focus:bg-white transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wide mb-1.5">Descripción (Opcional)</label>
                                <textarea
                                    rows={3}
                                    value={orgDesc}
                                    onChange={(e) => setOrgDesc(e.target.value)}
                                    placeholder="Breve descripción o rubro..."
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-jci-blue focus:bg-white transition-all resize-none"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowOrgModal(false)}
                                    className="px-4 py-2.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2.5 bg-jci-blue hover:bg-primary-600 text-white rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-50"
                                >
                                    {submitting
                                        ? 'Guardando...'
                                        : editingOrgId !== null
                                            ? 'Guardar Cambios'
                                            : 'Crear Organización'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Crear / Editar Programa */}
            {showProgModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 relative">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-neutral-800">
                                {editingProgId !== null ? 'Editar Programa' : 'Nuevo Programa'}
                            </h3>
                            <button
                                onClick={() => setShowProgModal(false)}
                                className="text-neutral-400 hover:text-neutral-600 p-1"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmitPrograma} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wide mb-1.5">Organización</label>
                                <select
                                    required
                                    value={progOrgId}
                                    onChange={(e) => setProgOrgId(Number(e.target.value))}
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-jci-blue focus:bg-white transition-all"
                                >
                                    {organizaciones.map((org) => (
                                        <option key={org.id_organizacion} value={org.id_organizacion}>
                                            {org.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wide mb-1.5">Nombre del Programa</label>
                                <input
                                    type="text"
                                    required
                                    value={progNombre}
                                    onChange={(e) => setProgNombre(e.target.value)}
                                    placeholder="Ej: Activa Mujer 2026"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-neutral-800 text-sm focus:outline-none focus:ring-2 focus:ring-jci-blue focus:bg-white transition-all"
                                />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wide">Código de Acceso (8 Caracteres)</label>
                                    <button
                                        type="button"
                                        onClick={generarCodigoAleatorio}
                                        className="text-xs font-semibold text-jci-blue hover:underline"
                                    >
                                        Generar aleatorio
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    maxLength={8}
                                    required
                                    value={progCodigo}
                                    onChange={(e) => setProgCodigo(e.target.value.toUpperCase())}
                                    placeholder="EJ: QWER2345"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-lg font-mono font-bold tracking-widest text-jci-blue focus:outline-none focus:ring-2 focus:ring-jci-blue focus:bg-white transition-all uppercase"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowProgModal(false)}
                                    className="px-4 py-2.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2.5 bg-jci-blue hover:bg-primary-600 text-white rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-50"
                                >
                                    {submitting
                                        ? 'Guardando...'
                                        : editingProgId !== null
                                            ? 'Guardar Cambios'
                                            : 'Crear Programa'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
};
