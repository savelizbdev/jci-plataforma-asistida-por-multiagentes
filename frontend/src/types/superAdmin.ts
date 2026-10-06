/**
 * Tipos TypeScript para el módulo de Super Administrador (Spec 004)
 */

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

export interface OrganizacionSimple {
    id_organizacion: number;
    nombre: string;
    descripcion?: string;
    estado: boolean;
}

export interface ProgramaSimple {
    id_programa: number;
    nombre_programa: string;
    id_organizacion: number;
    codigo?: string;
    estado: boolean;
}

export interface SuperAdminUsuario {
    id_usuario: string;
    nombre: string;
    apellido: string;
    correo: string;
    id_rol: number;
    nombre_rol?: string;
    estado: boolean;
    programas_ids: number[];
    programas_nombres: string[];
}

export interface DiagnosticoSupervisionItem {
    id_diagnostico?: string;
    id_emprendedor: string;
    nombre: string;
    apellido: string;
    emprendimiento?: string;
    id_programa: number;
    nombre_programa: string;
    estado_diagnostico: string;
    resultado?: string | null;
    promedio_general?: number | null;
    promedio_cf?: number | null;
    promedio_gp?: number | null;
    promedio_m?: number | null;
    promedio_v?: number | null;
    promedio_tp?: number | null;
    promedio_rh?: number | null;
    promedio_ec?: number | null;
    conclusion?: string | null;
    recomendaciones?: string | null;
    inconsistencias?: string | null;
    fecha_inicio?: string;
}

export interface EmprendedorConMentorItem {
    id_asignacion?: string;
    id_emprendedor: string;
    nombre: string;
    apellido: string;
    correo: string;
    emprendimiento?: string;
    id_mentor: string;
    mentor_nombre: string;
    mentor_apellido: string;
    id_programa?: number;
    nombre_programa?: string;
}

export interface AsignacionesResponse {
    mentores: PaginatedResponse<SuperAdminUsuario>;
    emprendedores_sin_mentor: PaginatedResponse<SuperAdminUsuario>;
    emprendedores_con_mentor: PaginatedResponse<EmprendedorConMentorItem>;
}

export interface CambiarRolRequest {
    id_usuario: string;
    nuevo_rol: number;
}

export interface CambiarEstadoUsuarioRequest {
    id_usuario: string;
    activo: boolean;
}

export interface MatricularUsuarioRequest {
    id_usuario: string;
    id_programa: number;
}
