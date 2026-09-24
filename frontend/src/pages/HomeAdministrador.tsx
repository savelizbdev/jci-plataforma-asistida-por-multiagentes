/**
 * Página Home para Administrador
 * Dashboard con estadísticas globales de todos los emprendedores y mentores
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/common/Layout';
import { LoadingScreen } from '../components/common/LoadingScreen';
import { adminService } from '../services/adminService';
import type { AdminDashboardData } from '../types/admin';
import { ADMIN_MENU_ITEMS } from '../constants/adminMenu';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Registrar componentes de Chart.js
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);


export const HomeAdministrador = () => {
    const { logout } = useAuth();
    const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);



    // Cargar datos del dashboard
    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                setLoading(true);
                const data = await adminService.getAdminDashboard();
                setDashboardData(data);
            } catch (err) {
                console.error('Error al cargar dashboard del administrador:', err);
                setError('Error al cargar los datos del dashboard');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, []);

    // Datos para el gráfico de barras
    const chartData = dashboardData ? {
        labels: ['CF', 'GP', 'M', 'V', 'TP', 'RH'],
        datasets: [
            {
                label: 'Promedio por Área',
                data: [
                    dashboardData.promedio_cf,
                    dashboardData.promedio_gp,
                    dashboardData.promedio_m,
                    dashboardData.promedio_v,
                    dashboardData.promedio_tp,
                    dashboardData.promedio_rh
                ],
                backgroundColor: [
                    'rgba(240, 122, 92, 0.8)',   // activa-coral #F07A5C
                    'rgba(232, 168, 46, 0.8)',   // activa-amber #E8A82E
                    'rgba(58, 173, 168, 0.8)',   // activa-teal #3AADA8
                    'rgba(30, 118, 111, 0.8)',   // activa-dark-teal #1E766F
                    'rgba(245, 197, 163, 0.8)',  // activa-peach #F5C5A3
                    'rgba(0, 174, 239, 0.8)'     // jci-blue
                ],
                borderColor: [
                    'rgb(240, 122, 92)',
                    'rgb(232, 168, 46)',
                    'rgb(58, 173, 168)',
                    'rgb(30, 118, 111)',
                    'rgb(245, 197, 163)',
                    'rgb(0, 174, 239)'
                ],
                borderWidth: 2,
                borderRadius: 6
            }
        ]
    } : null;

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            title: {
                display: false
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                grid: {
                    color: 'rgba(75, 85, 99, 0.2)'
                },
                ticks: {
                    color: '#9CA3AF'
                }
            },
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    color: '#D1D5DB'
                }
            }
        }
    };

    if (loading) {
        return (
            <Layout menuItems={ADMIN_MENU_ITEMS} onLogout={logout}>
                <LoadingScreen fullScreen={false} message="Cargando panel de administración..." />
            </Layout>
        );
    }

    if (error || !dashboardData) {
        return (
            <Layout menuItems={ADMIN_MENU_ITEMS} onLogout={logout}>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-red-400">{error || 'Error al cargar datos'}</div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout menuItems={ADMIN_MENU_ITEMS} onLogout={logout}>
            <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-4 sm:mb-6">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-800 tracking-tight mb-1 sm:mb-2">
                        Dashboard Administrador
                    </h1>
                    <p className="text-neutral-500 text-sm sm:text-base font-medium tracking-wide">
                        Estadísticas globales del sistema
                    </p>
                </div>

                {/* KPI Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5 mb-4 sm:mb-6">
                    {/* Total Emprendedores */}
                    <div className="group bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-jci-blue/30 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-jci-blue/40 to-jci-blue"></div>
                        <div className="flex flex-col h-full">
                            <div className="flex items-start justify-between mb-3">
                                <div className="bg-jci-blue/5 p-2.5 rounded-xl group-hover:bg-jci-blue/10 transition-colors duration-300 border border-jci-blue/10">
                                    <svg className="w-6 h-6 text-jci-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="mt-auto">
                                <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Total Emprendedores</p>
                                <p className="text-2xl sm:text-3xl font-extrabold text-neutral-800">{dashboardData.total_emprendedores}</p>
                            </div>
                        </div>
                    </div>

                    {/* Total Mentores Activos */}
                    <div className="group bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-200 to-slate-400"></div>
                        <div className="flex flex-col h-full">
                            <div className="flex items-start justify-between mb-3">
                                <div className="bg-slate-50 p-2.5 rounded-xl group-hover:bg-slate-100 transition-colors duration-300 border border-slate-200">
                                    <svg className="w-6 h-6 text-jci-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="mt-auto">
                                <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-1">Mentores Activos</p>
                                <p className="text-2xl sm:text-3xl font-extrabold text-neutral-800">{dashboardData.total_mentores_activos}</p>
                            </div>
                        </div>
                    </div>

                    {/* Tasa de Éxito */}
                    <div className="group bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-activa-teal/30 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-activa-teal/40 to-activa-teal"></div>
                        <div className="flex flex-col h-full">
                            <div className="flex items-start justify-between mb-3">
                                <div className="bg-activa-teal/5 p-2.5 rounded-xl group-hover:bg-activa-teal/10 transition-colors duration-300 border border-activa-teal/10">
                                    <svg className="w-6 h-6 text-activa-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="mt-auto">
                                <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-1">Tasa de Éxito</p>
                                <p className="text-2xl sm:text-3xl font-extrabold text-neutral-800">{dashboardData.tasa_exito.toFixed(1)}%</p>
                            </div>
                        </div>
                    </div>

                    {/* Diagnósticos Completados */}
                    <div className="group bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-activa-coral/30 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-activa-coral/40 to-activa-coral"></div>
                        <div className="flex flex-col h-full">
                            <div className="flex items-start justify-between mb-3">
                                <div className="bg-activa-coral/5 p-2.5 rounded-xl group-hover:bg-activa-coral/10 transition-colors duration-300 border border-activa-coral/10">
                                    <svg className="w-6 h-6 text-activa-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="mt-auto">
                                <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-1">Completados</p>
                                <p className="text-2xl sm:text-3xl font-extrabold text-neutral-800">{dashboardData.diagnosticos_completados}</p>
                            </div>
                        </div>
                    </div>

                    {/* Promedio General */}
                    <div className="group bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-activa-amber/30 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-activa-amber/40 to-activa-amber"></div>
                        <div className="flex flex-col h-full">
                            <div className="flex items-start justify-between mb-3">
                                <div className="bg-activa-amber/5 p-2.5 rounded-xl group-hover:bg-activa-amber/10 transition-colors duration-300 border border-activa-amber/10">
                                    <svg className="w-6 h-6 text-activa-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                </div>
                            </div>
                            <div className="mt-auto">
                                <p className="text-neutral-400 text-xs font-semibold uppercase tracking-wider mb-1">Promedio General</p>
                                <p className="text-2xl sm:text-3xl font-extrabold text-neutral-800">{dashboardData.promedio_general.toFixed(1)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chart Section */}
                <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-100 shadow-sm mb-4">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg sm:text-xl font-extrabold text-neutral-800 tracking-tight">
                            Promedios por Área
                        </h2>
                    </div>
                    <div className="h-40 sm:h-56 mb-2 sm:mb-3">
                        {chartData && <Bar data={chartData} options={chartOptions} />}
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
                        <div className="text-center">
                            <p className="text-neutral-600 text-xs mb-1">CF - Costos y Finanzas</p>
                            <p className="text-neutral-900 font-semibold">{dashboardData.promedio_cf.toFixed(1)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-neutral-600 text-xs mb-1">GP - Gestión y Planificación</p>
                            <p className="text-neutral-900 font-semibold">{dashboardData.promedio_gp.toFixed(1)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-neutral-600 text-xs mb-1">M - Marketing</p>
                            <p className="text-neutral-900 font-semibold">{dashboardData.promedio_m.toFixed(1)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-neutral-600 text-xs mb-1">V - Ventas</p>
                            <p className="text-neutral-900 font-semibold">{dashboardData.promedio_v.toFixed(1)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-neutral-600 text-xs mb-1">TP - Tecnologías</p>
                            <p className="text-neutral-900 font-semibold">{dashboardData.promedio_tp.toFixed(1)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-neutral-600 text-xs mb-1">RH - Recursos Humanos</p>
                            <p className="text-neutral-900 font-semibold">{dashboardData.promedio_rh.toFixed(1)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
};
