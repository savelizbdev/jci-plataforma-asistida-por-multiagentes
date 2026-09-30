import React from 'react';
import { ProgramaItem } from '../../types/programa';

interface ProgramaSelectorProps {
    programas: ProgramaItem[];
    selectedProgramaId: number | null;
    onSelectPrograma: (idPrograma: number) => void;
    loading?: boolean;
}

export const ProgramaSelector: React.FC<ProgramaSelectorProps> = ({
    programas,
    selectedProgramaId,
    onSelectPrograma,
    loading = false,
}) => {
    if (loading) {
        return (
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-1.5 text-xs text-neutral-400 animate-pulse">
                <div className="w-2 h-2 rounded-full bg-jci-blue"></div>
                <span>Cargando programas...</span>
            </div>
        );
    }

    if (programas.length === 0) {
        return null;
    }

    // Si solo tiene 1 programa, mostrar badge institucional limpio
    if (programas.length === 1) {
        const prog = programas[0];
        return (
            <div className="inline-flex items-center space-x-2 bg-primary-50 border border-primary-100 rounded-xl px-3 py-1 shadow-2xs text-xs font-semibold text-jci-blue">
                <span className="w-2 h-2 rounded-full bg-jci-blue"></span>
                <span>{prog.nombre_programa}</span>
                <span className="text-primary-300">·</span>
                <span className="text-primary-700/80 font-normal">{prog.nombre_organizacion}</span>
            </div>
        );
    }

    return (
        <div className="flex items-center space-x-2">
            <label className="text-xs font-bold text-neutral-500 flex items-center gap-1.5 whitespace-nowrap">
                <svg className="w-3.5 h-3.5 text-jci-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                <span>Programa:</span>
            </label>
            <div className="relative">
                <select
                    value={selectedProgramaId ?? ''}
                    onChange={(e) => onSelectPrograma(Number(e.target.value))}
                    className="appearance-none bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 py-1.5 pr-8 text-xs font-bold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-jci-blue/40 cursor-pointer transition-colors shadow-2xs"
                >
                    {programas.map((prog) => (
                        <option key={prog.id_programa} value={prog.id_programa} className="bg-white text-neutral-800">
                            {prog.nombre_programa} ({prog.nombre_organizacion})
                        </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-neutral-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
        </div>
    );
};
