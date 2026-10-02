/**
 * Servicio de Gestión de Usuarios
 * Maneja operaciones CRUD de usuarios
 */
import api from './api';
import { User } from '../types/user';

export const userService = {
    /**
     * Obtiene todos los usuarios del sistema (o los de la organización del admin)
     */
    async getAllUsers(adminId?: string): Promise<User[]> {
        try {
            const response = await api.get<User[]>('/auth/users', {
                params: adminId ? { admin_id: adminId } : {},
            });
            return response.data;
        } catch (error: any) {
            throw new Error(
                error.response?.data?.detail || 'Error al obtener usuarios'
            );
        }
    },

    /**
     * Deshabilita un usuario (cambia estado a false)
     */
    async disableUser(userId: string): Promise<User> {
        try {
            const response = await api.patch<User>(`/auth/${userId}/disable`);
            return response.data;
        } catch (error: any) {
            throw new Error(
                error.response?.data?.detail || 'Error al deshabilitar usuario'
            );
        }
    },

    /**
     * Actualiza el rol, permisos de diagnóstico y estado de un usuario
     */
    async updateUserRolePermissions(userId: string, idRol: number, habilitadoDiag: boolean, estado: boolean): Promise<User> {
        try {
            const response = await api.patch<User>(`/auth/${userId}/role-permissions`, {
                id_rol: idRol,
                habilitado_diag: habilitadoDiag,
                estado: estado
            });
            return response.data;
        } catch (error: any) {
            throw new Error(
                error.response?.data?.detail || 'Error al actualizar rol, permisos y estado'
            );
        }
    },

    /**
     * Alterna de forma atómica el estado activo/inactivo de un usuario (para control tipo switch)
     */
    async toggleUserStatus(userId: string): Promise<{ id_usuario: string; estado: boolean }> {
        try {
            const response = await api.patch<{ id_usuario: string; estado: boolean }>(`/auth/${userId}/toggle-status`);
            return response.data;
        } catch (error: any) {
            throw new Error(
                error.response?.data?.detail || 'Error al alternar estado del usuario'
            );
        }
    },
};
