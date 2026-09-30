/**
 * Tipos TypeScript para el módulo de Reportes
 */

export interface ReporteRequest {
    id_mentor: string;
    fecha_inicio: string; // ISO string
    fecha_fin: string; // ISO string
}

export interface ReporteAdminRequest {
    fecha_inicio: string; // ISO string
    fecha_fin: string; // ISO string
    admin_id?: string;
}

export interface ReporteEmprendedorRequest {
    id_emprendedor: string;
}

export interface ReporteMentorRequest {
    id_mentor: string;
}
