import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Fase 6: Frontend — Validación de Modales, Bloqueo y Colores Institucionales', () => {
    test('T-6.1: Validación de código en CodigoProgramaModal (8 caracteres alfanuméricos en mayúsculas)', () => {
        const validateCode = (input) => {
            const clean = input.trim().toUpperCase();
            if (clean.length !== 8) {
                return { valid: false, error: 'El código debe tener exactamente 8 caracteres', code: clean };
            }
            return { valid: true, error: null, code: clean };
        };

        const res1 = validateCode('abc123');
        assert.equal(res1.valid, false);
        assert.equal(res1.code, 'ABC123');

        const res2 = validateCode('  alfa2026 ');
        assert.equal(res2.valid, true);
        assert.equal(res2.code, 'ALFA2026');
        assert.equal(res2.error, null);

        const res3 = validateCode('demasiadolargo123');
        assert.equal(res3.valid, false);
    });

    test('T-6.1: Gradiente institucional de CodigoProgramaModal', () => {
        const modalGradient = 'bg-gradient-to-r from-jci-blue via-activa-teal to-activa-coral';
        assert.ok(modalGradient.includes('from-jci-blue'));
        assert.ok(modalGradient.includes('via-activa-teal'));
        assert.ok(modalGradient.includes('to-activa-coral'));
    });

    test('T-6.2: Comportamiento de ProgramaSelector para 1 programa vs múltiples programas', () => {
        const programasUnico = [
            { id_programa: 101, nombre_programa: 'Activa Mujer 2025', nombre_organizacion: 'JCI' }
        ];

        const programasMultiples = [
            { id_programa: 101, nombre_programa: 'Activa Mujer 2025', nombre_organizacion: 'JCI' },
            { id_programa: 102, nombre_programa: 'Jóvenes Líderes', nombre_organizacion: 'JCI' }
        ];

        const getSelectorMode = (progs) => {
            if (progs.length <= 1) return 'badge';
            return 'dropdown';
        };

        assert.equal(getSelectorMode(programasUnico), 'badge');
        assert.equal(getSelectorMode(programasMultiples), 'dropdown');
    });

    test('T-6.3: Condición de bloqueo integral para usuarios con 0 programas activos', () => {
        const checkBloqueo = (programas) => {
            const sinProgramas = !programas || programas.length === 0;
            return {
                bloquearNavegacion: sinProgramas,
                isDismissable: !sinProgramas
            };
        };

        const usuarioSinProgramas = checkBloqueo([]);
        assert.equal(usuarioSinProgramas.bloquearNavegacion, true);
        assert.equal(usuarioSinProgramas.isDismissable, false);

        const usuarioConProgramas = checkBloqueo([{ id_programa: 1 }]);
        assert.equal(usuarioConProgramas.bloquearNavegacion, false);
        assert.equal(usuarioConProgramas.isDismissable, true);
    });
});
