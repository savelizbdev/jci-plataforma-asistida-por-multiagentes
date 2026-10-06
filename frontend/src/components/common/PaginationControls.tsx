/**
 * Componente de control de paginación reutilizable (Spec 004)
 * Muestra estado actual, total de páginas y botones Anterior/Siguiente.
 */
import React from 'react';

interface PaginationControlsProps {
    page: number;
    totalPages: number;
    totalItems?: number;
    limit?: number;
    onPageChange: (newPage: number) => void;
    disabled?: boolean;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
    page,
    totalPages,
    totalItems,
    limit = 15,
    onPageChange,
    disabled = false,
}) => {
    if (totalPages <= 1 && (!totalItems || totalItems <= limit)) {
        return null;
    }

    const startItem = (page - 1) * limit + 1;
    const endItem = totalItems !== undefined ? Math.min(page * limit, totalItems) : page * limit;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border-t border-gray-200 rounded-b-xl text-sm text-gray-700">
            {totalItems !== undefined ? (
                <div className="text-xs text-gray-500">
                    Mostrando <span className="font-semibold text-gray-800">{startItem}</span> a{' '}
                    <span className="font-semibold text-gray-800">{endItem}</span> de{' '}
                    <span className="font-semibold text-gray-800">{totalItems}</span> registros
                </div>
            ) : (
                <div className="text-xs text-gray-500">
                    Página <span className="font-semibold text-gray-800">{page}</span> de{' '}
                    <span className="font-semibold text-gray-800">{totalPages}</span>
                </div>
            )}

            <div className="flex items-center gap-1.5">
                <button
                    type="button"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1 || disabled}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Anterior
                </button>

                <div className="px-2.5 py-1 text-xs font-semibold text-gray-800 bg-gray-100 rounded-lg">
                    {page} / {totalPages || 1}
                </div>

                <button
                    type="button"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages || disabled}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    Siguiente
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </div>
    );
};
