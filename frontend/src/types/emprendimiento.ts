/**
 * Tipos TypeScript para Emprendimiento y Estado de Emprendimiento
 */

/**
 * Tipos de rubro para emprendimientos
 */
export enum Rubro {
    COMERCIO_VENTAS = "Comercio y Ventas",
    GASTRONOMIA = "Gastronomía",
    SERVICIOS_PERSONALES = "Servicios Personales",
    ARTES_MANUALIDADES = "Artes y Manualidades",
    TECNOLOGIA_EDUCACION = "Tecnología y Educación",
    AGRO_PRODUCCION = "Agro y Producción",
    OTROS = "Otros"
}

/**
 * Interface para Emprendimiento
 */
export interface Emprendimiento {
    id_emprendimiento: number;
    id_usuario: string;
    nombre: string;
    rubro: string;
    anio_inicio: number;
    created_at: string;
}

/**
 * Datos de formulario para crear Emprendimiento
 */
export interface EmprendimientoFormData {
    nombre: string;
    rubro: Rubro;
    anio_inicio: number;
}

/**
 * Datos de formulario de contexto para el diagnóstico (personal y ventas)
 */
export interface EstadoEmprendimientoFormData {
    numero_personal: number;
    ventas_men_prom: number;
}

