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

export interface EmprendedorReporte {
    nombre: string;
    apellido: string;
    emprendimiento?: string | null;
    nacionalidad?: string | null;
    municipio?: string | null;
    promedio_general?: number | null;
    promedio_cf?: number | null;
    promedio_gp?: number | null;
    promedio_m?: number | null;
    promedio_v?: number | null;
    promedio_tp?: number | null;
    promedio_rh?: number | null;
    promedio_ec?: number | null;
    num_diagnosticos?: number;
    estado_diagnostico?: string;
}

