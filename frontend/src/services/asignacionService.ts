/**
 * Servicio para gestión de asignaciones mentor-emprendedor
 */
import { api } from './api';

export interface Usuario {
    id_usuario: string;
    nombre: string | null;
    apellido: string | null;
    email: string;
    nombre_emprendimiento?: string | null;
}

export interface AsignarMentoresRequest {
    id_mentor: string;
    id_emprendedores: string[];
}

export interface AsignarMentoresResponse {
    message: string;
    cantidad: number;
}

export interface EmprendedorConMentor {
    id_emprendedor: string;
    emprendedor: Usuario;
    mentor: Usuario;
}

export interface QuitarAsignacionResponse {
    message: string;
    id_emprendedor: string;
}

/**
 * Obtiene todos los usuarios con rol Mentor (id_rol = 3)
 */
export const obtenerMentores = async (adminId?: string): Promise<Usuario[]> => {
    const response = await api.get<Usuario[]>('/asignaciones/mentores', {
        params: adminId ? { admin_id: adminId } : {},
    });
    return response.data;
};

/**
 * Obtiene emprendedores sin mentor asignado
 */
export const obtenerEmprendedoresSinMentor = async (adminId?: string): Promise<Usuario[]> => {
    const response = await api.get<Usuario[]>('/asignaciones/emprendedores-sin-mentor', {
        params: adminId ? { admin_id: adminId } : {},
    });
    return response.data;
};

/**
 * Asigna múltiples emprendedores a un mentor
 */
export const asignarMentores = async (
    data: AsignarMentoresRequest
): Promise<AsignarMentoresResponse> => {
    const response = await api.post<AsignarMentoresResponse>('/asignaciones/asignar-mentores', data);
    return response.data;
};

/**
 * Obtiene emprendedores que ya tienen un mentor asignado
 */
export const obtenerEmprendedoresConMentor = async (adminId?: string): Promise<EmprendedorConMentor[]> => {
    const response = await api.get<EmprendedorConMentor[]>('/asignaciones/emprendedores-con-mentor', {
        params: adminId ? { admin_id: adminId } : {},
    });
    return response.data;
};

/**
 * Elimina permanentemente la asignación de un emprendedor
 */
export const quitarAsignacion = async (id_emprendedor: string): Promise<QuitarAsignacionResponse> => {
    const response = await api.delete<QuitarAsignacionResponse>('/asignaciones/quitar-asignacion', {
        data: { id_emprendedor }
    });
    return response.data;
};
