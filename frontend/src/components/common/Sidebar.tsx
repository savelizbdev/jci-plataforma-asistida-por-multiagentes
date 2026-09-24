/**
 * Componente Sidebar reutilizable
 * - Desktop: sidebar fijo visible siempre, sticky para no flotar
 * - Mobile: oculto por defecto, se despliega con botón hamburguesa
 */
import { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';

export interface MenuItem {
    label: string;
    path: string;
    icon?: string;
}

interface SidebarProps {
    menuItems: MenuItem[];
    onLogout: () => void;
    isOpen?: boolean;
    onClose?: () => void;
}

export const Sidebar = memo(({ menuItems, onLogout, isOpen, onClose }: SidebarProps) => {
    const location = useLocation();

    const handleNavClick = () => {
        // Close sidebar on mobile when navigating
        if (onClose) onClose();
    };

    // Helper para obtener el icono según la ruta
    const getIconForPath = (path: string, isActive: boolean) => {
        const iconClasses = `w-5 h-5 mr-3 transition-colors duration-300 ${isActive ? 'text-white' : 'text-white/50 group-hover:text-white/90'}`;

        switch (path) {
            case '/admin/home':
            case '/mentor/home':
            case '/emprendedor/home':
                return (
                    <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.5 : 2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                );
            case '/admin/usuarios':
                return (
                    <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.5 : 2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                );
            case '/admin/asignar-mentores':
                return (
                    <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.5 : 2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                );
            case '/admin/reportes':
            case '/mentor/reportes':
                return (
                    <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.5 : 2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                );
            case '/admin/seguimiento':
                return (
                    <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.5 : 2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                );
            case '/mentor/diagnosticos':
            case '/emprendedor/diagnostico-ia':
                return (
                    <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.5 : 2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                );
            default:
                // Default icon
                return (
                    <svg className={iconClasses} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2.5 : 2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                );
        }
    };

    return (
        <>
            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <div
                className={`
                    fixed top-0 left-0 z-50 w-64 border-r border-transparent shadow-xl
                    h-full flex flex-col overflow-y-auto
                    transition-transform duration-300 ease-in-out
                    lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:z-auto
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                `}
                style={{
                    background: 'linear-gradient(160deg, #0b1a30 0%, #112B56 30%, #0f5c7a 70%, #0a7060 100%)'
                }}
            >
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <div className="flex flex-col justify-center items-center w-full h-12">
                        <img src="/logo-jci-light.webp" alt="JCI Empresarios La Paz" className="h-32 sm:h-28 lg:h-32 w-auto object-contain drop-shadow-lg" />
                    </div>
                    {/* Close button (mobile only) */}
                    <button
                        onClick={onClose}
                        className="lg:hidden text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                        aria-label="Cerrar menú"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Menu Items */}
                <nav className="flex-1 py-4">
                    <ul className="space-y-1">
                        {menuItems.map((item) => {
                            const isActive = location.pathname === item.path;
                            
                            return (
                                <li key={item.path}>
                                    <Link
                                        to={item.path}
                                        onClick={handleNavClick}
                                        className={`group flex items-center px-6 py-3.5 text-[14.5px] font-medium transition-all duration-300 border-l-4 ${isActive
                                            ? 'bg-white/10 border-white text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
                                            : 'border-transparent text-white/50 hover:bg-white/5 hover:text-white/90'
                                            }`}
                                    >
                                        {/* Dynamic Icon */}
                                        {item.icon ? (
                                            <span dangerouslySetInnerHTML={{ __html: item.icon }} className="mr-3" />
                                        ) : (
                                            getIconForPath(item.path, isActive)
                                        )}
                                        <span className="truncate">{item.label}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* Logout Button */}
                <div className="p-4 border-t border-white/10 bg-black/10">
                    <button
                        onClick={onLogout}
                        className="w-full px-4 py-3 text-white/70 hover:bg-red-500/15 hover:text-red-300 hover:border-red-500/30 rounded-xl transition-all duration-300 text-sm font-semibold flex items-center justify-center gap-2 border border-transparent"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Cerrar Sesión
                    </button>
                </div>
            </div>
        </>
    );
}, (prevProps, nextProps) => {
    return prevProps.onLogout === nextProps.onLogout
        && prevProps.isOpen === nextProps.isOpen;
});

Sidebar.displayName = 'Sidebar';
