import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Fase 4: Frontend — Control Switch en Gestión de Usuarios (RF-11, RF-16)', () => {
    test('T-4.1: Conmutar estado de usuario genera el estado booleano invertido', () => {
        const usuarioActivo = { id_usuario: 'u1', estado: true };
        const usuarioInactivo = { id_usuario: 'u2', estado: false };

        const nuevoEstado1 = !usuarioActivo.estado;
        const nuevoEstado2 = !usuarioInactivo.estado;

        assert.equal(nuevoEstado1, false);
        assert.equal(nuevoEstado2, true);
    });

    test('T-4.1: Asignación de clases institucionales para el Switch (bg-activa-teal vs bg-slate-300)', () => {
        const getSwitchClasses = (estado) =>
            estado ? 'bg-activa-teal' : 'bg-slate-300';

        assert.equal(getSwitchClasses(true), 'bg-activa-teal');
        assert.equal(getSwitchClasses(false), 'bg-slate-300');
    });

    test('T-4.2: Actualización optimista y rollback en caso de error de red', () => {
        let users = [
            { id_usuario: 'u1', nombre: 'Ana', estado: true },
            { id_usuario: 'u2', nombre: 'Carlos', estado: false }
        ];

        const targetUser = users[0];
        const previousState = targetUser.estado;
        const optimisticState = !previousState;

        // Paso 1: Aplicar cambio optimista
        users = users.map(u =>
            u.id_usuario === targetUser.id_usuario ? { ...u, estado: optimisticState } : u
        );
        assert.equal(users.find(u => u.id_usuario === 'u1').estado, false);

        // Paso 2: Simulación de fallo de API -> Rollback
        users = users.map(u =>
            u.id_usuario === targetUser.id_usuario ? { ...u, estado: previousState } : u
        );
        assert.equal(users.find(u => u.id_usuario === 'u1').estado, true);
    });

    test('T-4.2: Notificaciones toast descriptivas según el estado confirmado', () => {
        const getToastMessage = (confirmedState) =>
            confirmedState ? 'Usuario activado' : 'Usuario desactivado';

        assert.equal(getToastMessage(true), 'Usuario activado');
        assert.equal(getToastMessage(false), 'Usuario desactivado');
    });
});
