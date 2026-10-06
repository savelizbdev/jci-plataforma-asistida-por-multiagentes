/**
 * Barra de filtrado jerárquico para Super Administrador (Spec 004)
 * - Organización (obligatoria)
 * - Programa (dependiente, ordenado alfabéticamente)
 * - Responsive: flex-row en escritorio, flex-col en móvil con controles táctiles >= 44px
 */
import React from 'react';
import { useSuperAdminFilters } from '../../context/SuperAdminFilterContext';

interface SuperAdminFilterBarProps {
    allowAllPrograms?: boolean;
    onOrgChangeCustom?: (orgId: number | null) => void;
    onProgChangeCustom?: (progId: number | 'todos' | null) => void;
}

export const SuperAdminFilterBar: React.FC<SuperAdminFilterBarProps> = ({
    allowAllPrograms = true,
    onOrgChangeCustom,
    onProgChangeCustom,
}) => {
    const {
        selectedOrgId,
        selectedProgId,
        organizaciones,
        programas,
        loadingOrgs,
        loadingProgs,
        setSelectedOrgId,
        setSelectedProgId,
    } = useSuperAdminFilters();

    const handleOrgChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value ? Number(e.target.value) : null;
        setSelectedOrgId(val);
        if (onOrgChangeCustom) {
            onOrgChangeCustom(val);
        }
    };

    const handleProgChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        const parsed = val === 'todos' ? 'todos' : val ? Number(val) : null;
        setSelectedProgId(parsed);
        if (onProgChangeCustom) {
            onProgChangeCustom(parsed);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
                {/* Selector de Organización */}
                <div className="flex-1">
                    <label htmlFor="superadmin-org-select" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                        Organización <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <select
                            id="superadmin-org-select"
                            value={selectedOrgId || ''}
                            onChange={handleOrgChange}
                            disabled={loadingOrgs}
                            className="w-full h-11 px-3.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed appearance-none pr-10"
                        >
                            <option value="">-- Seleccione una organización --</option>
                            {organizaciones.map((org) => (
                                <option key={org.id_organizacion} value={org.id_organizacion}>
                                    {org.nombre}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Selector de Programa */}
                <div className="flex-1">
                    <label htmlFor="superadmin-prog-select" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                        Programa {selectedOrgId && <span className="text-gray-400 font-normal">(dependiente)</span>}
                    </label>
                    <div className="relative">
                        <select
                            id="superadmin-prog-select"
                            value={selectedProgId || ''}
                            onChange={handleProgChange}
                            disabled={!selectedOrgId || loadingProgs || programas.length === 0}
                            className="w-full h-11 px-3.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed appearance-none pr-10"
                        >
                            {!selectedOrgId ? (
                                <option value="">Seleccione una organización primero</option>
                            ) : loadingProgs ? (
                                <option value="">Cargando programas...</option>
                            ) : programas.length === 0 ? (
                                <option value="">Sin programas activos</option>
                            ) : (
                                <>
                                    {allowAllPrograms && <option value="todos">Todos los programas</option>}
                                    {programas.map((prog) => (
                                        <option key={prog.id_programa} value={prog.id_programa}>
                                            {prog.nombre_programa}
                                        </option>
                                    ))}
                                </>
                            )}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Aviso informativo cuando no hay organización seleccionada */}
            {!selectedOrgId && (
                <div className="mt-3 text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5 flex items-center gap-2 border border-amber-200">
                    <svg className="w-4 h-4 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Seleccione una organización para comenzar a visualizar los datos de la plataforma.</span>
                </div>
            )}
        </div>
    );
};
