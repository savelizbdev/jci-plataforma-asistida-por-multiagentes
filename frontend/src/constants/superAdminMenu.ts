/**
 * Menú de navegación compartido para todas las páginas del Super Administrador (Spec 004).
 */
import type { MenuItem } from '../components/common/Sidebar';

export const SUPERADMIN_MENU_ITEMS: MenuItem[] = [
    { label: 'Organizaciones y Programas', path: '/superadmin/home' },
    { label: 'Gestión de Usuarios',        path: '/superadmin/usuarios' },
    { label: 'Asignar Mentores',           path: '/superadmin/asignar-mentores' },
    { label: 'Generar Reportes',           path: '/superadmin/reportes' },
    { label: 'Resultados de Diagnósticos', path: '/superadmin/diagnosticos' },
];
