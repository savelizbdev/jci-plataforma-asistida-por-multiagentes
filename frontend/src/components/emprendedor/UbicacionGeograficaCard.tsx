import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { User } from '../../types/user';
import { userService } from '../../services/userService';
import municipiosRaw from '../../data/municipiosLaPaz.json';
import paisesRaw from '../../data/paises.json';
import {
    validarFormularioUbicacion,
    normalizarMayusculasOficiales,
    PaisItem,
} from '../../utils/ubicacionUtils';
import { UbicacionConfirmModal } from './UbicacionConfirmModal';

interface UbicacionGeograficaCardProps {
    user: User;
    onUbicacionActualizada?: (usuarioActualizado: User) => void;
}

export const UbicacionGeograficaCard: React.FC<UbicacionGeograficaCardProps> = ({
    user,
    onUbicacionActualizada,
}) => {
    // ─── Estado interno ─────────────────────────────────────────────────────────
    const yaRegistrado = Boolean(user.nacionalidad && user.municipio);

    const [esNacional, setEsNacional] = useState(true);
    const paises: PaisItem[] = paisesRaw as PaisItem[];
    const [paisSeleccionado, setPaisSeleccionado] = useState('');
    const [municipioSeleccionado, setMunicipioSeleccionado] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [saving, setSaving] = useState(false);

    // ─── Reset de país al volver a Nacional ─────────────────────────────────────
    const handleSwitchTipo = (nacional: boolean) => {
        setEsNacional(nacional);
        if (nacional) {
            setPaisSeleccionado('');
        }
    };

    // ─── Obtener bandera visual ────────────────────────────────────────────────
    const obtenerBanderaActual = (): string => {
        if (esNacional) return '🇧🇴';
        const p = paises.find((item) => item.nombre === paisSeleccionado);
        return p?.bandera || '🌍';
    };

    // ─── Nombre normalizado de la nacionalidad para persistencia ────────────────
    const getNacionalidadFinal = (): string => {
        return esNacional ? 'BOLIVIA' : normalizarMayusculasOficiales(paisSeleccionado);
    };

    // ─── Confirmación y guardado ────────────────────────────────────────────────
    const handleConfirmarGuardado = async () => {
        const nacionalidad = getNacionalidadFinal();
        const municipio = normalizarMayusculasOficiales(municipioSeleccionado);

        setSaving(true);
        try {
            const updated = await userService.guardarUbicacion(user.id_usuario, {
                nacionalidad,
                municipio,
            });
            toast.success('Ubicación registrada con éxito');
            setShowConfirmModal(false);
            if (onUbicacionActualizada) {
                onUbicacionActualizada(updated);
            }
        } catch (error: any) {
            toast.error(error.message || 'Error al registrar ubicación');
        } finally {
            setSaving(false);
        }
    };

    // ─── ESTADO B: Ya registrado (Solo Lectura) ─────────────────────────────────
    if (yaRegistrado) {
        const esBolivia = user.nacionalidad === 'BOLIVIA';
        const bandera = esBolivia ? '🇧🇴' : '🌍';

        return (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                    <div className="flex items-center space-x-2">
                        <span className="text-xl">📍</span>
                        <h3 className="text-sm font-bold text-neutral-800 uppercase tracking-wide">
                            Ubicación de tu Emprendimiento
                        </h3>
                    </div>
                    <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-activa-dark-teal border border-teal-200 w-fit">
                        <span>✓</span>
                        <span>Ubicación Registrada</span>
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                    <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5">
                        <span className="text-xs uppercase font-semibold text-neutral-500 block mb-1">
                            👤 Nacionalidad del Emprendedor
                        </span>
                        <div className="flex items-center space-x-2 text-base font-bold text-neutral-800">
                            <span>{bandera}</span>
                            <span>{user.nacionalidad}</span>
                        </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5">
                        <span className="text-xs uppercase font-semibold text-neutral-500 block mb-1">
                            📍 Ubicación del Emprendimiento
                        </span>
                        <div className="flex items-center space-x-1.5 text-base font-bold text-jci-blue">
                            <span>{user.municipio}</span>
                            <span className="text-xs font-semibold text-neutral-500">(Dpto. de La Paz)</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── ESTADO A: Pendiente de Registro (Interactivo) ───────────────────────────
    const formularioValido = validarFormularioUbicacion(
        esNacional,
        paisSeleccionado,
        municipioSeleccionado
    );

    return (
        <>
            <div className="bg-white border-2 border-jci-blue/30 rounded-2xl p-5 md:p-6 shadow-sm relative overflow-hidden">
                {/* Acento superior de color institucional */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-jci-blue via-activa-teal to-jci-blue" />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                    <div className="flex items-center space-x-2.5">
                        <div className="w-9 h-9 rounded-xl bg-primary-50 text-jci-blue flex items-center justify-center text-lg font-bold">
                            📍
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-neutral-800">
                                Ubicación de tu Emprendimiento
                            </h3>
                            <p className="text-xs text-neutral-500">
                                Por favor indica el origen y municipio de tu actividad económica
                            </p>
                        </div>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-activa-amber border border-amber-200 w-fit">
                        ● Pendiente
                    </span>
                </div>

                <div className="mt-5 space-y-4">
                    {/* Control Switch Nacional / Extranjero */}
                    <div>
                        <label className="text-xs uppercase tracking-wider font-bold text-neutral-600 block mb-2">
                            1. Nacionalidad del Emprendedor (¿Cuál es tu país de origen?)
                        </label>
                        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 max-w-full">
                            <button
                                type="button"
                                onClick={() => handleSwitchTipo(true)}
                                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${
                                    esNacional
                                        ? 'bg-activa-teal text-white shadow-sm'
                                        : 'text-neutral-600 hover:text-neutral-800'
                                }`}
                            >
                                <span>🇧🇴</span>
                                <span>Nacional (Bolivia)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSwitchTipo(false)}
                                className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${
                                    !esNacional
                                        ? 'bg-jci-blue text-white shadow-sm'
                                        : 'text-neutral-600 hover:text-neutral-800'
                                }`}
                            >
                                <span>🌍</span>
                                <span>Extranjero</span>
                            </button>
                        </div>
                    </div>

                    {/* Selector de País si es Extranjero */}
                    {!esNacional && (
                        <div className="animate-fade-in">
                            <label className="text-xs uppercase tracking-wider font-bold text-neutral-600 block mb-1.5">
                                País de procedencia <span className="text-activa-coral">*</span>
                            </label>
                            <select
                                value={paisSeleccionado}
                                onChange={(e) => setPaisSeleccionado(e.target.value)}
                                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue transition-all cursor-pointer"
                            >
                                <option value="">-- Selecciona tu país de procedencia --</option>
                                {paises.map((item) => (
                                    <option key={item.codigo} value={item.nombre}>
                                        {item.bandera} {item.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Selector de Municipio (87 municipios de La Paz) */}
                    <div>
                        <label className="text-xs uppercase tracking-wider font-bold text-neutral-600 block mb-1.5">
                            2. Ubicación del Emprendimiento (Municipio del Dpto. de La Paz donde opera) <span className="text-activa-coral">*</span>
                        </label>
                        <select
                            value={municipioSeleccionado}
                            onChange={(e) => setMunicipioSeleccionado(e.target.value)}
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/30 focus:border-jci-blue transition-all"
                        >
                            <option value="">-- Selecciona un municipio (87 disponibles) --</option>
                            {municipiosRaw.map((mun) => (
                                <option key={mun} value={mun}>
                                    {mun}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Botón de Confirmación */}
                    <div className="pt-2 flex justify-end">
                        <button
                            type="button"
                            disabled={!formularioValido}
                            onClick={() => setShowConfirmModal(true)}
                            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-jci-blue hover:bg-primary-600 text-white font-bold text-sm shadow-md shadow-primary-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-jci-blue"
                        >
                            Guardar Ubicación
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de Confirmación */}
            <UbicacionConfirmModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={handleConfirmarGuardado}
                nacionalidad={getNacionalidadFinal()}
                municipio={normalizarMayusculasOficiales(municipioSeleccionado)}
                bandera={obtenerBanderaActual()}
                loading={saving}
            />
        </>
    );
};
