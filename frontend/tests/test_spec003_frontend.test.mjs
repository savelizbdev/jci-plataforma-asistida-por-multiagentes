import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Spec 003: Requisitos Funcionales Frontend (RF-01 y RF-05)', () => {

    const mentorView = fs.readFileSync(path.resolve('src/pages/GenerarReportes.tsx'), 'utf-8');
    const adminView = fs.readFileSync(path.resolve('src/pages/GenerarReportesAdmin.tsx'), 'utf-8');
    const typesReporte = fs.readFileSync(path.resolve('src/types/reporte.ts'), 'utf-8');
    const serviceReporte = fs.readFileSync(path.resolve('src/services/reporteService.ts'), 'utf-8');

    it('RF-01.1: Selector desplegable en pantallas de Mentor y Administrador', () => {
        assert.ok(mentorView.includes('<select'), 'GenerarReportes.tsx debe renderizar un elemento <select>');
        assert.ok(adminView.includes('<select'), 'GenerarReportesAdmin.tsx debe renderizar un elemento <select>');
    });

    it('RF-01.2: Administrador lista programas y presenta opción por defecto "Todos los programas"', () => {
        assert.ok(adminView.includes('Todos los programas'), 'Admin debe tener la opción "Todos los programas"');
        assert.ok(adminView.includes('programaService.obtenerMisProgramas'), 'Admin debe consultar los programas de la organización');
    });

    it('RF-01.3: Mentor lista sus programas y presenta opción por defecto "Todos los usuarios asignados"', () => {
        assert.ok(mentorView.includes('Todos los usuarios asignados'), 'Mentor debe tener la opción "Todos los usuarios asignados"');
        assert.ok(mentorView.includes('programaService.obtenerMisProgramas'), 'Mentor debe consultar sus programas asignados');
    });

    it('RF-01.4: Carga predeterminada automática en opción consolidada', () => {
        assert.ok(mentorView.includes("useState<string>('')"), 'Mentor debe inicializar selectedPrograma en vacío (consolidado)');
        assert.ok(adminView.includes("useState<string>('')"), 'Admin debe inicializar selectedPrograma en vacío (consolidado)');
    });

    it('RF-01.5: Actualización reactiva al cambiar el selector y propagación a descargas', () => {
        assert.ok(mentorView.includes('onChange='), 'Mentor debe actualizar estado en onChange');
        assert.ok(adminView.includes('handleProgramaChange'), 'Admin debe ejecutar función reactiva al cambiar programa');
        assert.ok(adminView.includes('mentoresFiltrados'), 'Admin debe recalcular mentores reactivamente');
        assert.ok(adminView.includes('emprendedoresFiltrados'), 'Admin debe recalcular emprendedores reactivamente');
        assert.ok(serviceReporte.includes('id_programa'), 'reporteService debe propagar id_programa');
        assert.ok(typesReporte.includes('id_programa?: number | null'), 'Tipos deben permitir id_programa');
    });

});
