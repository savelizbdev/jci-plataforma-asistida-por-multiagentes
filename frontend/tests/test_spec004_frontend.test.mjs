import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Spec 004: Frontend — Pantallas Dedicadas y Navegación Super Administrador', () => {

    const usuariosView = fs.readFileSync(path.resolve('src/pages/superadmin/SuperAdminUsuarios.tsx'), 'utf-8');
    const asignarView = fs.readFileSync(path.resolve('src/pages/superadmin/SuperAdminAsignarMentores.tsx'), 'utf-8');
    const reportesView = fs.readFileSync(path.resolve('src/pages/superadmin/SuperAdminReportes.tsx'), 'utf-8');
    const diagnosticosView = fs.readFileSync(path.resolve('src/pages/superadmin/SuperAdminDiagnosticos.tsx'), 'utf-8');
    const superAdminHomeView = fs.readFileSync(path.resolve('src/pages/SuperAdminHome.tsx'), 'utf-8');
    const appRoutes = fs.readFileSync(path.resolve('src/App.tsx'), 'utf-8');
    const filterContext = fs.readFileSync(path.resolve('src/context/SuperAdminFilterContext.tsx'), 'utf-8');
    const filterBar = fs.readFileSync(path.resolve('src/components/superadmin/SuperAdminFilterBar.tsx'), 'utf-8');
    const menuItems = fs.readFileSync(path.resolve('src/constants/superAdminMenu.ts'), 'utf-8');

    it('RF-01: Estructura del Menú Lateral (Sidebar) con 5 opciones y sin Seguimiento de Tareas', () => {
        // RF-01.1: 5 opciones ordenadas
        assert.ok(menuItems.includes("label: 'Organizaciones y Programas'"), 'Debe incluir Organizaciones y Programas');
        assert.ok(menuItems.includes("path: '/superadmin/home'"), 'Debe apuntar a /superadmin/home');
        assert.ok(menuItems.includes("label: 'Gestión de Usuarios'"), 'Debe incluir Gestión de Usuarios');
        assert.ok(menuItems.includes("path: '/superadmin/usuarios'"), 'Debe apuntar a /superadmin/usuarios');
        assert.ok(menuItems.includes("label: 'Asignar Mentores'"), 'Debe incluir Asignar Mentores');
        assert.ok(menuItems.includes("path: '/superadmin/asignar-mentores'"), 'Debe apuntar a /superadmin/asignar-mentores');
        assert.ok(menuItems.includes("label: 'Generar Reportes'"), 'Debe incluir Generar Reportes');
        assert.ok(menuItems.includes("path: '/superadmin/reportes'"), 'Debe apuntar a /superadmin/reportes');
        assert.ok(menuItems.includes("label: 'Resultados de Diagnósticos'"), 'Debe incluir Resultados de Diagnósticos');
        assert.ok(menuItems.includes("path: '/superadmin/diagnosticos'"), 'Debe apuntar a /superadmin/diagnosticos');

        // RF-01.2: Omite Seguimiento de Tareas
        assert.ok(!menuItems.includes('Seguimiento de Tareas'), 'No debe contener Seguimiento de Tareas');

        // RF-01.3: SuperAdminHome es catálogo maestro y no incluye SuperAdminFilterBar
        assert.ok(!superAdminHomeView.includes('SuperAdminFilterBar'), 'SuperAdminHome no debe incluir barra de filtros');
    });

    it('RF-02: Selectores Desplegables de Filtrado Jerárquico (SuperAdminFilterBar)', () => {
        // RF-02.1: Dos selectores vinculados
        assert.ok(filterBar.includes('superadmin-org-select'), 'Debe incluir selector de organización');
        assert.ok(filterBar.includes('superadmin-prog-select'), 'Debe incluir selector de programa');

        // RF-02.2: Deshabilitado sin organización y mensaje explicativo neutro
        assert.ok(filterBar.includes('Seleccione una organización primero'), 'Programa deshabilitado sin organización');
        assert.ok(filterBar.includes('Seleccione una organización para comenzar a visualizar los datos'), 'Mensaje neutro presente');

        // RF-02.5: Opción "Todos los programas"
        assert.ok(filterBar.includes('Todos los programas'), 'Debe incluir opción Todos los programas');

        // RF-02.6: Opción "Sin programas activos"
        assert.ok(filterBar.includes('Sin programas activos'), 'Debe incluir opción Sin programas activos');

        // RNF-03: Responsive (flex-col md:flex-row y h-11 para 44px de toque táctil)
        assert.ok(filterBar.includes('flex flex-col md:flex-row'), 'Debe ser responsive en fila y columna');
        assert.ok(filterBar.includes('h-11'), 'Debe tener controles de 44px de altura táctil');
    });

    it('RF-03: Persistencia de Filtros y Manejo de Enlace Directo (Deep Linking)', () => {
        // RF-03.1 y RF-03.4: En memoria de React sin localStorage
        assert.ok(!filterContext.includes('localStorage'), 'No debe persistir en localStorage');
        assert.ok(filterContext.includes('SuperAdminFilterContext'), 'Debe proveer el contexto en memoria');
        assert.ok(filterContext.includes('setSelectedOrgId'), 'Debe permitir actualizar organización');
        assert.ok(filterContext.includes('setSelectedProgId'), 'Debe permitir actualizar programa');
    });

    it('RF-04: Módulo Dedicado de Gestión de Usuarios (SuperAdminUsuarios)', () => {
        // RF-04.1 y RF-04.2: 4 roles permitidos y switch de activación
        assert.ok(usuariosView.includes('SuperAdminFilterBar'), 'Debe incorporar SuperAdminFilterBar');
        assert.ok(usuariosView.includes('matriculados'), 'Pestaña de usuarios matriculados');
        assert.ok(usuariosView.includes('sin_programa'), 'Pestaña de usuarios sin programa asignado');
        assert.ok(usuariosView.includes('superAdminService.cambiarRol'), 'Permite cambiar rol');
        assert.ok(usuariosView.includes('superAdminService.cambiarEstadoUsuario'), 'Permite alternar estado activo/inactivo');
        assert.ok(usuariosView.includes('superAdminService.matricularUsuario'), 'Permite matricular usuario');

        // RF-04.2: Soporte estricto de roles 1 a 4
        assert.ok(usuariosView.includes('value={1}'), 'Soporta Rol 1');
        assert.ok(usuariosView.includes('value={2}'), 'Soporta Rol 2');
        assert.ok(usuariosView.includes('value={3}'), 'Soporta Rol 3');
        assert.ok(usuariosView.includes('value={4}'), 'Soporta Rol 4');

        // RF-04.7: Paginación de 15
        assert.ok(usuariosView.includes('PaginationControls'), 'Incorpora controles de paginación');
    });

    it('RF-05: Módulo Dedicado de Asignación de Mentores (SuperAdminAsignarMentores)', () => {
        // RF-05.1: Auto-selección del primer programa activo
        assert.ok(asignarView.includes('SuperAdminFilterBar'), 'Debe incorporar SuperAdminFilterBar');
        assert.ok(asignarView.includes('setSelectedProgId(programas[0].id_programa)'), 'Auto-selecciona el primer programa');

        // RF-05.2: Asignación y desasignación
        assert.ok(asignarView.includes('superAdminService.asignarMentor'), 'Permite asignar mentor');
        assert.ok(asignarView.includes('superAdminService.desasignarMentor'), 'Permite desasignar mentor');

        // RF-05.3: Banner orientador cuando se selecciona "Todos los programas"
        assert.ok(asignarView.includes("selectedProgId === 'todos'"), 'Detecta selección "Todos los programas"');
        assert.ok(asignarView.includes('Para realizar o modificar asignaciones, debe seleccionar un programa específico'), 'Muestra banner informativo');

        // RF-05.4: Paginación independiente de 15
        assert.ok(asignarView.includes('pageMentores'), 'Paginación independiente para mentores');
        assert.ok(asignarView.includes('pageSinMentor'), 'Paginación independiente para emprendedores sin mentor');
        assert.ok(asignarView.includes('pageConMentor'), 'Paginación independiente para asignados');
    });

    it('RF-06: Módulo Dedicado de Generación de Reportes (SuperAdminReportes)', () => {
        // RF-06.1 y RF-06.2: Consolidado y por programa
        assert.ok(reportesView.includes('SuperAdminFilterBar'), 'Debe incorporar SuperAdminFilterBar');
        assert.ok(reportesView.includes('generarReporteAdmin'), 'Genera reporte consolidado y por programa');
        assert.ok(reportesView.includes('generarReporteTodosMentores'), 'Genera reporte comparativo de mentores');
        assert.ok(reportesView.includes('generarReporteEmprendedor'), 'Genera reporte individual');
    });

    it('RF-07: Módulo Dedicado de Resultados de Diagnósticos (SuperAdminDiagnosticos)', () => {
        // RF-07.1: Modo de solo lectura
        assert.ok(diagnosticosView.includes('SuperAdminFilterBar'), 'Debe incorporar SuperAdminFilterBar');
        assert.ok(diagnosticosView.includes('Modo Solo Lectura (Supervisión)'), 'Badge de solo lectura presente');

        // RF-07.2: Rubricas IMESUN completas
        assert.ok(diagnosticosView.includes('promedio_cf'), 'Despliega rúbrica CF');
        assert.ok(diagnosticosView.includes('promedio_gp'), 'Despliega rúbrica GP');
        assert.ok(diagnosticosView.includes('promedio_m'), 'Despliega rúbrica M');
        assert.ok(diagnosticosView.includes('promedio_v'), 'Despliega rúbrica V');
        assert.ok(diagnosticosView.includes('promedio_tp'), 'Despliega rúbrica TP');
        assert.ok(diagnosticosView.includes('promedio_rh'), 'Despliega rúbrica RH');
        assert.ok(diagnosticosView.includes('promedio_ec'), 'Despliega rúbrica EC');

        // RF-07.3: Etiqueta "Sin diagnóstico"
        assert.ok(diagnosticosView.includes('Sin diagnóstico'), 'Muestra etiqueta Sin diagnóstico');

        // RF-07.4: Bloqueo de controles de calificación / veredicto (Principio 2)
        assert.ok(!diagnosticosView.includes('guardarCalificacion'), 'No debe tener métodos de calificación');
        assert.ok(!diagnosticosView.includes('emitirVeredicto'), 'No debe tener métodos de veredicto');

        // RF-07.6: Paginación de 15
        assert.ok(diagnosticosView.includes('PaginationControls'), 'Incorpora paginación de 15');

        // RF-07.7: Descarga de reporte individual
        assert.ok(diagnosticosView.includes('handleDescargarReporteIndividual'), 'Permite descargar reporte individual');
    });

    it('RF-08: Aislamiento Arquitectónico de Pantallas y Endpoints', () => {
        // RF-08.1: 4 nuevas rutas dedicadas envueltas en SuperAdminFilterProvider
        assert.ok(appRoutes.includes('/superadmin/usuarios'), 'Ruta /superadmin/usuarios registrada');
        assert.ok(appRoutes.includes('/superadmin/asignar-mentores'), 'Ruta /superadmin/asignar-mentores registrada');
        assert.ok(appRoutes.includes('/superadmin/reportes'), 'Ruta /superadmin/reportes registrada');
        assert.ok(appRoutes.includes('/superadmin/diagnosticos'), 'Ruta /superadmin/diagnosticos registrada');
        assert.ok(appRoutes.includes('<SuperAdminFilterProvider>'), 'Envuelto en SuperAdminFilterProvider');
    });

});
