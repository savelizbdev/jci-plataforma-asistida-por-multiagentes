/**
 * Contexto de filtros jerárquicos (Organización y Programa) para Super Administrador (Spec 004)
 * Mantiene la selección activa en memoria de React por pestaña sin almacenamiento persistente.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { superAdminService } from '../services/superAdminService';
import { OrganizacionSimple, ProgramaSimple } from '../types/superAdmin';

interface SuperAdminFilterContextType {
    selectedOrgId: number | null;
    selectedProgId: number | 'todos' | null;
    organizaciones: OrganizacionSimple[];
    programas: ProgramaSimple[];
    loadingOrgs: boolean;
    loadingProgs: boolean;
    setSelectedOrgId: (id: number | null) => void;
    setSelectedProgId: (id: number | 'todos' | null) => void;
    cargarOrganizaciones: () => Promise<void>;
    recargarFiltros: () => Promise<void>;
}

const SuperAdminFilterContext = createContext<SuperAdminFilterContextType | undefined>(undefined);

export const SuperAdminFilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [selectedOrgId, setSelectedOrgIdState] = useState<number | null>(null);
    const [selectedProgId, setSelectedProgIdState] = useState<number | 'todos' | null>(null);
    const [organizaciones, setOrganizaciones] = useState<OrganizacionSimple[]>([]);
    const [programas, setProgramas] = useState<ProgramaSimple[]>([]);
    const [loadingOrgs, setLoadingOrgs] = useState<boolean>(false);
    const [loadingProgs, setLoadingProgs] = useState<boolean>(false);

    const cargarOrganizaciones = useCallback(async () => {
        setLoadingOrgs(true);
        try {
            const data = await superAdminService.listarOrganizacionesActivas();
            setOrganizaciones(data);
        } catch (error) {
            console.error('Error cargando organizaciones activas:', error);
            setOrganizaciones([]);
        } finally {
            setLoadingOrgs(false);
        }
    }, []);

    const cargarProgramas = useCallback(async (orgId: number) => {
        setLoadingProgs(true);
        try {
            const data = await superAdminService.listarProgramasActivos(orgId);
            setProgramas(data);
        } catch (error) {
            console.error('Error cargando programas activos:', error);
            setProgramas([]);
        } finally {
            setLoadingProgs(false);
        }
    }, []);

    useEffect(() => {
        cargarOrganizaciones();
    }, [cargarOrganizaciones]);

    const setSelectedOrgId = useCallback((id: number | null) => {
        setSelectedOrgIdState(id);
        if (id) {
            setSelectedProgIdState('todos');
            cargarProgramas(id);
        } else {
            setSelectedProgIdState(null);
            setProgramas([]);
        }
    }, [cargarProgramas]);

    const setSelectedProgId = useCallback((id: number | 'todos' | null) => {
        setSelectedProgIdState(id);
    }, []);

    const recargarFiltros = useCallback(async () => {
        await cargarOrganizaciones();
        if (selectedOrgId) {
            await cargarProgramas(selectedOrgId);
        }
    }, [cargarOrganizaciones, cargarProgramas, selectedOrgId]);

    return (
        <SuperAdminFilterContext.Provider
            value={{
                selectedOrgId,
                selectedProgId,
                organizaciones,
                programas,
                loadingOrgs,
                loadingProgs,
                setSelectedOrgId,
                setSelectedProgId,
                cargarOrganizaciones,
                recargarFiltros,
            }}
        >
            {children}
        </SuperAdminFilterContext.Provider>
    );
};

export const useSuperAdminFilters = (): SuperAdminFilterContextType => {
    const context = useContext(SuperAdminFilterContext);
    if (!context) {
        throw new Error('useSuperAdminFilters debe ser utilizado dentro de un SuperAdminFilterProvider');
    }
    return context;
};
