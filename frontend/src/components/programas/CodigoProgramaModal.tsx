import React, { useState } from 'react';
import { programaService } from '../../services/programaService';
import { UnirseProgramaResponse } from '../../types/programa';
import toast from 'react-hot-toast';

interface CodigoProgramaModalProps {
    isOpen: boolean;
    userId: string;
    isDismissable?: boolean;
    onClose?: () => void;
    onSuccess: (data: UnirseProgramaResponse) => void;
}

export const CodigoProgramaModal: React.FC<CodigoProgramaModalProps> = ({
    isOpen,
    userId,
    isDismissable = false,
    onClose,
    onSuccess,
}) => {
    const [codigo, setCodigo] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanCodigo = codigo.trim().toUpperCase();

        if (cleanCodigo.length !== 8) {
            setError('El código debe tener exactamente 8 caracteres');
            return;
        }

        setError(null);
        setLoading(true);

        try {
            const data = await programaService.unirseAPrograma(userId, cleanCodigo);
            toast.success(`¡Te has unido con éxito a ${data.nombre_programa}!`);
            onSuccess(data);
            setCodigo('');
            if (onClose) onClose();
        } catch (err: any) {
            const msg = err.response?.data?.detail || err.message || 'Error al validar el código';
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white border border-slate-100 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl relative text-neutral-800 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-jci-blue via-activa-teal to-activa-coral"></div>

                {isDismissable && onClose && (
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="absolute top-5 right-5 text-neutral-400 hover:text-neutral-700 transition-colors p-1 rounded-lg"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}

                <div className="flex items-center space-x-3.5 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-primary-50 text-jci-blue flex items-center justify-center border border-primary-100 shadow-2xs">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-extrabold text-neutral-800 tracking-tight">Unirse a un Programa</h3>
                        <p className="text-xs font-semibold text-neutral-400">Ingresa tu código de 8 dígitos</p>
                    </div>
                </div>

                <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
                    Para acceder al contenido, diagnósticos y herramientas personalizadas, ingresa el código del programa otorgado por tu organización.
                </p>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-2">
                            Código de Acceso
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                maxLength={8}
                                value={codigo}
                                onChange={(e) => {
                                    setCodigo(e.target.value.toUpperCase());
                                    if (error) setError(null);
                                }}
                                placeholder="EJ: AWEDC345"
                                disabled={loading}
                                autoFocus
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-center text-2xl font-mono font-bold tracking-widest text-jci-blue placeholder-neutral-300 focus:outline-none focus:ring-2 focus:ring-jci-blue focus:bg-white focus:border-jci-blue transition-all uppercase"
                            />
                            <div className="text-right mt-1.5 text-xs text-neutral-400 font-mono font-medium">
                                {codigo.length}/8
                            </div>
                        </div>
                        {error && (
                            <p className="text-red-500 text-xs mt-2 flex items-center gap-1.5 font-medium">
                                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {error}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || codigo.trim().length !== 8}
                        className="w-full py-3.5 px-4 bg-jci-blue hover:bg-primary-600 text-white font-bold rounded-2xl shadow-sm hover:shadow transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                    >
                        {loading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Verificando código...</span>
                            </>
                        ) : (
                            <span>Confirmar e Ingresar</span>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};
