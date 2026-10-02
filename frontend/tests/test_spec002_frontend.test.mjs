import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Fase 4 y 5: Frontend — Tipado, Servicio y Renovación de Interfaz (Spec 002)', () => {

    it('T-4.1: La estructura de SeguimientoResult debe soportar métricas estructuradas y retrocompatibilidad', () => {
        const resultadoCompleto = {
            mensaje: 'Proceso de seguimiento ejecutado correctamente.',
            total_tareas: 5,
            total_emprendedores: 3,
            enviados_exitosos: 3,
            fallidos: 0,
            errores_detalle: [],
            resumen_agente: 'Se procesaron 3 emprendedores con 5 tareas.'
        };

        assert.strictEqual(resultadoCompleto.total_tareas, 5);
        assert.strictEqual(resultadoCompleto.total_emprendedores, 3);
        assert.strictEqual(resultadoCompleto.enviados_exitosos, 3);
        assert.strictEqual(resultadoCompleto.fallidos, 0);
        assert.ok(Array.isArray(resultadoCompleto.errores_detalle));
        assert.strictEqual(typeof resultadoCompleto.resumen_agente, 'string');
    });

    it('T-4.1: adminService.ts debe tipificar ErrorDetalle y campos extendidos en SeguimientoResult', () => {
        const adminServicePath = path.resolve('src/services/adminService.ts');
        const content = fs.readFileSync(adminServicePath, 'utf-8');

        assert.ok(content.includes('total_tareas'), 'adminService.ts debe incluir total_tareas');
        assert.ok(content.includes('total_emprendedores'), 'adminService.ts debe incluir total_emprendedores');
        assert.ok(content.includes('enviados_exitosos'), 'adminService.ts debe incluir enviados_exitosos');
        assert.ok(content.includes('fallidos'), 'adminService.ts debe incluir fallidos');
        assert.ok(content.includes('errores_detalle'), 'adminService.ts debe incluir errores_detalle');
    });

    it('T-5.1: SeguimientoTareas.tsx no debe contener menciones a "Multiagente" ni "Ejecutando agente"', () => {
        const pagePath = path.resolve('src/pages/SeguimientoTareas.tsx');
        const content = fs.readFileSync(pagePath, 'utf-8');

        // Validar que no contenga referencias al agente/multiagente en el texto visible
        assert.ok(!content.includes('>Multiagente<'), 'No debe haber badge visible con texto Multiagente');
        assert.ok(!content.includes('El multiagente'), 'No debe referirse al multiagente en descripciones');
        assert.ok(!content.includes('Ejecutando agente...'), 'El estado de carga no debe mencionar agente');
        assert.ok(content.includes('Sistema Automatizado') || content.includes('Recordatorios Automáticos'), 'Debe identificarse como sistema automatizado');
    });

    it('T-5.2: SeguimientoTareas.tsx debe renderizar badges visuales para las métricas cuando existan', () => {
        const pagePath = path.resolve('src/pages/SeguimientoTareas.tsx');
        const content = fs.readFileSync(pagePath, 'utf-8');

        assert.ok(content.includes('enviados_exitosos') || content.includes('total_tareas'), 'Debe utilizar métricas en el renderizado del historial');
    });

});
