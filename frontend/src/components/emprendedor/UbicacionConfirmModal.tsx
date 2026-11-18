import React from 'react';

interface UbicacionConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    nacionalidad: string;
    municipio: string;
    bandera?: string;
    loading?: boolean;
}

export const UbicacionConfirmModal: React.FC<UbicacionConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    nacionalidad,
    municipio,
    bandera,
    loading = false,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm animate-fade-in">
            <div
                className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all"
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
            >
                {/* Cabecera */}
                <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                        <div className="w-10 h-10 rounded-xl bg-primary-50 text-jci-blue flex items-center justify-center text-xl shadow-sm">
                            📍
                        </div>
                        <div>
                            <h3 id="modal-title" className="text-lg font-bold text-neutral-800">
                                Confirmar Ubicación
                            </h3>
                            <p className="text-xs text-neutral-500">
                                Verifica los datos antes de registrar
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="text-neutral-400 hover:text-neutral-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
                        aria-label="Cerrar modal"
                    >
                        ✕
                    </button>
                </div>

                {/* Contenido / Resumen con tipografía destacada */}
                <div className="p-6 space-y-4">
                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4.5 space-y-3.5">
                        <div>
                            <span className="text-xs uppercase tracking-wider font-semibold text-neutral-500 block mb-1">
                                👤 Nacionalidad del Emprendedor
                            </span>
                            <div className="flex items-center space-x-2 text-xl md:text-2xl font-black text-neutral-900">
                                {bandera && <span className="text-2xl">{bandera}</span>}
                                <span>{nacionalidad}</span>
                            </div>
                        </div>

                        <div className="border-t border-slate-200/60 pt-3">
                            <span className="text-xs uppercase tracking-wider font-semibold text-neutral-500 block mb-1">
                                📍 Ubicación del Emprendimiento (Municipio)
                            </span>
                            <div className="flex items-center space-x-2 text-xl md:text-2xl font-black text-jci-blue">
                                <span>{municipio}</span>
                                <span className="text-sm font-semibold text-neutral-500">(Dpto. de La Paz)</span>
                            </div>
                        </div>
                    </div>

                    {/* Advertencia de inmutabilidad */}
                    <div className="flex items-start space-x-2 p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-xs text-amber-800">
                        <span className="text-base leading-none">⚠️</span>
                        <p className="leading-relaxed">
                            <span className="font-bold">Registro único e inmutable:</span> Esta información no podrá ser modificada una vez confirmada.
                        </p>
                    </div>
                </div>

                {/* Acciones */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-neutral-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                    >
                        Revisar datos
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-jci-blue hover:bg-primary-600 text-white text-sm font-bold shadow-md shadow-primary-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <span className="animate-spin text-sm">⏳</span>
                                <span>Guardando...</span>
                            </>
                        ) : (
                            <span>Sí, Confirmar y Guardar</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

