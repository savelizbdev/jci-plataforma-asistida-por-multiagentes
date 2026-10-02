/**
 * Tipos TypeScript para el módulo de Reportes
 */

export interface ReporteRequest {
    id_mentor: string;
    fecha_inicio: string; // ISO string
    fecha_fin: string; // ISO string
    id_programa?: number | null;
}

export interface ReporteAdminRequest {
    fecha_inicio: string; // ISO string
    fecha_fin: string; // ISO string
    admin_id?: string;
    id_programa?: number | null;
}

export interface ReporteEmprendedorRequest {
    id_emprendedor: string;
    id_programa?: number | null;
}

export interface ReporteMentorRequest {
    id_mentor: string;
    id_programa?: number | null;
}

export interface ReporteTodosMentoresRequest {
    admin_id?: string;
    id_programa?: number | null;
}
