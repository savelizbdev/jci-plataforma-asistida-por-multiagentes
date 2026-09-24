/**
 * Página de Login - Full screen split
 * Panel izquierdo colorido con borde redondeado derecho
 * Panel derecho blanco plano — sin estilo tarjeta
 */
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export const Login = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useAuth();

    const handleGoogleLogin = async () => {
        try {
            setLoading(true);
            setError('');
            await login();
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesión');
            setLoading(false);
        }
    };

    return (
        /* Full screen — sin márgenes, sin tarjetas */
        <div className="h-screen w-screen flex flex-col lg:flex-row bg-white overflow-y-auto lg:overflow-hidden">

            {/* ======================================= */}
            {/* PANEL IZQUIERDO — Branding (58%)        */}
            {/* rounded-r-[3rem] crea la curva del ejemplo */}
            {/* ======================================= */}
            <div className="relative flex flex-col overflow-hidden
                            h-[50vh] w-full flex-shrink-0
                            lg:h-full lg:w-[58%]
                            rounded-b-[3rem] lg:rounded-b-none lg:rounded-r-[3rem]
                            z-10"
                style={{
                    background: 'linear-gradient(140deg, #112B56 0%, #174270 35%, #0f5c7a 65%, #0a7060 100%)'
                }}
            >
                {/* Wave shapes */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 700 900"
                    preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="580" cy="100" rx="340" ry="300" fill="rgba(14,122,106,0.30)" />
                    <ellipse cx="-80" cy="720" rx="380" ry="300" fill="rgba(240,122,92,0.22)" />
                    <ellipse cx="680" cy="800" rx="280" ry="250" fill="rgba(232,168,46,0.17)" />
                    <circle cx="80" cy="100" r="80" fill="rgba(255,255,255,0.04)" />
                </svg>

                {/* TOP: JCI Logo */}
                <div className="relative flex gap-3 items-center lg:px-8 px-4">
                    <img
                        src="/logo-jci-light.webp"
                        alt="JCI Empresarios La Paz"
                        className="h-16 sm:h-24 lg:h-32 w-auto object-contain"
                    />
                    <p className="mt-1.5 sm:mt-3 text-white/65 text-xs sm:text-sm font-medium max-w-sm leading-snug border-l-2 border-white/25 pl-3">
                        Organización de jóvenes profesionales, emprendedores y líderes
                    </p>
                </div>

                {/* CENTER: Activa Mujer */}
                <div className="relative flex flex-col
                            px-4 sm:px-8 sm:py-4 lg:px-12">
                    <img
                        src="/logo-activa-mujer.webp"
                        alt="Activa Mujer"
                        // Aumentamos el tamaño base (móvil) a h-20 o h-24 para mayor presencia
                        className="h-20 sm:h-28 lg:h-40 w-auto object-contain select-none
                                mb-4 sm:mb-6 lg:mb-4 self-start"
                        style={{ filter: 'drop-shadow(0 4px 22px rgba(0,0,0,0.75)) brightness(1.25) contrast(1.05)' }}
                    />
                    <h1 className="text-white font-extrabold
                                text-3xl sm:text-5xl lg:text-5xl xl:text-5xl
                                leading-[1.15] tracking-tight max-w-lg">
                        Programa de
                        <span className="block mt-1 sm:mt-2"
                            style={{ background: 'linear-gradient(90deg,#F07A5C,#E8A82E,#5bc0b0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                            empoderamiento
                        </span>
                        financiero y tecnológico
                    </h1>
                    <p className="mt-4 sm:mt-5 text-white/80 text-sm sm:text-base lg:text-lg max-w-md leading-relaxed font-medium">
                        Para mujeres visionarias. Convertimos ideas en negocios rentables con resultados tangibles a corto plazo.
                    </p>
                </div>

                {/* BOTTOM */}
                <div className="relative px-4 sm:px-8 sm:py-4 lg:px-12 p-4 lg:pb-7 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="h-0.5 w-5 rounded-full bg-[#F07A5C]"></div>
                        <div className="h-0.5 w-12 rounded-full bg-[#E8A82E]"></div>
                        <div className="h-0.5 w-4 rounded-full bg-[#5bc0b0]"></div>
                    </div>
                    <p className="mt-1.5 text-white/40 text-[16px]">
                        Organizado por JCI Empresarios La Paz · Activa Mujer
                    </p>
                </div>
            </div>

            {/* ======================================= */}
            {/* PANEL DERECHO — Login, blanco puro      */}
            {/* Sin tarjeta, el fondo mismo es el panel */}
            {/* ======================================= */}
            <div className="flex-1 bg-white flex items-center justify-center
                            px-6 sm:px-10 lg:px-16
                            py-8 sm:py-0">
                <div className="w-full max-w-xs">

                    {/* Title */}
                    <div className="mb-10 flex flex-col gap-3 text-center">
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-800 tracking-tight">
                            <span className="block mt-1 sm:mt-2"
                                style={{ background: 'linear-gradient(90deg,#F07A5C,#E8A82E,#5bc0b0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                                ¡Qué alegría tenerte aquí!
                            </span>
                        </h2>
                        <p className="text-neutral-500 text-sm font-medium tracking-wide">
                            Inicia sesión para continuar
                        </p>
                    </div>

                    {/* Divider line */}
                    <div className="flex items-center gap-4 mb-8">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-slate-200"></div>
                        <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Seguro</span>
                        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-slate-200 to-slate-200"></div>
                    </div>

                    {/* Buttons */}
                    <div className="space-y-4">
                        {/* Google — pill style like reference */}
                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="relative w-full flex items-center justify-center gap-3
                                       text-neutral-700 font-semibold text-sm tracking-wide
                                       px-5 py-3.5 rounded-full
                                       bg-white hover:bg-slate-50 hover:text-neutral-900
                                       border border-slate-200 hover:border-slate-300
                                       transition-all duration-300 ease-out shadow-sm hover:shadow-md
                                       disabled:opacity-50 disabled:cursor-not-allowed
                                       focus:outline-none focus:ring-2 focus:ring-slate-200 focus:ring-offset-2
                                       group overflow-hidden"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-neutral-400 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Iniciando sesión...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    Continuar con Google
                                </>
                            )}
                        </button>
                    </div>

                    {error && (
                        <div className="mt-6 p-3 bg-red-50/50 border border-red-100 rounded-2xl flex items-start gap-3">
                            <div className="bg-red-100 p-1 rounded-full flex-shrink-0 mt-0.5">
                                <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <p className="text-red-700 text-xs font-medium leading-relaxed pt-0.5">{error}</p>
                        </div>
                    )}

                    <div className="mt-10 flex flex-col items-center gap-1">
                        <p className="text-center text-xs text-neutral-400 font-medium">
                            ¿Primera vez? No te preocupes, te guiaremos.
                        </p>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100/60">
                        <p className="text-center text-[10px] text-neutral-400/80 leading-relaxed max-w-[260px] mx-auto">
                            Al ingresar, aceptas los términos de servicio y política de privacidad de JCI Empresarios La Paz.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
