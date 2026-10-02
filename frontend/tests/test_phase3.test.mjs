import { describe, it } from 'node:test';
import assert from 'node:assert';

// Función pura de filtrado reactivo para T-3.1
export function filtrarEmprendedoresPorMentor(emprendedores, mentorActual) {
    if (!mentorActual || !mentorActual.id_usuario) {
        return emprendedores;
    }

    const mentorProgs = mentorActual.programas_ids || [];
    if (mentorProgs.length === 0) {
        return emprendedores;
    }

    return emprendedores.filter((emp) => {
        const empProgs = emp.programas_ids || [];
        return empProgs.some((pid) => mentorProgs.includes(pid));
    });
}

// Función helper para resolver nombres de programas para T-3.2
export function obtenerNombresProgramas(programasIds, programasMap) {
    if (!programasIds || programasIds.length === 0) return [];
    return programasIds.map((pid) => programasMap[pid] || `Programa #${pid}`);
}

describe('Fase 3: Frontend — Asignación de Mentores con Filtrado Reactivo', () => {

    const listaEmprendedores = [
        { id_usuario: 'emp-1', nombre: 'Juan', programas_ids: [10] },
        { id_usuario: 'emp-2', nombre: 'Maria', programas_ids: [20, 30] },
        { id_usuario: 'emp-3', nombre: 'Pedro', programas_ids: [30] },
        { id_usuario: 'emp-4', nombre: 'Lucia', programas_ids: [] },
    ];

    it('T-3.1: Debe filtrar solo los emprendedores que comparten programa con el mentor seleccionado', () => {
        const mentorPrograma10 = {
            id_usuario: 'men-1',
            nombre: 'Mentor Alfa',
            programas_ids: [10]
        };

        const resultado = filtrarEmprendedoresPorMentor(listaEmprendedores, mentorPrograma10);
        assert.strictEqual(resultado.length, 1);
        assert.strictEqual(resultado[0].id_usuario, 'emp-1');
    });

    it('T-3.1: Debe incluir emprendedores si coinciden en cualquiera de los programas del mentor', () => {
        const mentorMultiPrograma = {
            id_usuario: 'men-2',
            nombre: 'Mentor Multi',
            programas_ids: [10, 30]
        };

        const resultado = filtrarEmprendedoresPorMentor(listaEmprendedores, mentorMultiPrograma);
        // Coincide emp-1 (10), emp-2 (30) y emp-3 (30)
        assert.strictEqual(resultado.length, 3);
        const ids = resultado.map(e => e.id_usuario);
        assert.ok(ids.includes('emp-1'));
        assert.ok(ids.includes('emp-2'));
        assert.ok(ids.includes('emp-3'));
        assert.ok(!ids.includes('emp-4'));
    });

    it('T-3.1: Si no hay mentor seleccionado, debe retornar la lista completa sin filtrar', () => {
        const resultado = filtrarEmprendedoresPorMentor(listaEmprendedores, null);
        assert.strictEqual(resultado.length, 4);
    });

    it('T-3.2: Debe mapear correctamente los IDs de programa a sus nombres institucionales para los badges', () => {
        const programasMap = {
            10: 'Incubadora Tecnológica',
            20: 'Emprende Mujer',
            30: 'JCI Capital'
        };

        const nombresEmp2 = obtenerNombresProgramas([20, 30], programasMap);
        assert.deepStrictEqual(nombresEmp2, ['Emprende Mujer', 'JCI Capital']);

        const nombresFallback = obtenerNombresProgramas([99], programasMap);
        assert.deepStrictEqual(nombresFallback, ['Programa #99']);
    });
});
