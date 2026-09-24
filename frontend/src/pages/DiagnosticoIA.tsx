/**
 * Página de Diagnóstico con IA
 * Chat simulado por área — las preguntas se obtienen en batch y se muestran una a una.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { EstadoEmprendimientoModal } from '../components/emprendimiento/EstadoEmprendimientoModal';
import { EmprendimientoFormModal, EmprendimientoFormData } from '../components/emprendimiento/EmprendimientoFormModal';
import { emprendimientoService } from '../services/emprendimientoService';
import {
    diagnosticoIAService,
    AreaInfo,
    PreguntaReformulada,
    RespuestaUsuario,
} from '../services/diagnosticoIAService';
import { Emprendimiento, EstadoEmprendimientoFormData } from '../types/emprendimiento';
import api from '../services/api';
import { LoadingScreen } from '../components/common/LoadingScreen';

interface Message {
    id: number;
    text: string;
    sender: 'ai' | 'user';
}

type DiagFase =
    | 'loading'          // Cargando preguntas del área
    | 'preguntando'      // Mostrando preguntas una a una
    | 'evaluando'        // Evaluando respuestas del área
    | 'resultados'       // Generando resultados finales
    | 'finalizado';      // Diagnóstico terminado

export const DiagnosticoIA = () => {
    const { user, setUser } = useAuth();
    const navigate = useNavigate();

    // Estado del modal y emprendimiento
    const [showEmprendimientoModal, setShowEmprendimientoModal] = useState(false);
    const [showEstadoModal, setShowEstadoModal] = useState(false);
    const [emprendimiento, setEmprendimiento] = useState<Emprendimiento | null>(null);
    const [isLoadingEmprendimiento, setIsLoadingEmprendimiento] = useState(true);

    // Estado de sesión IA
    const [sessionId, setSessionId] = useState('');
    const [userId, setUserId] = useState('');
    const [isSessionReady, setIsSessionReady] = useState(false);
    const [estadoData, setEstadoData] = useState<{ numero_personal: number; ventas_men_prom: number } | null>(null);

    // Estado del diagnóstico por área
    const [fase, setFase] = useState<DiagFase>('loading');
    const [areas, setAreas] = useState<AreaInfo[]>([]);
    const [areaActualIdx, setAreaActualIdx] = useState(0);
    const [preguntasArea, setPreguntasArea] = useState<PreguntaReformulada[]>([]);
    const [preguntaActualIdx, setPreguntaActualIdx] = useState(0);
    const [respuestasArea, setRespuestasArea] = useState<RespuestaUsuario[]>([]);
    // Puntajes acumulados por área para enviar al backend al final
    const [areaScoresAcum, setAreaScoresAcum] = useState<{ id_area: number; area_promedio: number }[]>([]);

    // Chat
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const msgIdRef = useRef(0);

    // Overlay de estado animado ('evaluando' | 'completada' | null)
    const [statusOverlay, setStatusOverlay] = useState<'evaluando' | 'completada' | null>(null);

    // Verificar acceso
    const [hasAccess, setHasAccess] = useState<boolean | null>(null);
    const [isCheckingAccess, setIsCheckingAccess] = useState(true);

    const addMessage = useCallback((text: string, sender: 'ai' | 'user') => {
        msgIdRef.current += 1;
        const msg: Message = { id: msgIdRef.current, text, sender };
        setMessages(prev => [...prev, msg]);
        return msg;
    }, []);

    // Helper: espera N ms (para el efecto de typing delay)
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    // Verificar acceso al componente
    useEffect(() => {
        const checkAccess = async () => {
            if (!user) {
                setHasAccess(false);
                setIsCheckingAccess(false);
                return;
            }
            try {
                const response = await api.get(`/auth/me`, { params: { user_id: user.id_usuario } });
                const freshUser = response.data;
                const enabled = freshUser.habilitado_diag ?? false;
                setHasAccess(enabled);
                if (user.habilitado_diag !== enabled) {
                    setUser({ ...user, habilitado_diag: enabled });
                }
            } catch (error) {
                console.error('Error al verificar acceso:', error);
                setHasAccess(false);
            } finally {
                setIsCheckingAccess(false);
            }
        };
        checkAccess();
    }, []);

    // Obtener emprendimiento
    useEffect(() => {
        const fetchEmprendimiento = async () => {
            if (!user || !hasAccess || isSessionReady) {
                setIsLoadingEmprendimiento(false);
                return;
            }
            try {
                const emp = await emprendimientoService.getEmprendimientoByUser(user.id_usuario);
                setEmprendimiento(emp);
                if (!emp) {
                    setShowEmprendimientoModal(true);
                } else {
                    setShowEstadoModal(true);
                }
            } catch (error) {
                console.error('Error al obtener emprendimiento:', error);
            } finally {
                setIsLoadingEmprendimiento(false);
            }
        };
        fetchEmprendimiento();
    }, [user, hasAccess, isSessionReady]);

    const handleEmprendimientoSubmit = async (formData: EmprendimientoFormData) => {
        if (!user) return;
        try {
            const nuevoEmprendimiento = await emprendimientoService.createEmprendimiento({
                id_usuario: user.id_usuario,
                nombre: formData.nombre,
                rubro: formData.rubro,
                anio_inicio: Number(formData.anio_inicio),
            });
            setEmprendimiento(nuevoEmprendimiento);
            setShowEmprendimientoModal(false);
            setShowEstadoModal(true);
        } catch (error) {
            console.error('Error al crear emprendimiento:', error);
            throw error;
        }
    };

    const handleEstadoSubmit = (formData: EstadoEmprendimientoFormData) => {
        if (!emprendimiento) return;
        setEstadoData({
            numero_personal: formData.numero_personal,
            ventas_men_prom: formData.ventas_men_prom
        });
        setShowEstadoModal(false);
    };


    // ═══════════════════════════════════════
    // FLUJO PRINCIPAL: Iniciar sesión → cargar primera área
    // ═══════════════════════════════════════

    useEffect(() => {
        const inicializarDiagnostico = async () => {
            if (!user || !emprendimiento || showEstadoModal || isSessionReady) return;

            try {
                setFase('loading');

                const response = await diagnosticoIAService.iniciarSesion({
                    id_usuario: user.id_usuario,
                    nombre_usuario: user.nombre || 'Emprendedor',
                    nombre_emprendimiento: emprendimiento.nombre,
                    rubro: emprendimiento.rubro,
                    anio_inicio: emprendimiento.anio_inicio,
                    numero_personal: estadoData?.numero_personal,
                    ventas_men_prom: estadoData?.ventas_men_prom,
                });

                setSessionId(response.session_id);
                setUserId(response.user_id);
                setAreas(response.areas);
                setIsSessionReady(true);

                // Mensaje de bienvenida
                addMessage(
                    `¡Hola ${user.nombre || 'Emprendedor'}! 👋 Vamos a realizar un diagnóstico de "${emprendimiento.nombre}". ` +
                    `Te haré preguntas sobre ${response.areas.length} áreas de tu negocio. ¡Empecemos!`,
                    'ai'
                );

                // Cargar todas las preguntas activas en lote
                await cargarTodasLasPreguntas(response.session_id, response.user_id, response.areas);
            } catch (error) {
                console.error('Error al inicializar:', error);
                addMessage('Lo siento, hubo un error al conectar. Por favor, intenta nuevamente.', 'ai');
            }
        };

        inicializarDiagnostico();
    }, [user, emprendimiento, showEstadoModal, isSessionReady]);

    // ═══════════════════════════════════════
    // CAPA 1: Limpieza al cerrar la pestaña
    // ═══════════════════════════════════════
    useEffect(() => {
        if (!isSessionReady || !sessionId || !userId) return;

        const cleanupFunction = () => {
            diagnosticoIAService.limpiarAbandono(sessionId, userId);
        };

        window.addEventListener('beforeunload', cleanupFunction);

        return () => {
            window.removeEventListener('beforeunload', cleanupFunction);
        };
    }, [isSessionReady, sessionId, userId, fase]);

    // ═══════════════════════════════════════
    // Sincronizar automáticamente areaActualIdx basado en el área de la pregunta actual
    useEffect(() => {
        if (preguntasArea.length > 0 && preguntaActualIdx < preguntasArea.length && areas.length > 0) {
            const currentPregunta = preguntasArea[preguntaActualIdx];
            const idx = areas.findIndex(a => a.nombre_area === currentPregunta.area);
            if (idx !== -1) {
                setAreaActualIdx(idx);
            }
        }
    }, [preguntaActualIdx, preguntasArea, areas]);

    // ═══════════════════════════════════════
    // Cargar todas las preguntas en lote
    // ═══════════════════════════════════════

    const cargarTodasLasPreguntas = async (
        sid: string,
        uid: string,
        _areasArr: AreaInfo[]
    ) => {
        setFase('loading');
        setRespuestasArea([]);
        setPreguntaActualIdx(0);

        try {
            const resp = await diagnosticoIAService.obtenerTodasPreguntas({
                session_id: sid,
                user_id: uid,
            });

            if (!resp.preguntas || resp.preguntas.length === 0) {
                addMessage('No se encontraron preguntas de diagnóstico activas.', 'ai');
                return;
            }

            setPreguntasArea(resp.preguntas);
            setPreguntaActualIdx(0);

            // Mostrar el primer banner de área
            const primeraPregunta = resp.preguntas[0];
            addMessage(`📋 **Área: ${primeraPregunta.area}**`, 'ai');
            
            // Mantener 'loading' durante el delay para mostrar el indicador de typing
            await delay(1500);
            setFase('preguntando');
            mostrarPregunta(resp.preguntas, 0);
        } catch (error) {
            console.error('Error al cargar preguntas:', error);
            addMessage('Hubo un error al cargar las preguntas del diagnóstico. Por favor, intenta de nuevo.', 'ai');
        }
    };

    // ═══════════════════════════════════════
    // Mostrar pregunta formateada en el chat
    // ═══════════════════════════════════════

    const mostrarPregunta = (
        preguntas: PreguntaReformulada[],
        idx: number,
    ) => {
        const p = preguntas[idx];
        let texto = '';
        if (p.intro) texto += `${p.intro}\n\n`;
        texto += `**Pregunta ${idx + 1} de ${preguntas.length}:** ${p.pregunta}`;
        if (p.ejemplo) texto += `\n\n💡 Ejemplo: "${p.ejemplo}"`;
        addMessage(texto, 'ai');
    };

    // ═══════════════════════════════════════
    // Evaluar todas las respuestas de forma secuencial en background
    // ═══════════════════════════════════════

    const evaluarTodoSecuencial = async (
        sid: string,
        uid: string,
        areasArr: AreaInfo[],
        respuestas: RespuestaUsuario[]
    ) => {
        setFase('evaluando');
        setStatusOverlay('evaluando');

        const scoresAcumulados: { id_area: number; area_promedio: number }[] = [];

        try {
            // Evaluar secuencialmente cada área en background
            for (let i = 0; i < areasArr.length; i++) {
                const area = areasArr[i];
                
                // Buscar preguntas asociadas a esta área
                const preguntasDeEsteArea = preguntasArea.filter(p => p.area === area.nombre_area);
                const idsDeEsteArea = new Set(preguntasDeEsteArea.map(p => p.id_pregunta));
                const respuestasDeEsteArea = respuestas.filter(r => idsDeEsteArea.has(r.id_pregunta));

                if (respuestasDeEsteArea.length > 0) {
                    try {
                        const evalResp = await diagnosticoIAService.evaluarArea({
                            session_id: sid,
                            user_id: uid,
                            id_area: area.id_area,
                            respuestas: respuestasDeEsteArea,
                        });
                        scoresAcumulados.push({
                            id_area: area.id_area,
                            area_promedio: evalResp.area_promedio
                        });
                    } catch (err) {
                        console.error(`Error al evaluar área ${area.nombre_area}:`, err);
                        // En caso de error de red, dar un puntaje por defecto para no romper el flujo
                        scoresAcumulados.push({
                            id_area: area.id_area,
                            area_promedio: 50
                        });
                    }
                } else {
                    // Si un área no tiene preguntas activas, puntaje 0
                    scoresAcumulados.push({
                        id_area: area.id_area,
                        area_promedio: 0
                    });
                }
            }

            // Mostrar animación de completado brevemente
            setStatusOverlay('completada');
            setAreaScoresAcum(scoresAcumulados);

            await delay(1800);
            setStatusOverlay(null);

            // Generar resultados finales
            await generarResultados(sid, uid, scoresAcumulados);
        } catch (error) {
            console.error('Error durante la evaluación secuencial:', error);
            setStatusOverlay(null);
            await generarResultados(sid, uid, scoresAcumulados.length > 0 ? scoresAcumulados : areaScoresAcum);
        }
    };

    // ═══════════════════════════════════════
    // Generar resultados finales
    // ═══════════════════════════════════════

    const generarResultados = async (sid: string, uid: string, scores: { id_area: number; area_promedio: number }[]) => {
        setFase('resultados');

        try {
            const resultado = await diagnosticoIAService.obtenerResultados({
                session_id: sid,
                user_id: uid,
                area_scores: scores,
            });

            addMessage(
                resultado.mensaje_despedida ||
                '✅ ¡Diagnóstico completado! Un mentor de nuestro equipo se comunicará contigo a la brevedad para revisar juntos los resultados. ¡Mucho ánimo y sigue adelante! 🌟',
                'ai'
            );
            
            // Marcar en frontend que el usuario ya no puede hacer más diagnósticos
            if (user) {
                setUser({ ...user, habilitado_diag: false });
            }
        } catch (error) {
            console.error('Error al generar resultados:', error);
            addMessage(
                '✅ ¡Diagnóstico completado! Un mentor de nuestro equipo se comunicará contigo a la brevedad para revisar juntos los resultados. ¡Mucho ánimo! 🌟',
                'ai'
            );
        }
        setFase('finalizado');
    };

    // ═══════════════════════════════════════
    // Manejar envío de respuesta del usuario
    // ═══════════════════════════════════════

    const handleSendMessage = async () => {
        if (inputValue.trim() === '' || isSending || fase !== 'preguntando') return;

        const respuesta = inputValue.trim();
        addMessage(respuesta, 'user');
        setInputValue('');
        setIsSending(true);

        try {
            const preguntaActual = preguntasArea[preguntaActualIdx];
            const nuevaRespuesta: RespuestaUsuario = {
                id_pregunta: preguntaActual.id_pregunta,
                respuesta,
            };

            const nuevasRespuestas = [...respuestasArea, nuevaRespuesta];
            setRespuestasArea(nuevasRespuestas);

            const siguienteIdx = preguntaActualIdx + 1;

            if (siguienteIdx < preguntasArea.length) {
                const siguientePregunta = preguntasArea[siguienteIdx];
                
                setPreguntaActualIdx(siguienteIdx);
                setFase('loading'); // Activa el indicador de typing

                // Si la siguiente pregunta es de otra área, mostrar banner de transición
                if (siguientePregunta.area !== preguntaActual.area) {
                    await delay(800);
                    addMessage(`📋 **Área: ${siguientePregunta.area}**`, 'ai');
                    await delay(1200);
                } else {
                    await delay(1400);
                }

                setFase('preguntando');
                mostrarPregunta(preguntasArea, siguienteIdx);
            } else {
                // Terminaron todas las preguntas — evaluar secuencialmente
                await evaluarTodoSecuencial(sessionId, userId, areas, nuevasRespuestas);
            }
        } catch (error) {
            console.error('Error al procesar respuesta:', error);
            addMessage('Hubo un error al procesar tu respuesta. Por favor, intenta de nuevo.', 'ai');
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    };

    const handleGoBack = async () => {
        if (isSessionReady && sessionId && userId) {
            try {
                // Borrar sesión ADK y datos BD (si está incompleto)
                await diagnosticoIAService.finalizarSesion(sessionId, userId);
            } catch (error) {
                console.error('Error al finalizar sesión:', error);
            }
        }
        navigate(-1);
    };

    // Auto scroll
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // ═══════════════════════════════════════
    // RENDERS CONDICIONALES (modales, acceso)
    // ═══════════════════════════════════════

    if (isCheckingAccess) {
        return <LoadingScreen message="Verificando acceso al diagnóstico..." />;
    }

    if (!hasAccess) {
        return (
            <div className="min-h-screen bg-light-bg flex items-center justify-center p-4">
                <div className="max-w-2xl w-full text-center">
                    <div className="mb-6">
                        <svg className="w-24 h-24 mx-auto text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-neutral-900 mb-4">Acceso No Disponible</h1>
                    <p className="text-neutral-600 text-lg mb-2">Usted ya realizó el diagnóstico.</p>
                    <p className="text-neutral-700 text-xl font-semibold mb-8">Cumpla sus tareas y espere a ser habilitado.</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors duration-200 inline-flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Volver
                    </button>
                    <div className="mt-8 pt-8 border-t border-light-border">
                        <p className="text-gray-500 text-sm">
                            Complete las tareas asignadas para poder realizar un nuevo diagnóstico.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (isLoadingEmprendimiento) {
        return (
            <div className="min-h-screen bg-light-bg flex items-center justify-center">
                <div className="text-neutral-900 text-lg">Cargando...</div>
            </div>
        );
    }

    if (showEmprendimientoModal) {
        return (
            <div className="min-h-screen bg-light-bg">
                <EmprendimientoFormModal onSubmit={handleEmprendimientoSubmit} />
            </div>
        );
    }

    if (showEstadoModal && emprendimiento) {
        return (
            <div className="min-h-screen bg-light-bg">
                <EstadoEmprendimientoModal onSubmit={handleEstadoSubmit} />
            </div>
        );
    }

    // ═══════════════════════════════════════
    // CHAT PRINCIPAL
    // ═══════════════════════════════════════

    const inputDisabled = fase !== 'preguntando' || isSending;
    const areaProgress = areas.length > 0
        ? `Área ${Math.min(areaActualIdx + 1, areas.length)} de ${areas.length}`
        : '';

    return (
        <div className="bg-light-bg text-neutral-900">
            <div className="h-screen flex flex-col">
                {/* Header */}
                <div className="flex-shrink-0 bg-gradient-to-r from-activa-dark-teal to-activa-teal border-b border-activa-teal/30 px-3 sm:px-6 py-3 sm:py-4 shadow-sm">
                    <div className="max-w-4xl mx-auto flex items-center gap-3">
                        <button
                            onClick={handleGoBack}
                            className="flex-shrink-0 text-white/80 hover:text-white transition-colors p-1"
                            aria-label="Volver"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>

                        {/* Avatar de Luci */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center">
                            <span className="text-white font-extrabold text-lg">L</span>
                        </div>

                        <div className="flex-1">
                            <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">Luci</h1>
                            <p className="text-white/70 text-xs">
                                {areaProgress && fase !== 'finalizado'
                                    ? `${areaProgress} — Responde con honestidad 💬`
                                    : fase === 'finalizado'
                                        ? 'Diagnóstico completado ✅'
                                        : 'Asistente de Diagnóstico Activa Mujer'}
                            </p>
                        </div>

                        {/* Badge de estado */}
                        <div className="flex-shrink-0 flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                                fase === 'finalizado'
                                    ? 'bg-white/20 text-white'
                                    : 'bg-white/30 text-white'
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                    fase === 'finalizado' ? 'bg-green-300' : 'bg-white animate-pulse'
                                }`}></span>
                                {fase === 'finalizado' ? 'Finalizado' : 'En línea'}
                            </span>
                            <img
                                src="/logo-activa-mujer.webp"
                                alt="Activa Mujer"
                                className="h-8 sm:h-10 w-auto object-contain opacity-90"
                            />
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto bg-slate-50 px-3 sm:px-6 py-3 sm:py-4">
                    <div className="max-w-4xl mx-auto space-y-3 sm:space-y-4">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex items-start gap-2 sm:gap-3 ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}
                            >
                                <div className="flex-shrink-0">
                                    {message.sender === 'ai' ? (
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-activa-teal to-activa-dark-teal flex items-center justify-center shadow-sm">
                                            <span className="text-white font-extrabold text-sm sm:text-base">L</span>
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-activa-coral flex items-center justify-center shadow-sm">
                                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                <div className={`flex flex-col ${message.sender === 'user' ? 'items-end' : 'items-start'} max-w-[78%] sm:max-w-lg`}>
                                    <span className="text-xs font-semibold mb-1 tracking-wide" style={{ color: message.sender === 'ai' ? '#1E766F' : '#F07A5C' }}>
                                        {message.sender === 'ai' ? 'Luci' : (user?.nombre || 'Tú')}
                                    </span>
                                    <div className={`rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 shadow-sm ${
                                        message.sender === 'ai'
                                            ? 'bg-white border border-slate-100 text-neutral-800'
                                            : 'bg-activa-coral text-white'
                                    }`}>
                                        {message.sender === 'ai' ? (
                                            <div className="text-xs sm:text-sm leading-relaxed break-words [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-0.5 [&_p]:mb-1 [&_h1]:text-sm [&_h1]:font-bold [&_h2]:text-xs [&_h2]:font-semibold [&_h3]:font-semibold">
                                                <ReactMarkdown>{message.text}</ReactMarkdown>
                                            </div>
                                        ) : (
                                            <p className="text-xs sm:text-sm leading-relaxed break-words">
                                                {message.text}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Indicador de typing (loading/resultados) */}
                        {(fase === 'loading' || fase === 'resultados') && (
                            <div className="flex items-start gap-2 sm:gap-3">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-activa-teal to-activa-dark-teal flex items-center justify-center shadow-sm flex-shrink-0">
                                    <span className="text-white font-extrabold text-sm sm:text-base">L</span>
                                </div>
                                <div className="bg-white border border-slate-100 rounded-2xl px-4 py-3 shadow-sm">
                                    <div className="flex space-x-1">
                                        <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#3AADA8', animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#3AADA8', animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#3AADA8', animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Overlay animado de estado (evaluando / completada) */}
                        {statusOverlay && (
                            <div className="flex justify-center my-2">
                                {statusOverlay === 'evaluando' ? (
                                    <div className="flex items-center gap-2 px-5 py-2.5 bg-activa-teal/10 border border-activa-teal/30 rounded-full shadow-sm">
                                        <svg className="w-4 h-4 text-activa-teal animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        <span className="text-xs font-semibold text-activa-dark-teal">Luci está analizando tus respuestas...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 px-5 py-2.5 bg-activa-coral/10 border border-activa-coral/30 rounded-full shadow-sm">
                                        <svg className="w-4 h-4 text-activa-coral" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="text-xs font-semibold text-activa-coral">¡Diagnóstico completado!</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input Area */}
                <div className="flex-shrink-0 bg-white border-t border-slate-100 px-3 sm:px-6 py-2 sm:py-3 shadow-lg">
                    <div className="max-w-4xl mx-auto">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <input
                                type="text"
                                lang="es"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder={inputDisabled ? 'Luci está escribiendo...' : 'Escribe tu respuesta...'}
                                disabled={inputDisabled}
                                className="flex-1 bg-slate-50 border border-slate-200 text-neutral-900 rounded-2xl px-3 sm:px-4 py-2 sm:py-3 text-sm focus:outline-none focus:ring-2 focus:ring-activa-teal/50 focus:border-activa-teal disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={inputValue.trim() === '' || inputDisabled}
                                className="bg-activa-coral hover:bg-activa-amber text-white rounded-2xl p-2 sm:px-4 sm:py-3 font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
                            >
                                {isSending ? (
                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
