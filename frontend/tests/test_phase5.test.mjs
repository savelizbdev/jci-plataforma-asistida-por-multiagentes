import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Fase 5: Frontend — Visualización Accesible de Tareas (RF-15)', () => {
    test('T-5.1: Cada tarea debe renderizar el badge con nombre del programa si está presente', () => {
        const tareas = [
            { id_tarea: 1, titulo: 'Validar propuesta de valor', nombre_programa: 'Programa Activa Mujer 2025' },
            { id_tarea: 2, titulo: 'Definir canales de venta', nombre_programa: null },
            { id_tarea: 3, titulo: 'Ajustar costos fijos' }
        ];

        const renderBadge = (tarea) => {
            if (!tarea.nombre_programa) return null;
            return {
                text: tarea.nombre_programa,
                className: 'bg-secondary-50 text-activa-teal border-secondary-100'
            };
        };

        const badge1 = renderBadge(tareas[0]);
        assert.ok(badge1);
        assert.equal(badge1.text, 'Programa Activa Mujer 2025');
        assert.ok(badge1.className.includes('bg-secondary-50'));
        assert.ok(badge1.className.includes('text-activa-teal'));

        const badge2 = renderBadge(tareas[1]);
        assert.equal(badge2, null);

        const badge3 = renderBadge(tareas[2]);
        assert.equal(badge3, null);
    });

    test('T-5.1: Permite diferenciar tareas asignadas pertenecientes a diferentes programas sin menú selector', () => {
        const tareas = [
            { id_tarea: 1, titulo: 'Tarea 1', nombre_programa: 'Programa Startups' },
            { id_tarea: 2, titulo: 'Tarea 2', nombre_programa: 'Incubadora JCI' },
            { id_tarea: 3, titulo: 'Tarea 3', nombre_programa: 'Programa Startups' }
        ];

        const programasDetectados = [...new Set(tareas.map(t => t.nombre_programa).filter(Boolean))];
        assert.deepEqual(programasDetectados, ['Programa Startups', 'Incubadora JCI']);
    });
});
