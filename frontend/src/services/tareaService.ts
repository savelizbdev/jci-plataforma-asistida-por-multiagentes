/**
 * Servicio para gestión de tareas
 */
import { api } from './api';

export interface Tarea {
    id_tarea: number;
    id_usuario: string;
    id_diagnostico: number | null;
    titulo: string;
    descripcion: string | null;
    fecha_asignacion: string;
    fecha_expiracion: string | null;
    estado: string;
    nombre_programa?: string;
}

export interface TareaCreate {
    id_usuario: string;
    id_diagnostico: number;
    titulo: string;
    descripcion?: string;
    fecha_expiracion: string; // ISO string
}

/**
 * Crea una nueva tarea asignada a un emprendedor
 */
export const createTarea = async (data: TareaCreate): Promise<Tarea> => {
    const response = await api.post<Tarea>('/tarea', data);
    return response.data;
};

/**
 * Obtiene todas las tareas del usuario actual
 */
export const obtenerMisTareas = async (userId: string): Promise<Tarea[]> => {
    const response = await api.get<Tarea[]>(`/asignaciones/tareas/mis-tareas?user_id=${userId}`);
    return response.data;
};

/**
 * Marca una tarea como completada
 */
export const marcarTareaCompletada = async (idTarea: number, userId: string): Promise<Tarea> => {
    const response = await api.patch<Tarea>(`/asignaciones/tareas/${idTarea}/completar?user_id=${userId}`);
    return response.data;
};
