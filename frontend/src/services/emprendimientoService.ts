/**
 * Servicio de Emprendimiento
 * Maneja operaciones relacionadas con emprendimientos
 */
import api from './api';
import { Emprendimiento } from '../types/emprendimiento';

/**
 * Request para crear emprendimiento
 */
interface CreateEmprendimientoRequest {
    id_usuario: string;
    nombre: string;
    rubro: string;
    anio_inicio: number;
}

export const emprendimientoService = {
    /**
     * Crea un nuevo emprendimiento para un usuario
     */
    async createEmprendimiento(data: CreateEmprendimientoRequest): Promise<Emprendimiento> {
        try {
            const response = await api.post<Emprendimiento>('/emprendimiento', data);
            return response.data;
        } catch (error: any) {
            throw new Error(
                error.response?.data?.detail || 'Error al crear emprendimiento'
            );
        }
    },

    /**
     * Obtiene el emprendimiento de un usuario
     */
    async getEmprendimientoByUser(idUsuario: string): Promise<Emprendimiento | null> {
        try {
            const response = await api.get<Emprendimiento | null>(
                `/emprendimiento/usuario/${idUsuario}`
            );
            return response.data;
        } catch (error: any) {
            throw new Error(
                error.response?.data?.detail || 'Error al obtener emprendimiento'
            );
        }
    },
};

