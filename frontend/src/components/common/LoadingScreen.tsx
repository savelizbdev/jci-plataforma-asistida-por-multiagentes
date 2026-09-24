import React from 'react';

interface LoadingScreenProps {
    /** Mensaje principal que describe la acción en curso */
    message?: string;
    /** Submensaje o lema descriptivo */
    submessage?: string;
    /** Si es true, cubre toda la pantalla (fixed). Si es false, se adapta al contenedor */
    fullScreen?: boolean;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
    message = 'Cargando plataforma...',
    submessage = 'Incubadora JCI Empresarios La Paz · Programa Activa Mujer',
    fullScreen = true,
}) => {
    return (
        <div
            className={`relative flex flex-col items-center justify-center overflow-hidden ${
                fullScreen
                    ? 'fixed inset-0 z-50 min-h-screen w-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-sky-50'
                    : 'w-full py-16 px-4 bg-transparent'
            }`}
        >
            {/* Esferas de luz ambiental con efecto blur */}
            {fullScreen && (
                <>
                    <div className="pointer-events-none absolute -top-28 -left-28 h-96 w-96 rounded-full bg-activa-teal/15 blur-3xl animate-pulse" />
                    <div
                        className="pointer-events-none absolute -bottom-28 -right-28 h-96 w-96 rounded-full bg-primary-500/15 blur-3xl animate-pulse"
                        style={{ animationDelay: '1.2s' }}
                    />
                    <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-activa-coral/10 blur-3xl" />
                </>
            )}

            {/* Tarjeta central de carga */}
            <div className="relative z-10 flex flex-col items-center max-w-sm sm:max-w-md w-full px-6 py-8 mx-4 rounded-3xl bg-white/85 backdrop-blur-md shadow-xl shadow-slate-200/60 border border-white/70 text-center transition-all duration-300">
                {/* Emblema con halo suave */}
                <div className="relative mb-5 flex items-center justify-center">
                    <div className="absolute -inset-2.5 rounded-2xl bg-gradient-to-tr from-activa-teal/30 via-primary-400/25 to-activa-coral/30 blur-md animate-pulse" />
                    <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-white shadow-sm border border-slate-100 p-2.5">
                        <img
                            src="/logo-activa-mujer-dibujo.webp"
                            alt="Emblema Activa Mujer"
                            className="w-full h-full object-contain filter drop-shadow-sm select-none"
                        />
                    </div>
                </div>

                {/* Logos institucionales Activa Mujer + JCI */}
                <div className="flex items-center justify-center gap-3 sm:gap-4 mb-6">
                    <img
                        src="/logo-activa-mujer.webp"
                        alt="Programa Activa Mujer"
                        className="h-9 sm:h-11 w-auto object-contain select-none"
                    />
                    <div className="h-6 w-[1.5px] bg-slate-200 rounded-full" />
                    <img
                        src="/logo-jci.webp"
                        alt="JCI Empresarios La Paz"
                        className="h-10 sm:h-12 w-auto object-contain select-none"
                    />
                </div>

                {/* Barra de progreso con gradiente continuo */}
                <div className="w-52 sm:w-60 h-2 bg-slate-100 rounded-full overflow-hidden relative shadow-inner mb-4 border border-slate-200/70">
                    <div className="absolute top-0 bottom-0 w-1/2 rounded-full bg-gradient-to-r from-activa-teal via-primary-500 to-activa-coral animate-shimmer-loader" />
                </div>

                {/* Textos descriptivos */}
                <h3 className="text-base font-semibold text-slate-800 tracking-wide mb-1">
                    {message}
                </h3>
                {submessage && (
                    <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                        {submessage}
                    </p>
                )}
            </div>

            {/* Footer institucional sólo en pantalla completa */}
            {fullScreen && (
                <div className="absolute bottom-5 text-center text-xs text-slate-400 font-medium">
                    JCI Empresarios La Paz &copy; {new Date().getFullYear()} · Todos los derechos reservados
                </div>
            )}
        </div>
    );
};
