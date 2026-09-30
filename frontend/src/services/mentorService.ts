/**
 * Servicio para operaciones del Mentor
 */
import api from './api';
import type {
    MentorDashboardStats,
    EmprendedorAsignado,
    DiagnosticoResumen,
    ConversacionDiagnostico,
    UpdateCalificacionResponse
} from '../types/mentor';

export const mentorService = {
    /**
     * Obtiene las estadísticas del dashboard para un mentor
     */
    async getMentorDashboard(idMentor: string, idPrograma?: number): Promise<MentorDashboardStats> {
        const response = await api.get<MentorDashboardStats>(
            `/mentor/dashboard/${idMentor}`,
            { params: idPrograma ? { id_programa: idPrograma } : {} }
        );
        return response.data;
    },

    /**
     * Obtiene los emprendedores asignados a un mentor
     */
    async getEmprendedoresAsignados(idMentor: string, idPrograma?: number): Promise<EmprendedorAsignado[]> {
        const response = await api.get<EmprendedorAsignado[]>(
            `/mentor/emprendedores/${idMentor}`,
            { params: idPrograma ? { id_programa: idPrograma } : {} }
        );
        return response.data;
    },

    /**
     * Obtiene los diagnósticos de un emprendedor
     */
    async getDiagnosticosEmprendedor(idEmprendedor: string): Promise<DiagnosticoResumen[]> {
        const response = await api.get<DiagnosticoResumen[]>(
            `/mentor/diagnosticos/${idEmprendedor}`
        );
        return response.data;
    },

    /**
     * Obtiene la conversación completa de un diagnóstico
     */
    async getConversacionDiagnostico(idDiagnostico: number): Promise<ConversacionDiagnostico> {
        const response = await api.get<ConversacionDiagnostico>(
            `/mentor/diagnostico/${idDiagnostico}/conversacion`
        );
        return response.data;
    },

    /**
     * Activa o desactiva el acceso al diagnóstico para un emprendedor
     */
    async toggleHabilitadoDiag(userId: string, habilitado: boolean): Promise<{ habilitado_diag: boolean }> {
        const response = await api.patch(
            `/mentor/${userId}/toggle-diag`,
            null,
            { params: { habilitado } }
        );
        return response.data;
    },

    /**
     * Actualiza la calificación de una respuesta individual y recalcula todo
     */
    async updateCalificacion(idDetalle: number, puntaje: number): Promise<UpdateCalificacionResponse> {
        const response = await api.put<UpdateCalificacionResponse>(
            `/mentor/detalle/${idDetalle}/calificacion`,
            { puntaje }
        );
        return response.data;
    }
};
