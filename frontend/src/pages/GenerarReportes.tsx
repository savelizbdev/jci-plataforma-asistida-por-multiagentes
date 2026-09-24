/**
 * Página de Generación de Reportes para Mentor
 * Permite generar reportes PDF con estadísticas y gráficas
 */
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/common/Layout';
import { MenuItem } from '../components/common/Sidebar';
import { reporteService } from '../services/reporteService';
import type { ReporteRequest } from '../types/reporte';

const menuItems: MenuItem[] = [
    { label: 'Dashboard', path: '/mentor/home' },
    { label: 'Diagnósticos', path: '/mentor/diagnosticos' },
    { label: 'Generar Reportes', path: '/mentor/reportes' },
];

export const GenerarReportes = () => {
    const { user, logout } = useAuth();
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);



    const handleGenerarReporte = async () => {
        if (!user) return;

        // Validaciones
        if (!fechaInicio || !fechaFin) {
            setError('Por favor, selecciona ambas fechas');
            return;
        }

        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);

        if (fin <= inicio) {
            setError('La fecha fin debe ser posterior a la fecha de inicio');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            setSuccess(null);

            const request: ReporteRequest = {
                id_mentor: user.id_usuario,
                fecha_inicio: new Date(fechaInicio).toISOString(),
                fecha_fin: new Date(fechaFin).toISOString()
            };

            const pdfBlob = await reporteService.generarReporte(request);

            // Crear URL para descargar
            const url = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `reporte_${fechaInicio}_${fechaFin}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            setSuccess('✓ Reporte generado exitosamente');
            setTimeout(() => setSuccess(null), 3000);

        } catch (err: any) {
            console.error('Error al generar reporte:', err);
            const errorMsg = err.response?.data?.detail || 'Error al generar el reporte';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout menuItems={menuItems} onLogout={logout}>
            <div className="px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto">
                {/* Header */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-800 tracking-tight mb-1">
                            Generar Reporte
                        </h1>
                        <p className="text-sm text-neutral-500 font-medium">
                            Genera reportes PDF con estadísticas de tus emprendedores
                        </p>
                    </div>
                    <div className="mt-2 sm:mt-0">
                        <img src="/logo-activa-mujer.webp" alt="Activa Mujer" className="h-14 sm:h-16 w-auto object-contain" />
                    </div>
                </div>

                {/* Card Principal */}
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                    {/* Icono */}
                    <div className="flex justify-center mb-5">
                        <div className="w-16 h-16 bg-gradient-to-br from-activa-teal to-activa-dark-teal rounded-2xl flex items-center justify-center shadow-md">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                    </div>

                    {/* Mensajes */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="mb-4 p-3 bg-activa-teal/10 border border-activa-teal/30 rounded-xl text-sm text-activa-dark-teal font-medium">
                            {success}
                        </div>
                    )}

                    {/* Formulario */}
                    <div className="space-y-4">
                        {/* Fecha Inicio */}
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                                Fecha de Inicio <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="date"
                                value={fechaInicio}
                                onChange={(e) => {
                                    setFechaInicio(e.target.value);
                                    setError(null);
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-activa-teal/50 focus:border-activa-teal transition-all shadow-sm"
                            />
                        </div>

                        {/* Fecha Fin */}
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                                Fecha de Fin <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="date"
                                value={fechaFin}
                                onChange={(e) => {
                                    setFechaFin(e.target.value);
                                    setError(null);
                                }}
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-activa-teal/50 focus:border-activa-teal transition-all shadow-sm"
                            />
                        </div>

                        {/* Información */}
                        <div className="bg-activa-teal/5 border border-activa-teal/20 rounded-xl p-3">
                            <div className="flex items-start gap-2">
                                <svg className="w-4 h-4 text-activa-teal mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="text-xs text-activa-dark-teal">
                                    <p className="font-semibold mb-1">El reporte incluirá:</p>
                                    <ul className="list-disc list-inside space-y-0.5">
                                        <li>Estadísticas de emprendedores asignados</li>
                                        <li>Promedios por área de negocio</li>
                                        <li>Gráficos: barras, líneas y radar</li>
                                        <li>Tasa de aprobado y detalles individuales</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Botón */}
                        <button
                            onClick={handleGenerarReporte}
                            disabled={loading || !fechaInicio || !fechaFin}
                            className="w-full px-4 py-3 bg-gradient-to-r from-activa-teal to-activa-dark-teal hover:from-activa-dark-teal hover:to-activa-dark-teal disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Generando Reporte...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Generar PDF
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Información adicional */}
                <div className="mt-4 text-center text-neutral-600 text-xs">
                    <p>El archivo PDF se descargará automáticamente una vez generado</p>
                </div>
            </div>
        </Layout>
    );
};
