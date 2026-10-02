/**
 * Servicio para datos del Administrador
 */
import api from './api';
import type { AdminDashboardData } from '../types/admin';

export interface ErrorDetalle {
    id_usuario: string;
    email: string;
    motivo: string;
}

export interface SeguimientoResult {
    mensaje: string;
    total_tareas?: number;
    total_emprendedores?: number;
    enviados_exitosos?: number;
    fallidos?: number;
    errores_detalle?: ErrorDetalle[];
    resumen_agente: string;
}

export const adminService = {
    /**
     * Obtiene las estadísticas globales para el dashboard del administrador
     * filtradas por la organización del admin si se especifica
     */
    async getAdminDashboard(adminId?: string): Promise<AdminDashboardData> {
        const { data } = await api.get<AdminDashboardData>('/admin/dashboard', {
            params: adminId ? { admin_id: adminId } : {},
        });
        return data;
    },

    /**
     * Dispara manualmente el agente de seguimiento de tareas.
     * El agente crea una sesión temporal, envía los correos de recordatorio
     * y cierra la sesión automáticamente al terminar.
     */
    async ejecutarSeguimiento(adminId?: string): Promise<SeguimientoResult> {
        const { data } = await api.post<SeguimientoResult>(
            '/seguimiento/ejecutar',
            adminId ? { admin_id: adminId } : {}
        );
        return data;
    },
};
