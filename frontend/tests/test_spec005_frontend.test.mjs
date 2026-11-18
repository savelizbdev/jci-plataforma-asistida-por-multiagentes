import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Spec 005: Ubicación Geográfica Simple (Fases 3, 4, 5 y 6)', () => {

    const municipiosPath = path.resolve('src/data/municipiosLaPaz.json');
    const modalPath = path.resolve('src/components/emprendedor/UbicacionConfirmModal.tsx');
    const cardPath = path.resolve('src/components/emprendedor/UbicacionGeograficaCard.tsx');
    const homeEmprendedorPath = path.resolve('src/pages/HomeEmprendedor.tsx');
    const utilsPath = path.resolve('src/utils/ubicacionUtils.ts');
    const userServicePath = path.resolve('src/services/userService.ts');
    const typesUserPath = path.resolve('src/types/user.ts');
    const tiposMentorPath = path.resolve('src/types/mentor.ts');
    const tiposSuperAdminPath = path.resolve('src/types/superAdmin.ts');
    const resultadosDiagPath = path.resolve('src/pages/ResultadosDiagnostico.tsx');
    const superAdminDiagPath = path.resolve('src/pages/superadmin/SuperAdminDiagnosticos.tsx');
    const generarReportesPath = path.resolve('src/pages/GenerarReportes.tsx');
    const generarReportesAdminPath = path.resolve('src/pages/GenerarReportesAdmin.tsx');
    const superAdminReportesPath = path.resolve('src/pages/superadmin/SuperAdminReportes.tsx');

    // ── FASE 3 ─────────────────────────────────────────────────────────────
    it('T-3.1: Catálogo oficial de 87 municipios de La Paz', () => {
        assert.ok(fs.existsSync(municipiosPath), 'municipiosLaPaz.json debe existir');
        const raw = JSON.parse(fs.readFileSync(municipiosPath, 'utf-8'));
        assert.ok(Array.isArray(raw), 'Debe ser un array');
        assert.equal(raw.length, 87, 'Debe contener exactamente 87 municipios');
        
        // Verificar mayúsculas y orden
        for (let i = 0; i < raw.length; i++) {
            assert.equal(raw[i], raw[i].toUpperCase(), `Municipio ${raw[i]} debe estar en mayúsculas`);
            if (i > 0) {
                assert.ok(
                    raw[i].localeCompare(raw[i - 1], 'es') >= 0,
                    `Debe estar ordenado alfabéticamente: ${raw[i - 1]} vs ${raw[i]}`
                );
            }
        }
    });

    it('T-3.2: Interfaces TypeScript de Usuario actualizadas con campos de ubicación', () => {
        const typesContent = fs.readFileSync(typesUserPath, 'utf-8');
        assert.ok(typesContent.includes('nacionalidad?: string | null;'), 'User debe tener nacionalidad opcional');
        assert.ok(typesContent.includes('municipio?: string | null;'), 'User debe tener municipio opcional');
    });

    it('T-3.3: Funciones puras de lógica exportadas en ubicacionUtils.ts', () => {
        const utilsContent = fs.readFileSync(utilsPath, 'utf-8');
        assert.ok(utilsContent.includes('export function procesarPaisesRestCountries'), 'Debe exportar procesarPaisesRestCountries');
        assert.ok(utilsContent.includes('export function validarFormularioUbicacion'), 'Debe exportar validarFormularioUbicacion');
        assert.ok(utilsContent.includes('export function normalizarMayusculasOficiales'), 'Debe exportar normalizarMayusculasOficiales');
        assert.ok(utilsContent.includes('export function evaluarEstadoUbicacion'), 'Debe exportar evaluarEstadoUbicacion');
    });

    it('T-3.4: Método guardarUbicacion disponible en userService.ts', () => {
        const serviceContent = fs.readFileSync(userServicePath, 'utf-8');
        assert.ok(serviceContent.includes('guardarUbicacion'), 'userService debe tener método guardarUbicacion');
        assert.ok(serviceContent.includes('/auth/'), 'Debe llamar al endpoint de autenticación');
    });

    // ── FASE 4 ─────────────────────────────────────────────────────────────
    it('T-4.1: Componente UbicacionConfirmModal implementado con tipografía destacada y responsive', () => {
        assert.ok(fs.existsSync(modalPath), 'UbicacionConfirmModal.tsx debe existir');
        const modalContent = fs.readFileSync(modalPath, 'utf-8');
        assert.ok(modalContent.includes('Confirmar Ubicación'), 'Debe tener título de confirmación');
        assert.ok(modalContent.includes('text-xl md:text-2xl font-black'), 'Debe tener tipografía destacada');
        assert.ok(modalContent.includes('Registro único e inmutable'), 'Debe advertir sobre la inmutabilidad');
        assert.ok(modalContent.includes('Sí, Confirmar y Guardar'), 'Debe tener botón de confirmación');
    });

    it('T-4.2: Componente UbicacionGeograficaCard implementa estados interactivo y solo lectura', () => {
        assert.ok(fs.existsSync(cardPath), 'UbicacionGeograficaCard.tsx debe existir');
        const cardContent = fs.readFileSync(cardPath, 'utf-8');
        assert.ok(cardContent.includes('Nacional (Bolivia)'), 'Debe tener opción nacional por defecto');
        assert.ok(cardContent.includes('Extranjero'), 'Debe tener opción extranjero');
        assert.ok(cardContent.includes('paises.json'), 'Debe consumir el catálogo de paises.json');
        assert.ok(cardContent.includes('municipiosLaPaz.json'), 'Debe importar los 87 municipios');
        assert.ok(cardContent.includes('Ubicación Registrada'), 'Debe tener estado de solo lectura tras el registro');

        // Validar integridad de paises.json
        const paisesPath = path.resolve('src/data/paises.json');
        assert.ok(fs.existsSync(paisesPath), 'paises.json debe existir');
        const paisesList = JSON.parse(fs.readFileSync(paisesPath, 'utf-8'));
        assert.ok(Array.isArray(paisesList) && paisesList.length > 200, 'Debe contener los países del mundo');
        assert.ok(!paisesList.some(p => p.nombre.toLowerCase() === 'bolivia'), 'No debe contener a Bolivia');
    });

    it('T-4.3: HomeEmprendedor integra UbicacionGeograficaCard de forma no bloqueante', () => {
        const homeContent = fs.readFileSync(homeEmprendedorPath, 'utf-8');
        assert.ok(homeContent.includes('UbicacionGeograficaCard'), 'HomeEmprendedor debe importar e incluir UbicacionGeograficaCard');
        assert.ok(homeContent.includes('onUbicacionActualizada'), 'Debe conectar callback de actualización con setUser');
    });

    // ── FASE 5 ─────────────────────────────────────────────────────────────
    it('T-5.1: Integrar columnas de ubicación y celda combinada PENDIENTE en vista web de supervisión', () => {
        assert.ok(fs.existsSync(superAdminDiagPath), 'SuperAdminDiagnosticos.tsx debe existir');
        const superDiagContent = fs.readFileSync(superAdminDiagPath, 'utf-8');
        assert.ok(superDiagContent.includes('Nac. Emprendedor'), 'Debe tener columna Nacionalidad del Emprendedor clarificada');
        assert.ok(superDiagContent.includes('Mun. Emprendimiento'), 'Debe tener columna Municipio del Emprendimiento clarificada');
        assert.ok(superDiagContent.includes('colSpan={2}'), 'Debe combinar celdas colSpan=2 si no está completado');
        assert.ok(superDiagContent.includes('PENDIENTE'), 'Debe renderizar badge PENDIENTE');

        // Tipos de superadmin deben contener nacionalidad y municipio
        const superTypesContent = fs.readFileSync(tiposSuperAdminPath, 'utf-8');
        assert.ok(superTypesContent.includes('nacionalidad?: string | null;'), 'DiagnosticoSupervisionItem debe incluir nacionalidad');
        assert.ok(superTypesContent.includes('municipio?: string | null;'), 'DiagnosticoSupervisionItem debe incluir municipio');

        // Pantallas de generación de reportes deben describir la inclusión de ubicación territorial
        const genRepContent = fs.readFileSync(generarReportesPath, 'utf-8');
        assert.ok(genRepContent.includes('Ubicación territorial'), 'GenerarReportes debe indicar procedencia territorial');

        const genRepAdminContent = fs.readFileSync(generarReportesAdminPath, 'utf-8');
        assert.ok(genRepAdminContent.includes('Nacionalidad y Municipio'), 'GenerarReportesAdmin debe indicar procedencia territorial');

        const superRepContent = fs.readFileSync(superAdminReportesPath, 'utf-8');
        assert.ok(superRepContent.includes('Nacionalidad y Municipio'), 'SuperAdminReportes debe indicar procedencia territorial');
    });

    it('T-5.2: Detalle de diagnóstico del mentor exhibe ficha territorial con municipio y país o PENDIENTE', () => {
        assert.ok(fs.existsSync(resultadosDiagPath), 'ResultadosDiagnostico.tsx debe existir');
        const diagContent = fs.readFileSync(resultadosDiagPath, 'utf-8');
        assert.ok(diagContent.includes('emp.nacionalidad && emp.municipio'), 'Debe evaluar presencia de ubicación');
        assert.ok(diagContent.includes('Emprendimiento:'), 'Debe etiquetar claramente el Emprendimiento');
        assert.ok(diagContent.includes('Emprendedor:'), 'Debe etiquetar claramente al Emprendedor');
        assert.ok(diagContent.includes('PENDIENTE'), 'Debe mostrar badge PENDIENTE si falta');

        // Tipos de mentor deben incluir ubicación
        const mentorTypes = fs.readFileSync(tiposMentorPath, 'utf-8');
        assert.ok(mentorTypes.includes('nacionalidad?: string | null;'), 'EmprendedorAsignado debe incluir nacionalidad');
        assert.ok(mentorTypes.includes('municipio?: string | null;'), 'EmprendedorAsignado debe incluir municipio');
    });

    // ── FASE 6 ─────────────────────────────────────────────────────────────
    it('T-6.1: Verificación de lógica de funciones puras en ubicacionUtils', async () => {
        const {
            procesarPaisesRestCountries,
            validarFormularioUbicacion,
            normalizarMayusculasOficiales,
            evaluarEstadoUbicacion,
        } = await import('../src/utils/ubicacionUtils.ts');

        // 1. Filtrado de Bolivia y ordenación
        const mocks = [
            { cca2: 'PE', name: { common: 'Peru' }, translations: { spa: { common: 'Perú' } }, flag: '🇵🇪' },
            { cca2: 'BO', name: { common: 'Bolivia' }, translations: { spa: { common: 'Bolivia' } }, flag: '🇧🇴' },
            { cca2: 'AR', name: { common: 'Argentina' }, translations: { spa: { common: 'Argentina' } }, flag: '🇦🇷' },
        ];
        const procesados = procesarPaisesRestCountries(mocks);
        assert.equal(procesados.length, 2);
        assert.equal(procesados[0].nombre, 'Argentina');
        assert.equal(procesados[1].nombre, 'Perú');

        // 2. Validación de formulario
        assert.equal(validarFormularioUbicacion(true, '', 'LA PAZ'), true);
        assert.equal(validarFormularioUbicacion(true, '', ''), false);
        assert.equal(validarFormularioUbicacion(false, '', 'LA PAZ'), false);
        assert.equal(validarFormularioUbicacion(false, 'Perú', 'LA PAZ'), true);

        // 3. Normalización a mayúsculas con tildes
        assert.equal(normalizarMayusculasOficiales('  perú  '), 'PERÚ');
        assert.equal(normalizarMayusculasOficiales('la paz'), 'LA PAZ');

        // 4. Evaluación de estado
        const estadoCompleto = evaluarEstadoUbicacion('BOLIVIA', 'CARANAVI');
        assert.equal(estadoCompleto.esPendiente, false);
        assert.equal(estadoCompleto.nacionalidad, 'BOLIVIA');
        assert.equal(estadoCompleto.municipio, 'CARANAVI');

        const estadoPendiente = evaluarEstadoUbicacion(null, null);
        assert.equal(estadoPendiente.esPendiente, true);
        assert.equal(estadoPendiente.texto, 'PENDIENTE');
    });

});
