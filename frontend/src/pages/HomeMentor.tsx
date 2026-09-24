/**
 * Página Home para Mentor
 * Dashboard con estadísticas de emprendedores asignados
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/common/Layout';
import { MenuItem } from '../components/common/Sidebar';
import { LoadingScreen } from '../components/common/LoadingScreen';
import { mentorService } from '../services/mentorService';
import type { MentorDashboardStats } from '../types/mentor';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js'
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

const menuItems: MenuItem[] = [
    { label: 'Dashboard', path: '/mentor/home' },
    { label: 'Diagnósticos', path: '/mentor/diagnosticos' },
    { label: 'Generar Reportes', path: '/mentor/reportes' },
];

export const HomeMentor = () => {
    const { user, logout } = useAuth();
    const [stats, setStats] = useState<MentorDashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDashboardStats = async () => {
            if (!user) return;

            try {
                setLoading(true);
                const data = await mentorService.getMentorDashboard(user.id_usuario);
                setStats(data);
            } catch (err) {
                console.error('Error al cargar estadísticas:', err);
                setError('Error al cargar las estadísticas del dashboard');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardStats();
    }, [user]);



    // Datos para el gráfico de barras
    const chartData = stats ? {
        labels: ['C. Finanzas', 'G. Procesos', 'Marketing', 'Ventas', 'Tecnología', 'R. Humanos', 'E. Cuidado'],
        datasets: [
            {
                label: 'Promedio por Área',
                data: [
                    stats.promedios_por_area.cf,
                    stats.promedios_por_area.gp,
                    stats.promedios_por_area.m,
                    stats.promedios_por_area.v,
                    stats.promedios_por_area.tp,
                    stats.promedios_por_area.rh,
                    stats.promedios_por_area.ec
                ],
                backgroundColor: [
                    'rgba(240, 122, 92, 0.8)',   // activa-coral #F07A5C
                    'rgba(232, 168, 46, 0.8)',   // activa-amber #E8A82E
                    'rgba(58, 173, 168, 0.8)',   // activa-teal #3AADA8
                    'rgba(30, 118, 111, 0.8)',   // activa-dark-teal #1E766F
                    'rgba(245, 197, 163, 0.8)',  // activa-peach #F5C5A3
                    'rgba(0, 174, 239, 0.8)',    // jci-blue #00AEEF
                    'rgba(100, 116, 139, 0.8)'   // jci-gray #64748B
                ],
                borderColor: [
                    'rgb(240, 122, 92)',
                    'rgb(232, 168, 46)',
                    'rgb(58, 173, 168)',
                    'rgb(30, 118, 111)',
                    'rgb(245, 197, 163)',
                    'rgb(0, 174, 239)',
                    'rgb(100, 116, 139)'
                ],
                borderWidth: 2,
                borderRadius: 8,
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
            },
            tooltip: {
                backgroundColor: 'rgba(17, 24, 39, 0.95)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: 'rgba(75, 85, 99, 0.5)',
                borderWidth: 1,
                padding: 12,
                displayColors: false,
                callbacks: {
                    label: function (context: any) {
                        return `Promedio: ${context.parsed.y.toFixed(1)}`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                ticks: {
                    color: '#9CA3AF',
                    font: {
                        size: 12
                    }
                },
                grid: {
                    color: 'rgba(75, 85, 99, 0.2)'
                }
            },
            x: {
                ticks: {
                    color: '#9CA3AF',
                    font: {
                        size: 11
                    }
                },
                grid: {
                    display: false
                }
            }
        }
    };

    if (loading) {
        return (
            <Layout menuItems={menuItems} onLogout={logout}>
                <LoadingScreen fullScreen={false} message="Cargando panel de mentoría..." />
            </Layout>
        );
    }

    if (error || !stats) {
        return (
            <Layout menuItems={menuItems} onLogout={logout}>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-red-500">{error || 'Error al cargar datos'}</div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout menuItems={menuItems} onLogout={logout}>
            <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-800 tracking-tight mb-1 sm:mb-2">
                            Dashboard de Mentor
                        </h1>
                        <p className="text-neutral-500 text-sm sm:text-base font-medium tracking-wide">
                            Estadísticas de tus emprendedores asignados
                        </p>
                    </div>
                    <div className="mt-2 sm:mt-0">
                        <img src="/logo-activa-mujer.webp" alt="Activa Mujer" className="h-14 sm:h-16 w-auto object-contain" />
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-4 sm:mb-6">
                    {/* Total Emprendedores */}
                    <div className="group bg-white rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-sm hover:shadow-md hover:border-activa-coral/30 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-activa-coral/40 to-activa-coral"></div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                            <div>
                                <p className="text-neutral-400 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-1.5">
                                    Total Emprendedores
                                </p>
                                <p className="text-2xl sm:text-3xl font-extrabold text-neutral-800">
                                    {stats.total_emprendedores}
                                </p>
                            </div>
                            <div className="bg-activa-coral/5 p-3 rounded-xl self-start sm:self-auto group-hover:bg-activa-coral/10 transition-colors duration-300 border border-activa-coral/10">
                                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-activa-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Tasa de Aprobado */}
                    <div className="group bg-white rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-sm hover:shadow-md hover:border-activa-teal/30 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-activa-teal/40 to-activa-teal"></div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                            <div>
                                <p className="text-neutral-400 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-1.5">
                                    Tasa de Aprobado
                                </p>
                                <p className="text-2xl sm:text-3xl font-extrabold text-neutral-800">
                                    {stats.tasa_exito.toFixed(1)}%
                                </p>
                            </div>
                            <div className="bg-activa-teal/5 p-3 rounded-xl self-start sm:self-auto group-hover:bg-activa-teal/10 transition-colors duration-300 border border-activa-teal/10">
                                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-activa-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Promedio General */}
                    <div className="group bg-white rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-sm hover:shadow-md hover:border-activa-amber/30 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-activa-amber/40 to-activa-amber"></div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                            <div>
                                <p className="text-neutral-400 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-1.5">
                                    Promedio General
                                </p>
                                <p className="text-2xl sm:text-3xl font-extrabold text-neutral-800">
                                    {stats.promedio_general.toFixed(1)}
                                </p>
                            </div>
                            <div className="bg-activa-amber/5 p-3 rounded-xl self-start sm:self-auto group-hover:bg-activa-amber/10 transition-colors duration-300 border border-activa-amber/10">
                                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-activa-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Habilitados */}
                    <div className="group bg-white rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-sm hover:shadow-md hover:border-activa-dark-teal/30 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-activa-dark-teal/40 to-activa-dark-teal"></div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                            <div>
                                <p className="text-neutral-400 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-1.5">
                                    Habilitados
                                </p>
                                <p className="text-2xl sm:text-3xl font-extrabold text-neutral-800">
                                    {stats.emprendedores_habilitados}
                                </p>
                            </div>
                            <div className="bg-activa-dark-teal/5 p-3 rounded-xl self-start sm:self-auto group-hover:bg-activa-dark-teal/10 transition-colors duration-300 border border-activa-dark-teal/10">
                                <svg className="w-6 h-6 sm:w-8 sm:h-8 text-activa-dark-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Gráfico de Áreas */}
                <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-100 shadow-sm mb-4">
                    <h2 className="text-lg sm:text-xl font-extrabold text-neutral-800 tracking-tight mb-3 sm:mb-4">
                        Promedios por Área de Análisis
                    </h2>
                    <div className="h-52 sm:h-72">
                        {chartData && <Bar data={chartData} options={chartOptions} />}
                    </div>
                </div>
            </div>
        </Layout>
    );
};
