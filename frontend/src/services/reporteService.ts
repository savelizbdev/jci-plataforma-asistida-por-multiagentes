/**
 * Servicio para generación de reportes
 */
import { api } from './api';
import type { ReporteRequest, ReporteAdminRequest, ReporteEmprendedorRequest, ReporteMentorRequest } from '../types/reporte';

export const reporteService = {
    /** Reporte PDF del mentor (filtrado por fechas) */
    async generarReporte(request: ReporteRequest): Promise<Blob> {
        const response = await api.post<Blob>('/reporte/generar', request, { responseType: 'blob' });
        return response.data;
    },

    /** Reporte PDF global — todos los emprendedores del sistema */
    async generarReporteAdmin(request: ReporteAdminRequest): Promise<Blob> {
        const response = await api.post<Blob>('/reporte/generar-admin', request, { responseType: 'blob' });
        return response.data;
    },

    /** Reporte PDF de evolución individual de un emprendedor */
    async generarReporteEmprendedor(request: ReporteEmprendedorRequest): Promise<Blob> {
        const response = await api.post<Blob>('/reporte/generar-emprendedor', request, { responseType: 'blob' });
        return response.data;
    },

    /** Reporte PDF de un mentor específico (todo el historial de sus emprendedores) */
    async generarReporteMentor(request: ReporteMentorRequest): Promise<Blob> {
        const response = await api.post<Blob>('/reporte/generar-mentor', request, { responseType: 'blob' });
        return response.data;
    },

    /** Reporte PDF comparativo de todos los mentores */
    async generarReporteTodosMentores(adminId?: string): Promise<Blob> {
        const response = await api.post<Blob>(
            '/reporte/generar-todos-mentores',
            adminId ? { admin_id: adminId } : {},
            { responseType: 'blob' }
        );
        return response.data;
    },
};
