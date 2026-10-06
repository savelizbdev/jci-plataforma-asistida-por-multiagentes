/**
 * Servicio API para operaciones de Super Administrador (Spec 004)
 */
import { api } from './api';
import {
    OrganizacionSimple,
    ProgramaSimple,
    SuperAdminUsuario,
    DiagnosticoSupervisionItem,
    AsignacionesResponse,
    PaginatedResponse,
    CambiarRolRequest,
    CambiarEstadoUsuarioRequest,
    MatricularUsuarioRequest,
} from '../types/superAdmin';

export const superAdminService = {
    async listarOrganizacionesActivas(): Promise<OrganizacionSimple[]> {
        const response = await api.get<OrganizacionSimple[]>('/api/superadmin/organizaciones-activas');
        return response.data;
    },

    async listarProgramasActivos(idOrganizacion: number): Promise<ProgramaSimple[]> {
        const response = await api.get<ProgramaSimple[]>('/api/superadmin/programas-activos', {
            params: { id_organizacion: idOrganizacion },
        });
        return response.data;
    },

    async obtenerUsuariosPaginados(
        idOrganizacion: number,
        idPrograma?: number | null,
        page: number = 1,
        limit: number = 15
    ): Promise<PaginatedResponse<SuperAdminUsuario>> {
        const params: Record<string, any> = {
            id_organizacion: idOrganizacion,
            page,
            limit,
        };
        if (idPrograma !== undefined && idPrograma !== null) {
            params.id_programa = idPrograma;
        }
        const response = await api.get<PaginatedResponse<SuperAdminUsuario>>('/api/superadmin/usuarios', { params });
        return response.data;
    },

    async obtenerUsuariosSinPrograma(
        idOrganizacion: number,
        page: number = 1,
        limit: number = 15
    ): Promise<PaginatedResponse<SuperAdminUsuario>> {
        const response = await api.get<PaginatedResponse<SuperAdminUsuario>>('/api/superadmin/usuarios-sin-programa', {
            params: { id_organizacion: idOrganizacion, page, limit },
        });
        return response.data;
    },

    async cambiarRol(idUsuario: string, nuevoRol: number): Promise<{ success: boolean; message: string }> {
        const payload: CambiarRolRequest = { id_usuario: idUsuario, nuevo_rol: nuevoRol };
        const response = await api.put<{ success: boolean; message: string }>('/api/superadmin/cambiar-rol', payload);
        return response.data;
    },

    async cambiarEstadoUsuario(idUsuario: string, activo: boolean): Promise<{ success: boolean; message: string }> {
        const payload: CambiarEstadoUsuarioRequest = { id_usuario: idUsuario, activo };
        const response = await api.put<{ success: boolean; message: string }>('/api/superadmin/cambiar-estado-usuario', payload);
        return response.data;
    },

    async matricularUsuario(idUsuario: string, idPrograma: number): Promise<{ success: boolean; message: string }> {
        const payload: MatricularUsuarioRequest = { id_usuario: idUsuario, id_programa: idPrograma };
        const response = await api.post<{ success: boolean; message: string }>('/api/superadmin/matricular-usuario', payload);
        return response.data;
    },

    async obtenerAsignaciones(
        idOrganizacion: number,
        idPrograma?: number | null,
        pageMentores: number = 1,
        pageSinMentor: number = 1,
        pageConMentor: number = 1,
        limit: number = 15
    ): Promise<AsignacionesResponse> {
        const params: Record<string, any> = {
            id_organizacion: idOrganizacion,
            page_mentores: pageMentores,
            page_sin_mentor: pageSinMentor,
            page_con_mentor: pageConMentor,
            limit,
        };
        if (idPrograma !== undefined && idPrograma !== null) {
            params.id_programa = idPrograma;
        }
        const response = await api.get<AsignacionesResponse>('/api/superadmin/asignaciones', { params });
        return response.data;
    },

    async asignarMentor(idMentor: string, idEmprendedores: string[]): Promise<{ success: boolean; message: string }> {
        const response = await api.post<{ success: boolean; message: string }>('/api/superadmin/asignaciones/asignar', {
            id_mentor: idMentor,
            id_emprendedores: idEmprendedores,
        });
        return response.data;
    },

    async desasignarMentor(idEmprendedor: string): Promise<{ success: boolean; message: string }> {
        const response = await api.post<{ success: boolean; message: string }>('/api/superadmin/asignaciones/desasignar', {
            id_emprendedor: idEmprendedor,
        });
        return response.data;
    },

    async obtenerDiagnosticos(
        idOrganizacion: number,
        idPrograma?: number | null,
        page: number = 1,
        limit: number = 15
    ): Promise<PaginatedResponse<DiagnosticoSupervisionItem>> {
        const params: Record<string, any> = {
            id_organizacion: idOrganizacion,
            page,
            limit,
        };
        if (idPrograma !== undefined && idPrograma !== null) {
            params.id_programa = idPrograma;
        }
        const response = await api.get<PaginatedResponse<DiagnosticoSupervisionItem>>('/api/superadmin/diagnosticos', { params });
        return response.data;
    },
};
