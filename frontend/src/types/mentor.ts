/**
 * Tipos para el Mentor
 */

export interface AreaPromedios {
    cf: number; // Costos y Finanzas
    gp: number; // Gestión de Procesos
    m: number;  // Marketing
    v: number;  // Ventas
    tp: number; // Tecnologías y Procesos
    rh: number; // Recursos Humanos
    ec: number; // Economía del Cuidado
}

export interface MentorDashboardStats {
    total_emprendedores: number;
    tasa_exito: number; // Porcentaje 0-100
    promedio_general: number; // Puntaje promedio 0-100
    emprendedores_habilitados: number;
    promedios_por_area: AreaPromedios;
}

// ==================== TIPOS PARA RESULTADOS DE DIAGNÓSTICO ====================

export interface EmprendedorAsignado {
    id_usuario: string;
    nombre: string;
    apellido: string;
    habilitado_diag: boolean;
    celular?: number;
    nombre_emprendimiento?: string;
    rubro_emprendimiento?: string;
    nacionalidad?: string | null;
    municipio?: string | null;
}

export interface DiagnosticoResumen {
    id_diagnostico: number;
    numero: number;
    fecha_inicio: string;
    resultado: string;
    puntaje_total: number;
    puntaje_cf: number;
    puntaje_gp: number;
    puntaje_m: number;
    puntaje_v: number;
    puntaje_tp: number;
    puntaje_rh: number;
    puntaje_ec: number;
}

export interface PreguntaRespuesta {
    id_detalle: number;
    id_pregunta: number;
    pregunta: string;
    respuesta: string;
    puntaje: number;
}

export interface AreaConversacion {
    id_area: number;
    area_nombre: string;
    preguntas: PreguntaRespuesta[];
}

export interface AreaDetalle {
    nombre: string;
    puntaje: number;
}

export interface ConversacionDiagnostico {
    id_diagnostico: number;
    fecha: string;
    resultado: string;
    puntaje_total: number;
    conclusion?: string;
    recomendaciones?: string;
    inconsistencias?: string;
    areas: {
        cf: AreaDetalle;
        gp: AreaDetalle;
        m: AreaDetalle;
        v: AreaDetalle;
        tp: AreaDetalle;
        rh: AreaDetalle;
        ec: AreaDetalle;
    };
    conversacion: AreaConversacion[];
}

export interface UpdateCalificacionResponse {
    puntaje_area: number;
    area_key: string;
    puntaje_total: number;
    resultado: string;
}
