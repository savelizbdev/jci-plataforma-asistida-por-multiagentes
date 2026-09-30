export interface ProgramaItem {
    id_programa: number;
    nombre_programa: string;
    codigo: string;
    id_organizacion: number;
    nombre_organizacion: string;
    fecha_union?: string;
}

export interface OrganizacionItem {
    id_organizacion: number;
    nombre: string;
    descripcion?: string;
    estado: boolean;
    created_at?: string;
}

export interface UnirseProgramaResponse {
    success: boolean;
    message: string;
    id_programa: number;
    nombre_programa: string;
    id_organizacion: number;
    nombre_organizacion: string;
}
