/**
 * Funciones puras de utilidad para Ubicación Geográfica (Spec 005)
 */

export interface PaisItem {
    codigo: string;
    nombre: string;
    bandera: string; // Emoji de bandera UTF-8
}

export interface EstadoUbicacion {
    esPendiente: boolean;
    texto: string;
    nacionalidad?: string;
    municipio?: string;
}

/**
 * Procesa la respuesta de la API REST Countries:
 * - Excluye a Bolivia para evitar redundancia con el switch nacional.
 * - Mapea al nombre común en español y la bandera en emoji.
 * - Ordena alfabéticamente según la configuración regional en español.
 */
export function procesarPaisesRestCountries(paisesRaw: any[]): PaisItem[] {
    if (!Array.isArray(paisesRaw)) return [];

    return paisesRaw
        .filter((item) => {
            const nombreEsp = item.translations?.spa?.common || item.name?.common || '';
            return nombreEsp.toLowerCase().trim() !== 'bolivia';
        })
        .map((item) => {
            const nombre = item.translations?.spa?.common || item.name?.common || 'Desconocido';
            const bandera = item.flag || '🌍';
            const codigo = item.cca2 || nombre;
            return { codigo, nombre, bandera };
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
}

/**
 * Valida si los campos obligatorios del formulario están completos:
 * - Si es nacional: solo requiere municipio.
 * - Si es extranjero: requiere país y municipio.
 */
export function validarFormularioUbicacion(
    esNacional: boolean,
    paisSeleccionado: string,
    municipioSeleccionado: string
): boolean {
    const munValido = Boolean(municipioSeleccionado && municipioSeleccionado.trim().length > 0);
    if (esNacional) {
        return munValido;
    }
    const paisValido = Boolean(paisSeleccionado && paisSeleccionado.trim().length > 0);
    return paisValido && munValido;
}

/**
 * Normaliza una cadena de texto a mayúsculas respetando las tildes y caracteres oficiales del español.
 */
export function normalizarMayusculasOficiales(texto: string): string {
    if (!texto) return '';
    return texto.trim().toLocaleUpperCase('es-BO');
}

/**
 * Evalúa si la ubicación de un emprendedor está completa o en estado pendiente.
 */
export function evaluarEstadoUbicacion(
    nacionalidad?: string | null,
    municipio?: string | null
): EstadoUbicacion {
    const nacLimpia = (nacionalidad || '').trim();
    const munLimpio = (municipio || '').trim();

    if (!nacLimpia || !munLimpio) {
        return {
            esPendiente: true,
            texto: 'PENDIENTE',
        };
    }

    return {
        esPendiente: false,
        texto: `${normalizarMayusculasOficiales(munLimpio)}, ${normalizarMayusculasOficiales(nacLimpia)}`,
        nacionalidad: normalizarMayusculasOficiales(nacLimpia),
        municipio: normalizarMayusculasOficiales(munLimpio),
    };
}

