/**
 * Tipos y interfaces para el sistema
 */

export interface Role {
    id_rol: number;
    rol: string;
}

export interface User {
    id_usuario: string;
    email: string;
    nombre?: string;
    apellido?: string;
    id_rol: number;
    rol: string;
    estado: boolean;
    habilitado_diag: boolean;
    celular?: string;
    nacionalidad?: string | null;
    municipio?: string | null;
}

export interface AuthResponse {
    user: User;
    message: string;
}

export interface GoogleUser {
    id: string;
    email: string;
    name: string;
    picture?: string;
}
