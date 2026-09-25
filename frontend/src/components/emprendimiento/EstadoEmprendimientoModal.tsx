/**
 * Modal de Estado del Emprendimiento
 * Se muestra antes de entrar al diagnóstico IA para recolectar datos actuales del emprendimiento
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EstadoEmprendimientoFormData } from '../../types/emprendimiento';

interface EstadoEmprendimientoModalProps {
    onSubmit: (data: EstadoEmprendimientoFormData) => Promise<void> | void;
}

export const EstadoEmprendimientoModal = ({ onSubmit }: EstadoEmprendimientoModalProps) => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState<{
        numero_personal: number | string;
        ventas_men_prom: number | string;
    }>({
        numero_personal: '',  // Iniciar vacío en lugar de 0
        ventas_men_prom: '',  // Iniciar vacío en lugar de 0
    });
    const [errors, setErrors] = useState<Partial<Record<'numero_personal' | 'ventas_men_prom', string>>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const validate = (): boolean => {
        const newErrors: Partial<Record<'numero_personal' | 'ventas_men_prom', string>> = {};

        const numPersonal = typeof formData.numero_personal === 'string' && formData.numero_personal === ''
            ? null
            : Number(formData.numero_personal);
        const ventasProm = typeof formData.ventas_men_prom === 'string' && formData.ventas_men_prom === ''
            ? null
            : Number(formData.ventas_men_prom);

        if (numPersonal === null || numPersonal < 0) {
            newErrors.numero_personal = 'El número de personal es requerido y no puede ser negativo';
        }
        if (ventasProm === null || ventasProm < 0) {
            newErrors.ventas_men_prom = 'Las ventas son requeridas y no pueden ser negativas';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        setIsSubmitting(true);
        try {
            await onSubmit({
                numero_personal: Number(formData.numero_personal),
                ventas_men_prom: Number(formData.ventas_men_prom),
            });
        } catch (error) {
            console.error('Error al enviar formulario:', error);
            alert('Error al guardar los datos. Por favor, intenta de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value === '' ? '' : parseFloat(value) }));
        // Clear error when user starts typing
        if (errors[name as 'numero_personal' | 'ventas_men_prom']) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleCancel = () => {
        navigate(-1); // Volver a la página anterior
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 border border-light-border">
                {/* Header */}
                <div className="mb-4">
                    <div className="flex items-center justify-center mb-3">
                        <div className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center">
                            <svg
                                className="w-6 h-6 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                />
                            </svg>
                        </div>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 mb-2 text-center">
                        Estado Actual del Emprendimiento
                    </h2>
                    <p className="text-neutral-600 text-xs sm:text-sm text-center">
                        Antes de comenzar el diagnóstico, cuéntanos sobre el estado actual de tu emprendimiento.
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Número de Personal */}
                    <div>
                        <label htmlFor="numero_personal" className="block text-sm font-medium text-neutral-700 mb-1.5">
                            ¿Cuántas personas trabajan en tu emprendimiento? <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                id="numero_personal"
                                name="numero_personal"
                                value={formData.numero_personal}
                                onChange={handleChange}
                                min="0"
                                step="1"
                                className={`w-full bg-neutral-50 text-neutral-900 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ${errors.numero_personal ? 'ring-2 ring-red-500' : 'focus:ring-blue-500'
                                    }`}
                                placeholder="Ej: 3"
                            />
                        </div>
                        {errors.numero_personal && (
                            <p className="text-red-500 text-xs mt-1">{errors.numero_personal}</p>
                        )}
                        <p className="text-gray-500 text-xs mt-1">Incluye a todos los colaboradores</p>
                    </div>

                    {/* Ventas Mensuales Promedio */}
                    <div>
                        <label htmlFor="ventas_men_prom" className="blocktext-sm font-medium text-neutral-700 mb-1.5">
                            ¿Cuáles son tus ventas mensuales promedio? (Bs.) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-600 font-medium text-sm">
                                Bs.
                            </span>
                            <input
                                type="number"
                                id="ventas_men_prom"
                                name="ventas_men_prom"
                                value={formData.ventas_men_prom}
                                onChange={handleChange}
                                min="0"
                                step="0.01"
                                className={`w-full bg-neutral-50 text-neutral-900 rounded-lg pl-12 pr-3 py-2 focus:outline-none focus:ring-2 ${errors.ventas_men_prom ? 'ring-2 ring-red-500' : 'focus:ring-blue-500'
                                    }`}
                                placeholder="Ej: 5000.00"
                            />
                        </div>
                        {errors.ventas_men_prom && (
                            <p className="text-red-500 text-xs mt-1">{errors.ventas_men_prom}</p>
                        )}
                        <p className="text-gray-500 text-xs mt-1">Promedio de los últimos 3 meses</p>
                    </div>

                    {/* Info Box */}
                    <div className="bg-primary-50 border border-primary-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                            <svg
                                className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                            </svg>
                            <p className="text-primary-700 text-xs">
                                Esta información nos ayuda a personalizar el diagnóstico y brindarte recomendaciones más precisas.
                            </p>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 mt-5">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="flex-1 bg-neutral-50 hover:bg-neutral-200 text-neutral-900 font-semibold py-2.5 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 bg-primary-500 hover:bg-primary-600 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Guardando...' : 'Continuar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
