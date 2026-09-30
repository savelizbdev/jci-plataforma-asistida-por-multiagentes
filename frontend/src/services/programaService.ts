import api from './api';
import { ProgramaItem, OrganizacionItem, UnirseProgramaResponse } from '../types/programa';

export const programaService = {
    /**
     * Canjear un código de 8 caracteres para unirse a un programa
     */
    async unirseAPrograma(id_usuario: string, codigo: string): Promise<UnirseProgramaResponse> {
        const { data } = await api.post<UnirseProgramaResponse>('/programas/unirse', {
            id_usuario,
            codigo: codigo.trim().toUpperCase(),
        });
        return data;
    },

    /**
     * Obtener los programas en los que está enrolado el usuario
     */
    async obtenerMisProgramas(id_usuario: string): Promise<ProgramaItem[]> {
        const { data } = await api.get<ProgramaItem[]>('/programas/mis-programas', {
            params: { id_usuario },
        });
        return data || [];
    },

    /**
     * Listar organizaciones (Super Admin)
     */
    async listarOrganizaciones(): Promise<OrganizacionItem[]> {
        const { data } = await api.get<OrganizacionItem[]>('/superadmin/organizaciones');
        return data || [];
    },

    /**
     * Crear nueva organización (Super Admin)
     */
    async crearOrganizacion(nombre: string, descripcion?: string): Promise<OrganizacionItem> {
        const { data } = await api.post<OrganizacionItem>('/superadmin/organizaciones', {
            nombre,
            descripcion,
        });
        return data;
    },

    /**
     * Listar programas (Super Admin)
     */
    async listarProgramas(id_organizacion?: number): Promise<any[]> {
        const { data } = await api.get('/superadmin/programas', {
            params: id_organizacion ? { id_organizacion } : {},
        });
        return data || [];
    },

    /**
     * Crear nuevo programa con código de 8 caracteres (Super Admin)
     */
    async crearPrograma(id_organizacion: number, nombre: string, codigo: string): Promise<any> {
        const { data } = await api.post('/superadmin/programas', {
            id_organizacion,
            nombre,
            codigo: codigo.trim().toUpperCase(),
        });
        return data;
    },
};
