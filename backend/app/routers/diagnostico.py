"""
Router de Diagnóstico
Endpoints para gestión de diagnósticos
"""
import os
from fastapi import APIRouter, HTTPException, status
from app.services.diagnostico_service import DiagnosticoService
from app.models.diagnostico import (
    DiagnosticoCreate,
    DiagnosticoResponse,
    DetalleDiagnosticoCreate,
    DetalleDiagnosticoResponse,
    DiagnosticoUpdate,
    IniciarDiagnosticoIARequest,
    IniciarDiagnosticoIAResponse,
    AreaInfo,
    ChatIARequest,
    ChatIAResponse,
    PreguntaReformulada,
    PreguntasAreaRequest,
    PreguntasAreaResponse,
    RespuestaUsuario,
    ScorePregunta,
    EvaluarAreaRequest,
    EvaluarAreaResponse,
    ResultadosRequest,
    ResultadosResponse,
    PreguntasTodasRequest,
    PreguntasTodasResponse,
)
import httpx


router = APIRouter(prefix="/diagnostico", tags=["Diagnóstico"])


@router.post("", response_model=DiagnosticoResponse, status_code=status.HTTP_201_CREATED)
async def crear_diagnostico(diagnostico_data: DiagnosticoCreate):
    """
    Crea un nuevo registro de diagnóstico
    
    Inicializa un diagnóstico con:
    - fecha_inicio: se crea automáticamente
    - puntaje_total: 0
    - conclusion: vacío
    - resultado: vacío
    
    Args:
        diagnostico_data: Datos del diagnóstico (id_usuario)
    
    Returns:
        DiagnosticoResponse: Diagnóstico creado con su ID
    """
    diagnostico_service = DiagnosticoService()
    
    try:
        diagnostico = await diagnostico_service.create_diagnostico(
            diagnostico_data.id_usuario
        )
        return diagnostico
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear diagnóstico: {str(e)}"
        )


@router.post("/detalle", response_model=DetalleDiagnosticoResponse, status_code=status.HTTP_201_CREATED)
async def crear_detalle_diagnostico(detalle_data: DetalleDiagnosticoCreate):
    """
    Crea un detalle de diagnóstico (respuesta a una pregunta)
    
    Args:
        detalle_data: Datos del detalle (id_diagnostico, id_pregunta, respuesta_usuario, puntaje)
    
    Returns:
        DetalleDiagnosticoResponse: Detalle creado con su ID
    """
    diagnostico_service = DiagnosticoService()
    
    try:
        detalle = await diagnostico_service.create_detalle_diagnostico(
            id_diagnostico=detalle_data.id_diagnostico,
            id_pregunta=detalle_data.id_pregunta,
            respuesta_usuario=detalle_data.respuesta_usuario,
            puntaje=detalle_data.puntaje
        )
        return detalle
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear detalle de diagnóstico: {str(e)}"
        )


@router.put("/{id_diagnostico}", response_model=DiagnosticoResponse)
async def actualizar_diagnostico(id_diagnostico: int, update_data: DiagnosticoUpdate):
    """
    Actualiza un diagnóstico con los resultados finales
    
    Actualiza los campos:
    - puntaje_total
    - conclusion
    - resultado
    
    Args:
        id_diagnostico: ID del diagnóstico a actualizar
        update_data: Datos a actualizar
    
    Returns:
        DiagnosticoResponse: Diagnóstico actualizado
    """
    diagnostico_service = DiagnosticoService()
    
    try:
        diagnostico = await diagnostico_service.update_diagnostico(
            id_diagnostico=id_diagnostico,
            update_data=update_data
        )
        return diagnostico
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar diagnóstico: {str(e)}"
        )


# ============ Endpoints de IA ============

IA_BASE_URL = os.environ.get("IA_DIAGNOSTICO_URL", "http://localhost:9000")
APP_NAME = "multi_agente_diagnostico"


async def _send_to_adk(user_id: str, session_id: str, mensaje: str, timeout: float = 120.0) -> str:
    """Helper: envía mensaje al ADK y extrae texto de respuesta."""
    message_data = {
        "appName": APP_NAME,
        "userId": user_id,
        "sessionId": session_id,
        "newMessage": {
            "role": "user",
            "parts": [{"text": mensaje}]
        }
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{IA_BASE_URL}/run", json=message_data, timeout=timeout)
        response.raise_for_status()
        events = response.json()
    
    respuesta_texto = ""
    for event in events:
        if "modelVersion" in event and "content" in event:
            parts = event["content"].get("parts", [])
            for part in parts:
                if "text" in part:
                    respuesta_texto += part["text"]
    
    return respuesta_texto.strip() if respuesta_texto else ""


@router.post("/ia/iniciar", response_model=IniciarDiagnosticoIAResponse)
async def iniciar_diagnostico_ia(request: IniciarDiagnosticoIARequest):
    """
    Inicia una sesión de diagnóstico con la IA.
    Crea la sesión en el ADK, el diagnóstico en la DB, y retorna las áreas disponibles.
    """
    try:
        from datetime import datetime
        from app.services.pregunta_service import PreguntaService
        
        user_id = f"user_{request.id_usuario}"
        
        # Calcular años de funcionamiento
        anio_actual = datetime.now().year
        anio_inicio = request.anio_inicio or anio_actual
        anos_funcionamiento = max(0, anio_actual - anio_inicio)
        
        diagnostico_service = DiagnosticoService()
        
        # --- CAPA 2: INTENTAR LIMPIAR SESIÓN HUÉRFANA PREVIA ---
        try:
            from app.services.supabase_client import get_supabase_client
            supabase = get_supabase_client()
            # Buscar diagnósticos incompletos de este usuario (abandono previo)
            res = supabase.table("diagnostico").select("id_diagnostico").eq("id_usuario", request.id_usuario).eq("resultado", "").execute()
            if res.data:
                for d in res.data:
                    old_id = d["id_diagnostico"]
                    await diagnostico_service.delete_diagnostico(old_id)
                    
                    old_session_id = f"session_{request.id_usuario}_{old_id}"
                    url_session = f"{IA_BASE_URL}/apps/{APP_NAME}/users/{user_id}/sessions/{old_session_id}"
                    async with httpx.AsyncClient() as client:
                        await client.delete(url_session, timeout=5.0)
        except Exception as e:
            print(f"[Limpieza Petición] Error al limpiar sesión previa: {e}")
        # --------------------------------------------------------
        
        # Crear diagnóstico en la DB
        diagnostico = await diagnostico_service.create_diagnostico(request.id_usuario)
        
        # Crear un session_id ÚNICO para evitar que la limpieza retrasada del beforeunload
        # elimine la sesión de un nuevo intento rápido.
        session_id = f"session_{request.id_usuario}_{diagnostico.id_diagnostico}"
        
        # Obtener áreas disponibles
        pregunta_service = PreguntaService()
        areas_db = await pregunta_service.get_all_areas()
        
        # Preparar estado inicial para la sesión ADK
        session_data = {
            "id_usuario": request.id_usuario,
            "id_diagnostico": diagnostico.id_diagnostico,
            # Variables en nivel superior (para template de instrucciones ADK)
            "nombre_emprendedor": request.nombre_usuario or "Emprendedor",
            "nombre_emprendimiento": request.nombre_emprendimiento or "No especificado",
            "rubro": request.rubro or "No especificado",
            "anos_funcionamiento": anos_funcionamiento,
            "numero_personal": request.numero_personal or 0,
            "ventas_mensuales_promedio": request.ventas_men_prom or 0.0,
            # Contexto anidado (para los tools)
            "contexto_emprendimiento": {
                "nombre_emprendedor": request.nombre_usuario or "Emprendedor",
                "nombre_emprendimiento": request.nombre_emprendimiento or "No especificado",
                "rubro": request.rubro or "No especificado",
                "anos_funcionamiento": anos_funcionamiento,
                "numero_personal": request.numero_personal or 0,
                "ventas_mensuales_promedio": request.ventas_men_prom or 0.0,
            },
        }
        
        # Crear sesión en el ADK
        url = f"{IA_BASE_URL}/apps/{APP_NAME}/users/{user_id}/sessions/{session_id}"
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=session_data, timeout=30.0)
            response.raise_for_status()
        
        return IniciarDiagnosticoIAResponse(
            session_id=session_id,
            user_id=user_id,
            id_diagnostico=diagnostico.id_diagnostico,
            areas=[
                AreaInfo(id_area=a.id_area, nombre_area=a.nombre_area)
                for a in areas_db
            ],
            mensaje_inicial=f"Sesión iniciada para {request.nombre_usuario}",
        )
    
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Error al conectar con la IA: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al iniciar diagnóstico: {str(e)}"
        )


@router.post("/ia/preguntas-area", response_model=PreguntasAreaResponse)
async def obtener_preguntas_area_ia(request: PreguntasAreaRequest):
    """
    Obtiene las preguntas de un área y las envía al ADK para reformulación batch.
    """
    try:
        from app.services.pregunta_service import PreguntaService
        
        # Obtener preguntas del área desde la DB
        pregunta_service = PreguntaService()
        preguntas_db = await pregunta_service.get_preguntas_by_area(request.id_area)
        
        nombre_area = preguntas_db[0].nombre_area if preguntas_db else "Desconocida"
        
        # Preparar JSON de preguntas para el ADK
        preguntas_json = [
            {
                "id_pregunta": p.id_pregunta,
                "area": p.nombre_area,
                "enunciado": p.enunciado,
            }
            for p in preguntas_db
        ]
        
        import json
        mensaje = f"REFORMULAR_PREGUNTAS:{json.dumps(preguntas_json, ensure_ascii=False)}"
        
        # Enviar al ADK
        respuesta = await _send_to_adk(request.user_id, request.session_id, mensaje)
        
        # Parsear respuesta JSON del agente
        try:
            # Limpiar posibles bloques markdown
            clean = respuesta.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[1] if "\n" in clean else clean
                clean = clean.rsplit("```", 1)[0]
            preguntas_reformuladas = json.loads(clean)
        except (json.JSONDecodeError, IndexError):
            # Si no puede parsear JSON, crear formato básico
            preguntas_reformuladas = [
                {
                    "id_pregunta": p.id_pregunta,
                    "area": p.nombre_area,
                    "intro": "",
                    "pregunta": p.enunciado,
                    "ejemplo": "",
                }
                for p in preguntas_db
            ]
        
        return PreguntasAreaResponse(
            id_area=request.id_area,
            nombre_area=nombre_area,
            preguntas=[
                PreguntaReformulada(
                    id_pregunta=pr.get("id_pregunta", 0),
                    area=pr.get("area", nombre_area),
                    intro=pr.get("intro", ""),
                    pregunta=pr.get("pregunta", ""),
                    ejemplo=pr.get("ejemplo", ""),
                )
                for pr in preguntas_reformuladas
            ],
        )
    
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Error al conectar con la IA: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener preguntas del área: {str(e)}"
        )


@router.post("/ia/preguntas-todas", response_model=PreguntasTodasResponse)
async def obtener_todas_preguntas_ia(request: PreguntasTodasRequest):
    """
    Obtiene TODAS las preguntas activas (estado = True) del diagnóstico y las envía al ADK para reformulación batch completa.
    """
    try:
        from app.services.pregunta_service import PreguntaService
        import json
        
        # Obtener todas las preguntas activas desde la DB
        pregunta_service = PreguntaService()
        preguntas_db = await pregunta_service.get_all_active_preguntas()
        
        # Preparar JSON de preguntas para el ADK
        preguntas_json = [
            {
                "id_pregunta": p.id_pregunta,
                "area": p.nombre_area,
                "enunciado": p.enunciado,
            }
            for p in preguntas_db
        ]
        
        mensaje = f"REFORMULAR_PREGUNTAS:{json.dumps(preguntas_json, ensure_ascii=False)}"
        
        # Enviar al ADK
        respuesta = await _send_to_adk(request.user_id, request.session_id, mensaje)
        
        # Parsear respuesta JSON del agente
        try:
            # Limpiar posibles bloques markdown
            clean = respuesta.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[1] if "\n" in clean else clean
                clean = clean.rsplit("```", 1)[0]
            preguntas_reformuladas = json.loads(clean)
        except (json.JSONDecodeError, IndexError):
            # Si no puede parsear JSON, crear formato básico
            preguntas_reformuladas = [
                {
                    "id_pregunta": p.id_pregunta,
                    "area": p.nombre_area,
                    "intro": "",
                    "pregunta": p.enunciado,
                    "ejemplo": "",
                }
                for p in preguntas_db
            ]
        
        # Crear un mapa de id_pregunta -> nombre_area para asegurar mapeo correcto en la respuesta
        pregunta_area_map = {p.id_pregunta: p.nombre_area for p in preguntas_db}
        
        return PreguntasTodasResponse(
            preguntas=[
                PreguntaReformulada(
                    id_pregunta=pr.get("id_pregunta", 0),
                    area=pregunta_area_map.get(pr.get("id_pregunta", 0), "Desconocida"),
                    intro=pr.get("intro", ""),
                    pregunta=pr.get("pregunta", ""),
                    ejemplo=pr.get("ejemplo", ""),
                )
                for pr in preguntas_reformuladas
            ],
        )
    
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Error al conectar con la IA: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener todas las preguntas reformuladas: {str(e)}"
        )


@router.post("/ia/evaluar-area", response_model=EvaluarAreaResponse)
async def evaluar_area_ia(request: EvaluarAreaRequest):
    """
    Envía todas las respuestas de un área al ADK para evaluación batch.
    Guarda detalles en la DB y acumula el puntaje del área en el estado de sesión.
    """
    try:
        from app.services.pregunta_service import PreguntaService
        import json
        
        # Mapeo id_area → columna de puntaje en la tabla diagnostico
        AREA_SCORE_COLUMN = {
            1: "puntaje_cf",
            2: "puntaje_gp",
            3: "puntaje_m",
            4: "puntaje_v",
            5: "puntaje_tp",
            6: "puntaje_rh",
            7: "puntaje_ec",
        }
        
        # Obtener preguntas originales del área
        pregunta_service = PreguntaService()
        preguntas_db = await pregunta_service.get_preguntas_by_area(request.id_area)
        preguntas_map = {p.id_pregunta: p for p in preguntas_db}
        nombre_area = preguntas_db[0].nombre_area if preguntas_db else "Desconocida"
        
        # Preparar datos para el ADK
        evaluacion_data = {
            "area": nombre_area,
            "id_area": request.id_area,
            "preguntas_respuestas": [
                {
                    "id_pregunta": r.id_pregunta,
                    "enunciado": preguntas_map.get(r.id_pregunta).enunciado if preguntas_map.get(r.id_pregunta) else "",
                    "respuesta": r.respuesta,
                }
                for r in request.respuestas
            ],
        }
        
        mensaje = f"EVALUAR_AREA:{json.dumps(evaluacion_data, ensure_ascii=False)}"
        respuesta = await _send_to_adk(request.user_id, request.session_id, mensaje)
        
        # Parsear respuesta JSON del agente
        try:
            clean = respuesta.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[1] if "\n" in clean else clean
                clean = clean.rsplit("```", 1)[0]
            eval_result = json.loads(clean)
        except (json.JSONDecodeError, IndexError):
            eval_result = {
                "scores": [
                    {"id_pregunta": r.id_pregunta, "score": 50, "reason": "Evaluación automática"}
                    for r in request.respuestas
                ],
                "inconsistencias": [],
            }
        
        scores_list = eval_result.get("scores", [])
        inconsistencias = eval_result.get("inconsistencias", [])
        
        # Calcular promedio del área
        total_scores = [s.get("score", 0) for s in scores_list]
        area_promedio = round(sum(total_scores) / len(total_scores)) if total_scores else 0
        
        # Obtener sesión ADK para leer estado actual
        async with httpx.AsyncClient() as client:
            session_url = f"{IA_BASE_URL}/apps/{APP_NAME}/users/{request.user_id}/sessions/{request.session_id}"
            session_resp = await client.get(session_url, timeout=10.0)
            session_data = session_resp.json()
        
        estado = session_data.get("state", {})
        id_diagnostico = estado.get("id_diagnostico")
        
        # Acumular puntajes por área en el estado de sesión
        col = AREA_SCORE_COLUMN.get(request.id_area)
        area_scores = estado.get("area_scores", {})
        if col:
            area_scores[col] = area_promedio
        
        # Acumular inconsistencias
        inconsistencias_acum = estado.get("todas_inconsistencias", [])
        inconsistencias_acum.extend(inconsistencias)
        
        # Guardar nuevo estado en la sesión ADK (Google ADK requiere el campo 'state_delta')
        nuevo_estado = {"area_scores": area_scores, "todas_inconsistencias": inconsistencias_acum}
        try:
            async with httpx.AsyncClient() as client:
                await client.patch(
                    session_url,
                    json={"state_delta": nuevo_estado},
                    timeout=10.0
                )
        except Exception as e_patch:
            print(f"[WARN] Error al actualizar estado de sesión en ADK: {e_patch}")
        
        # Guardar detalles en la DB (Bulk Insert en un solo request HTTP)
        if id_diagnostico and request.respuestas:
            diagnostico_service = DiagnosticoService()
            scores_map = {s.get("id_pregunta"): s for s in scores_list}
            detalles_batch = [
                {
                    "id_diagnostico": id_diagnostico,
                    "id_pregunta": r.id_pregunta,
                    "respuesta_usuario": r.respuesta,
                    "puntaje": float(scores_map.get(r.id_pregunta, {}).get("score", 50)),
                }
                for r in request.respuestas
            ]
            
            try:
                await diagnostico_service.create_detalles_batch(detalles_batch)
            except Exception as batch_err:
                print(f"[WARN] Error en bulk insert ({batch_err}), reintentando individualmente...")
                for d in detalles_batch:
                    try:
                        await diagnostico_service.create_detalle_diagnostico(
                            id_diagnostico=d["id_diagnostico"],
                            id_pregunta=d["id_pregunta"],
                            respuesta_usuario=d["respuesta_usuario"],
                            puntaje=d["puntaje"],
                        )
                    except Exception as db_err:
                        print(f"[DB ERROR] Error al guardar detalle individual: {db_err}")
        
        return EvaluarAreaResponse(
            scores=[
                ScorePregunta(
                    id_pregunta=s.get("id_pregunta", 0),
                    score=s.get("score", 0),
                    reason=s.get("reason", ""),
                )
                for s in scores_list
            ],
            area_promedio=area_promedio,
            inconsistencias=inconsistencias,
        )
    
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Error al conectar con la IA: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al evaluar área: {str(e)}"
        )


@router.post("/ia/resultados", response_model=ResultadosResponse)
async def obtener_resultados_ia(request: ResultadosRequest):
    """
    Genera conclusión, recomendaciones y guarda TODOS los resultados finales en la DB.
    Los puntajes por área vienen directamente en el request (acumulados por el frontend).
    """
    try:
        import json
        from decimal import Decimal

        # Mapeo id_area → columna de puntaje
        AREA_SCORE_COLUMN = {
            1: "puntaje_cf",
            2: "puntaje_gp",
            3: "puntaje_m",
            4: "puntaje_v",
            5: "puntaje_tp",
            6: "puntaje_rh",
            7: "puntaje_ec",
        }

        # 1. Construir dict {puntaje_cf: 72.5, ...} desde la lista del request
        area_scores_db = {}
        for entry in request.area_scores:
            id_area = entry.get("id_area")
            promedio = entry.get("area_promedio", 0)
            col = AREA_SCORE_COLUMN.get(id_area)
            if col:
                area_scores_db[col] = float(promedio)

        # 2. Calcular puntaje total según Rúbrica IMESUN (OIT)
        score_values = list(area_scores_db.values())
        puntaje_total = round(sum(score_values) / len(score_values)) if score_values else 0
        
        if puntaje_total <= 20:
            resultado_final = "OBSERVADO"
        elif puntaje_total <= 80:
            resultado_final = "APROBADO"
        else:
            resultado_final = "EXIMIDO"
            
        id_diagnostico = None
        todas_inconsistencias = []
        contexto_emp = {}
        try:
            async with httpx.AsyncClient() as client:
                session_url = f"{IA_BASE_URL}/apps/{APP_NAME}/users/{request.user_id}/sessions/{request.session_id}"
                session_resp = await client.get(session_url, timeout=10.0)
                session_data = session_resp.json()
            estado = session_data.get("state", {})
            id_diagnostico = estado.get("id_diagnostico")
            todas_inconsistencias = estado.get("todas_inconsistencias", [])
            contexto_emp = estado.get("contexto_emprendimiento", {})
        except Exception as e:
            print(f"[WARN] No se pudo leer sesión ADK: {e}")

        # 3. Recopilar todas las respuestas completas para la Auditoría Global de Inconsistencias
        respuestas_completas = []
        if id_diagnostico:
            try:
                from app.services.supabase_client import get_supabase_client
                from app.services.pregunta_service import PreguntaService
                supabase = get_supabase_client()
                detalles_resp = (
                    supabase.table("detalle_diagnostico")
                    .select("id_pregunta, respuesta_usuario, puntaje")
                    .eq("id_diagnostico", id_diagnostico)
                    .execute()
                )
                pregunta_service = PreguntaService()
                preguntas_db = await pregunta_service.get_all_active_preguntas()
                preg_map = {p.id_pregunta: p for p in preguntas_db}

                for d in (detalles_resp.data or []):
                    p_info = preg_map.get(d["id_pregunta"])
                    respuestas_completas.append({
                        "id_pregunta": d["id_pregunta"],
                        "area": p_info.nombre_area if p_info else "Desconocida",
                        "enunciado": p_info.enunciado if p_info else "",
                        "respuesta": d.get("respuesta_usuario", ""),
                        "puntaje": d.get("puntaje", 0),
                    })
            except Exception as e_resp:
                print(f"[WARN] No se pudieron compilar respuestas completas para auditoría: {e_resp}")

        # 4. Generar conclusión + recomendaciones + auditoría de inconsistencias via ADK
        contexto_resultados = json.dumps({
            "area_scores": area_scores_db,
            "puntaje_total": puntaje_total,
            "resultado": resultado_final,
            "contexto": contexto_emp,
            "inconsistencias_previas": todas_inconsistencias,
            "respuestas_completas": respuestas_completas,
        }, ensure_ascii=False)
        mensaje = f"GENERAR_RESULTADOS:{contexto_resultados}"
        respuesta = await _send_to_adk(request.user_id, request.session_id, mensaje, timeout=120.0)

        # 5. Parsear respuesta del ADK
        conclusion = ""
        recomendaciones = ""
        inconsistencias_auditadas = []
        mensaje_despedida = "Gracias por completar el diagnóstico. Un mentor se comunicará contigo a la brevedad para revisar tus resultados. ¡Mucho ánimo!"
        try:
            clean = respuesta.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[1] if "\n" in clean else clean
                clean = clean.rsplit("```", 1)[0]
            resultado_json = json.loads(clean)
            conclusion = resultado_json.get("conclusion", "")
            recomendaciones = resultado_json.get("recomendaciones", "")
            inconsistencias_auditadas = resultado_json.get("inconsistencias", [])
            mensaje_despedida = resultado_json.get(
                "mensaje_despedida",
                mensaje_despedida
            )
        except (json.JSONDecodeError, IndexError):
            conclusion = respuesta
        
        # 6. Formatear inconsistencias detectadas en Markdown estructurado
        bloques_inconsistencias = []
        if isinstance(inconsistencias_auditadas, list):
            for i, inc in enumerate(inconsistencias_auditadas, 1):
                if isinstance(inc, dict):
                    tipo = inc.get("tipo", "Observación")
                    desc = inc.get("descripcion", "")
                    evid = inc.get("evidencia", "")
                    bloques_inconsistencias.append(
                        f"### ⚠️ Observación {i} ({tipo}): {desc}\n\n"
                        f"* **Contraste detectado:** {evid}\n"
                        f"* **Recomendación para el mentor:** Indagar este punto en la entrevista para contrastar la información."
                    )
                elif isinstance(inc, str) and inc.strip():
                    bloques_inconsistencias.append(f"### ⚠️ Observación {i}\n\n* **Detalle:** {inc.strip()}")

        # Si no hubo en la auditoría final pero sí en las áreas previas
        if not bloques_inconsistencias and todas_inconsistencias:
            for i, inc in enumerate(todas_inconsistencias, 1):
                if isinstance(inc, str) and inc.strip():
                    bloques_inconsistencias.append(f"### ⚠️ Observación {i}\n\n* **Detalle:** {inc.strip()}")

        inconsistencias_texto = (
            "> **Auditoría de Coherencia:** No se detectaron inconsistencias significativas ni contradicciones entre las respuestas del emprendedor y los datos financieros iniciales declarados."
            if not bloques_inconsistencias
            else "\n\n---\n\n".join(bloques_inconsistencias)
        )

        # 7. Guardar TODOS los resultados en la DB
        if id_diagnostico:
            diagnostico_service = DiagnosticoService()
            from app.models.diagnostico import DiagnosticoUpdate
            
            update_data = DiagnosticoUpdate(
                puntaje_total=Decimal(str(puntaje_total)),
                conclusion=conclusion,
                resultado=resultado_final,
                puntaje_cf=Decimal(str(area_scores_db.get("puntaje_cf", 0))),
                puntaje_gp=Decimal(str(area_scores_db.get("puntaje_gp", 0))),
                puntaje_m=Decimal(str(area_scores_db.get("puntaje_m", 0))),
                puntaje_v=Decimal(str(area_scores_db.get("puntaje_v", 0))),
                puntaje_tp=Decimal(str(area_scores_db.get("puntaje_tp", 0))),
                puntaje_rh=Decimal(str(area_scores_db.get("puntaje_rh", 0))),
                puntaje_ec=Decimal(str(area_scores_db.get("puntaje_ec", 0))),
                recomendaciones=recomendaciones,
                inconsistencias=inconsistencias_texto,
            )
            
            try:
                await diagnostico_service.update_diagnostico(id_diagnostico, update_data)
                print(f"[OK] Diagnóstico {id_diagnostico} actualizado. Total: {puntaje_total}, Scores: {area_scores_db}")
                
                # Deshabilitar diagnóstico para el usuario
                id_usuario = request.user_id.replace("user_", "", 1)
                from app.services.supabase_client import get_supabase_client
                supabase = get_supabase_client()
                supabase.table("usuario").update({"habilitado_diag": False}).eq("id_usuario", id_usuario).execute()
                print(f"[OK] Usuario {id_usuario} deshabilitado para nuevos diagnósticos.")
                
            except Exception as e:
                print(f"[ERROR] update_diagnostico/usuario falló: {e}")
        

        return ResultadosResponse(
            mensaje_despedida=mensaje_despedida,
            puntaje_total=puntaje_total,
        )
    
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Error al conectar con la IA: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener resultados: {str(e)}"
        )


@router.post("/ia/chat", response_model=ChatIAResponse)
async def chat_diagnostico_ia(request: ChatIARequest):
    """
    Envía un mensaje a la IA y obtiene la respuesta (endpoint legacy)
    """
    try:
        respuesta = await _send_to_adk(request.user_id, request.session_id, request.mensaje)
        return ChatIAResponse(
            respuesta=respuesta if respuesta else "Sin respuesta"
        )
    
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Error al conectar con la IA: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en chat: {str(e)}"
        )


@router.delete("/ia/finalizar/{session_id}/{user_id}")
async def finalizar_diagnostico_ia(session_id: str, user_id: str):
    """
    Finaliza la sesión de diagnóstico con la IA (Llamado al presionar Volver).
    Si el diagnóstico no se completó, borra la sesión ADK y elimina el registro inútil de DB.
    NO modifica el habilitado_diag del usuario.
    """
    try:
        url = f"{IA_BASE_URL}/apps/{APP_NAME}/users/{user_id}/sessions/{session_id}"
        
        # Obtener el ID del diagnóstico antes de borrar la sesión
        async with httpx.AsyncClient() as client:
            session_resp = await client.get(url, timeout=10.0)
            if session_resp.status_code == 200:
                session_data = session_resp.json()
                estado = session_data.get("state", {})
                id_diagnostico = estado.get("id_diagnostico")
                
                # Borrar la sesión ADK
                await client.delete(url, timeout=30.0)
                
                # Borrar en BBDD si es un diagnóstico en proceso (NO finalizado)
                if id_diagnostico:
                    from app.services.supabase_client import get_supabase_client
                    supabase = get_supabase_client()
                    res = supabase.table("diagnostico").select("resultado").eq("id_diagnostico", id_diagnostico).execute()
                    # Solo lo borramos si el 'resultado' es vacío (es decir, no ha terminado)
                    if res.data and not res.data[0].get("resultado"):
                        from app.services.diagnostico_service import DiagnosticoService
                        ds = DiagnosticoService()
                        await ds.delete_diagnostico(id_diagnostico)
        
        # Ya NO deshabilitamos el acceso aquí para permitir que vuelva a entrar, 
        # a menos que haya finalizado, en cuyo caso `/ia/resultados` ya lo hizo.
        
        return {"message": "Sesión finalizada y limpiada correctamente"}
    
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Error al conectar con la IA: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al finalizar sesión: {str(e)}"
        )

@router.post("/ia/limpiar-abandono/{session_id}/{user_id}")
async def limpiar_abandono_ia(session_id: str, user_id: str):
    """
    Capa 1 (Frontend beforeunload): Limpia una sesión abandonada cerrando pestaña.
    Borra ADK + Borra Diagnóstico DB de forma física.
    """
    try:
        url = f"{IA_BASE_URL}/apps/{APP_NAME}/users/{user_id}/sessions/{session_id}"
        
        async with httpx.AsyncClient() as client:
            session_resp = await client.get(url, timeout=5.0)
            if session_resp.status_code == 200:
                session_data = session_resp.json()
                estado = session_data.get("state", {})
                id_diagnostico = estado.get("id_diagnostico")
                
                # Borrar la sesión ADK
                await client.delete(url, timeout=5.0)
                
                # Borrar físicamente de DB SOLO si es un abandono en proceso
                if id_diagnostico:
                    from app.services.supabase_client import get_supabase_client
                    supabase = get_supabase_client()
                    res = supabase.table("diagnostico").select("resultado").eq("id_diagnostico", id_diagnostico).execute()
                    if res.data and not res.data[0].get("resultado"):
                        from app.services.diagnostico_service import DiagnosticoService
                        ds = DiagnosticoService()
                        await ds.delete_diagnostico(id_diagnostico)
                    
        return {"message": "Limpieza on-close completada"}
    except Exception as e:
        # Silenciamos el error para no colgar el shutdown de la ventana
        print(f"[BeforeUnload] Fallo al limpiar {session_id}: {e}")
        return {"message": "Error ignorado"}

