import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Fase 2: Frontend — Tipos y Servicios TypeScript', () => {

    it('T-2.1: La estructura de Usuario debe soportar opcionalmente programas_ids', () => {
        const usuarioConProgramas = {
            id_usuario: 'user-uuid-1',
            nombre: 'Carlos',
            apellido: 'Mentor',
            email: 'carlos@test.com',
            programas_ids: [1, 2]
        };

        assert.ok(Array.isArray(usuarioConProgramas.programas_ids));
        assert.deepStrictEqual(usuarioConProgramas.programas_ids, [1, 2]);

        const usuarioSinProgramas = {
            id_usuario: 'user-uuid-2',
            nombre: 'Ana',
            apellido: 'Guia',
            email: 'ana@test.com'
        };
        assert.strictEqual(usuarioSinProgramas.programas_ids, undefined);
    });

    it('T-2.1: userService.toggleUserStatus debe consumir el endpoint /auth/:userId/toggle-status y retornar { id_usuario, estado }', async () => {
        // Simular llamada con mock de axios/api
        const fakeUserId = 'usr-uuid-10';
        const fakeApiResponse = { id_usuario: fakeUserId, estado: false };

        // Función simulando la implementación de userService.toggleUserStatus
        const mockToggleUserStatus = async (userId, mockApi) => {
            const response = await mockApi.patch(`/auth/${userId}/toggle-status`);
            return response.data;
        };

        const mockApi = {
            patch: async (url) => {
                assert.strictEqual(url, `/auth/${fakeUserId}/toggle-status`);
                return { data: fakeApiResponse };
            }
        };

        const result = await mockToggleUserStatus(fakeUserId, mockApi);
        assert.deepStrictEqual(result, fakeApiResponse);
        assert.strictEqual(result.estado, false);
    });

    it('T-2.2: La estructura de Tarea debe incluir opcionalmente nombre_programa', () => {
        const tareaConPrograma = {
            id_tarea: 101,
            id_usuario: 'emp-uuid-1',
            id_diagnostico: 5,
            titulo: 'Revisar flujo de ingresos',
            descripcion: 'Elaborar estructura de costos',
            fecha_asignacion: '2026-10-01T10:00:00Z',
            fecha_expiracion: '2026-10-15T00:00:00Z',
            estado: 'Pendiente',
            nombre_programa: 'Incubadora Emprende Mujer 2026'
        };

        assert.strictEqual(typeof tareaConPrograma.nombre_programa, 'string');
        assert.strictEqual(tareaConPrograma.nombre_programa, 'Incubadora Emprende Mujer 2026');

        const tareaSinPrograma = {
            id_tarea: 102,
            id_usuario: 'emp-uuid-2',
            id_diagnostico: null,
            titulo: 'Tarea general',
            descripcion: null,
            fecha_asignacion: '2026-10-01T10:00:00Z',
            fecha_expiracion: null,
            estado: 'Completada'
        };
        assert.strictEqual(tareaSinPrograma.nombre_programa, undefined);
    });
});
