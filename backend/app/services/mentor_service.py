"""
Servicio para gestionar operaciones del Mentor
"""
from app.services.supabase_client import get_supabase_client
from app.models.mentor import (
    MentorDashboardResponse, 
    AreaPromedios,
    EmprendedorAsignado,
    DiagnosticoResumen,
    ConversacionDiagnostico,
    AreaConversacion,
    AreaDetalle,
    PreguntaRespuesta,
    UpdateCalificacionResponse
)
from fastapi import HTTPException
from typing import List


class MentorService:
    def __init__(self):
        self.supabase = get_supabase_client()

    async def get_dashboard_stats(self, id_mentor: str) -> MentorDashboardResponse:
        """
        Obtiene estadísticas del dashboard para un mentor específico
        """
        try:
            # 1. Obtener todos los emprendedores asignados al mentor
            asignaciones_response = self.supabase.table("asignacion_mentor") \
                .select("id_emprendedor") \
                .eq("id_mentor", id_mentor) \
                .execute()
            
            emprendedores_ids = [asig["id_emprendedor"] for asig in asignaciones_response.data]
            total_emprendedores = len(emprendedores_ids)
            
            if total_emprendedores == 0:
                # Si no hay emprendedores asignados, retornar valores por defecto
                return MentorDashboardResponse(
                    total_emprendedores=0,
                    tasa_exito=0.0,
                    promedio_general=0.0,
                    emprendedores_habilitados=0,
                    promedios_por_area=AreaPromedios(
                        cf=0.0, gp=0.0, m=0.0, v=0.0, tp=0.0, rh=0.0, ec=0.0
                    )
                )
            
            # 2. Contar emprendedores habilitados para diagnóstico
            usuarios_response = self.supabase.table("usuario") \
                .select("habilitado_diag") \
                .in_("id_usuario", emprendedores_ids) \
                .execute()
            
            emprendedores_habilitados = sum(
                1 for u in usuarios_response.data if u.get("habilitado_diag", False)
            )
            
            # 3. Obtener diagnósticos de los emprendedores
            diagnosticos_response = self.supabase.table("diagnostico") \
                .select("id_usuario, fecha_inicio, resultado, puntaje_total, puntaje_cf, puntaje_gp, puntaje_m, puntaje_v, puntaje_tp, puntaje_rh, puntaje_ec") \
                .in_("id_usuario", emprendedores_ids) \
                .not_.is_("resultado", "null") \
                .execute()
            
            diagnosticos_data = diagnosticos_response.data
            
            # Agrupar por id_usuario y mantener solo el más reciente
            ultimos_diagnosticos_map = {}
            for diag in diagnosticos_data:
                user_id = diag.get("id_usuario")
                if not user_id: 
                    continue
                if user_id not in ultimos_diagnosticos_map:
                    ultimos_diagnosticos_map[user_id] = diag
                else:
                    fecha_actual = diag.get("fecha_inicio")
                    fecha_guardada = ultimos_diagnosticos_map[user_id].get("fecha_inicio")
                    if fecha_actual and fecha_guardada and str(fecha_actual) > str(fecha_guardada):
                        ultimos_diagnosticos_map[user_id] = diag
                        
            diagnosticos = list(ultimos_diagnosticos_map.values())
            total_diagnosticos = len(diagnosticos)
            
            # 4. Calcular tasa de éxito
            diagnosticos_valido = [d for d in diagnosticos if d.get("resultado") in ("ACEPTADO", "APROBADO", "EXIMIDO", "RECHAZADO", "OBSERVADO")]
            total_validos = len(diagnosticos_valido)
            if total_validos > 0:
                aceptados = sum(1 for d in diagnosticos_valido if d["resultado"] in ("ACEPTADO", "APROBADO", "EXIMIDO"))
                tasa_exito = (aceptados / total_validos) * 100
            else:
                tasa_exito = 0.0
            
            # 5. Calcular promedio general
            if total_diagnosticos > 0:
                suma_puntajes = sum(float(d["puntaje_total"] or 0) for d in diagnosticos)
                promedio_general = suma_puntajes / total_diagnosticos
            else:
                promedio_general = 0.0
            
            # 6. Calcular promedios por área
            if total_diagnosticos > 0:
                suma_cf = sum(float(d["puntaje_cf"] or 0) for d in diagnosticos)
                suma_gp = sum(float(d["puntaje_gp"] or 0) for d in diagnosticos)
                suma_m = sum(float(d["puntaje_m"] or 0) for d in diagnosticos)
                suma_v = sum(float(d["puntaje_v"] or 0) for d in diagnosticos)
                suma_tp = sum(float(d["puntaje_tp"] or 0) for d in diagnosticos)
                suma_rh = sum(float(d["puntaje_rh"] or 0) for d in diagnosticos)
                suma_ec = sum(float(d["puntaje_ec"] or 0) for d in diagnosticos)
                
                promedios_por_area = AreaPromedios(
                    cf=round(suma_cf / total_diagnosticos, 1),
                    gp=round(suma_gp / total_diagnosticos, 1),
                    m=round(suma_m / total_diagnosticos, 1),
                    v=round(suma_v / total_diagnosticos, 1),
                    tp=round(suma_tp / total_diagnosticos, 1),
                    rh=round(suma_rh / total_diagnosticos, 1),
                    ec=round(suma_ec / total_diagnosticos, 1)
                )
            else:
                promedios_por_area = AreaPromedios(
                    cf=0.0, gp=0.0, m=0.0, v=0.0, tp=0.0, rh=0.0, ec=0.0
                )
            
            return MentorDashboardResponse(
                total_emprendedores=total_emprendedores,
                tasa_exito=round(tasa_exito, 1),
                promedio_general=round(promedio_general, 1),
                emprendedores_habilitados=emprendedores_habilitados,
                promedios_por_area=promedios_por_area
            )
            
        except Exception as e:
            print(f"Error al obtener estadísticas del mentor: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error al obtener estadísticas del dashboard: {str(e)}"
            )

    # ==================== MÉTODOS PARA RESULTADOS DE DIAGNÓSTICO ====================

    async def get_emprendedores_asignados(self, id_mentor: str) -> List[EmprendedorAsignado]:
        """
        Obtiene la lista de emprendedores asignados a un mentor
        Ordenado alfabéticamente por nombre y apellido
        """
        try:
            # Obtener emprendedores asignados
            asignaciones_response = self.supabase.table("asignacion_mentor") \
                .select("id_emprendedor") \
                .eq("id_mentor", id_mentor) \
                .execute()
            
            emprendedores_ids = [asig["id_emprendedor"] for asig in asignaciones_response.data]
            
            if not emprendedores_ids:
                return []
            
            # Obtener datos de los emprendedores
            usuarios_response = self.supabase.table("usuario") \
                .select("id_usuario, nombre, apellido, habilitado_diag, celular") \
                .in_("id_usuario", emprendedores_ids) \
                .execute()
            
            # Obtener datos de los emprendimientos
            emprendimientos_response = self.supabase.table("emprendimiento") \
                .select("id_usuario, nombre, rubro") \
                .in_("id_usuario", emprendedores_ids) \
                .execute()
            
            emprendimientos_map = {
                emp["id_usuario"]: emp
                for emp in emprendimientos_response.data
            }
            
            emprendedores_list = []
            for u in usuarios_response.data:
                emp_data = emprendimientos_map.get(u["id_usuario"], {})
                u["nombre_emprendimiento"] = emp_data.get("nombre")
                u["rubro_emprendimiento"] = emp_data.get("rubro")
                emprendedores_list.append(u)
            
            # Ordenar alfabéticamente
            emprendedores = sorted(
                emprendedores_list,
                key=lambda x: f"{x['nombre']} {x['apellido']}"
            )
            
            return [EmprendedorAsignado(**emp) for emp in emprendedores]
            
        except Exception as e:
            print(f"Error al obtener emprendedores asignados: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error al obtener emprendedores: {str(e)}"
            )

    async def get_diagnosticos_emprendedor(self, id_emprendedor: str) -> List[DiagnosticoResumen]:
        """
        Obtiene la lista de diagnósticos de un emprendedor
        Ordenados por fecha (más recientes primero) y numerados
        """
        try:
            diagnosticos_response = self.supabase.table("diagnostico") \
                .select("id_diagnostico, fecha_inicio, resultado, puntaje_total, puntaje_cf, puntaje_gp, puntaje_m, puntaje_v, puntaje_tp, puntaje_rh, puntaje_ec") \
                .eq("id_usuario", id_emprendedor) \
                .not_.is_("resultado", "null") \
                .order("fecha_inicio", desc=True) \
                .execute()
            
            diagnosticos = diagnosticos_response.data
            
            # Numerar los diagnósticos (1 = más antiguo, N = más reciente)
            total = len(diagnosticos)
            for idx, diag in enumerate(diagnosticos):
                diag["numero"] = total - idx
            
            return [DiagnosticoResumen(**diag) for diag in diagnosticos]
            
        except Exception as e:
            print(f"Error al obtener diagnósticos del emprendedor: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error al obtener diagnósticos: {str(e)}"
            )

    async def get_conversacion_diagnostico(self, id_diagnostico: int) -> ConversacionDiagnostico:
        """
        Obtiene la conversación completa de un diagnóstico
        Incluye preguntas y respuestas ordenadas por área
        """
        try:
            # 1. Obtener datos del diagnóstico
            diagnostico_response = self.supabase.table("diagnostico") \
                .select("id_diagnostico, fecha_inicio, resultado, puntaje_total, puntaje_cf, puntaje_gp, puntaje_m, puntaje_v, puntaje_tp, puntaje_rh, puntaje_ec, conclusion, recomendaciones, inconsistencias") \
                .eq("id_diagnostico", id_diagnostico) \
                .execute()
            
            if not diagnostico_response.data:
                raise HTTPException(status_code=404, detail="Diagnóstico no encontrado")
            
            diag = diagnostico_response.data[0]
            
            # 2. Obtener detalles del diagnóstico (respuestas)
            detalles_response = self.supabase.table("detalle_diagnostico") \
                .select("id_detalle, id_pregunta, respuesta_usuario, puntaje") \
                .eq("id_diagnostico", id_diagnostico) \
                .execute()
            
            # 3. Obtener preguntas con su área
            preguntas_response = self.supabase.table("pregunta") \
                .select("id_pregunta, id_area, enunciado") \
                .execute()
            
            # Crear mapeo de preguntas
            preguntas_map = {p["id_pregunta"]: p for p in preguntas_response.data}
            
            # 4. Organizar por área
            areas_dict = {}
            for detalle in detalles_response.data:
                id_pregunta = detalle["id_pregunta"]
                if id_pregunta in preguntas_map:
                    pregunta_data = preguntas_map[id_pregunta]
                    id_area = pregunta_data["id_area"]
                    
                    if id_area not in areas_dict:
                        areas_dict[id_area] = []
                    
                    areas_dict[id_area].append(PreguntaRespuesta(
                        id_detalle=detalle["id_detalle"],
                        id_pregunta=id_pregunta,
                        pregunta=pregunta_data["enunciado"],
                        respuesta=detalle["respuesta_usuario"],
                        puntaje=float(detalle.get("puntaje", 0))
                    ))
            
            # 5. Nombres de áreas
            area_nombres = {
                1: "Costos y Finanzas",
                2: "Gestión de Procesos",
                3: "Marketing",
                4: "Ventas",
                5: "Tecnologías y Producción",
                6: "Recursos Humanos",
                7: "Economía del Cuidado"
            }
            
            # 6. Crear lista de áreas con conversación
            conversacion = []
            for id_area in sorted(areas_dict.keys()):
                conversacion.append(AreaConversacion(
                    id_area=id_area,
                    area_nombre=area_nombres.get(id_area, f"Área {id_area}"),
                    preguntas=areas_dict[id_area]
                ))
            
            # 7. Crear diccion ario de áreas con puntajes
            areas = {
                "cf": AreaDetalle(nombre="Costos y Finanzas", puntaje=diag["puntaje_cf"] or 0),
                "gp": AreaDetalle(nombre="Gestión de Procesos", puntaje=diag["puntaje_gp"] or 0),
                "m": AreaDetalle(nombre="Marketing", puntaje=diag["puntaje_m"] or 0),
                "v": AreaDetalle(nombre="Ventas", puntaje=diag["puntaje_v"] or 0),
                "tp": AreaDetalle(nombre="Tecnologías y Producción", puntaje=diag["puntaje_tp"] or 0),
                "rh": AreaDetalle(nombre="Recursos Humanos", puntaje=diag["puntaje_rh"] or 0),
                "ec": AreaDetalle(nombre="Economía del Cuidado", puntaje=diag["puntaje_ec"] or 0)
            }
            
            return ConversacionDiagnostico(
                id_diagnostico=diag["id_diagnostico"],
                fecha=diag["fecha_inicio"],
                resultado=diag["resultado"],
                puntaje_total=diag["puntaje_total"] or 0,
                conclusion=diag.get("conclusion"),
                recomendaciones=diag.get("recomendaciones"),
                inconsistencias=diag.get("inconsistencias"),
                areas=areas,
                conversacion=conversacion
            )
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error al obtener conversación del diagnóstico: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error al obtener conversación: {str(e)}"
            )

    async def toggle_habilitado_diag(self, user_id: str, habilitado: bool) -> dict:
        """
        Activa o desactiva el acceso al diagnóstico para un emprendedor
        """
        try:
            response = self.supabase.table("usuario") \
                .update({"habilitado_diag": habilitado}) \
                .eq("id_usuario", user_id) \
                .execute()
            
            if not response.data:
                raise HTTPException(
                    status_code=404,
                    detail="Usuario no encontrado"
                )
            
            return {"habilitado_diag": habilitado, "message": "Estado actualizado correctamente"}
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error al actualizar habilitado_diag: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error al actualizar habilitado_diag: {str(e)}"
            )


    # ==================== MÉTODO PARA EDICIÓN DE CALIFICACIONES ====================

    # Mapeo id_area → clave corta del área
    AREA_ID_TO_KEY = {
        1: "cf",
        2: "gp",
        3: "m",
        4: "v",
        5: "tp",
        6: "rh",
        7: "ec",
    }

    # Mapeo clave corta → columna en tabla diagnostico
    AREA_KEY_TO_COLUMN = {
        "cf": "puntaje_cf",
        "gp": "puntaje_gp",
        "m": "puntaje_m",
        "v": "puntaje_v",
        "tp": "puntaje_tp",
        "rh": "puntaje_rh",
        "ec": "puntaje_ec",
    }

    async def update_calificacion_respuesta(
        self, id_detalle: int, nuevo_puntaje: float
    ) -> UpdateCalificacionResponse:
        """
        Actualiza la calificación de una respuesta individual y recalcula
        el puntaje del área, puntaje total y resultado del diagnóstico.
        """
        try:
            # 1. Validar rango
            if nuevo_puntaje < 0 or nuevo_puntaje > 100:
                raise HTTPException(
                    status_code=400,
                    detail="El puntaje debe estar entre 0 y 100"
                )

            # 2. Actualizar el puntaje del detalle
            update_resp = self.supabase.table("detalle_diagnostico") \
                .update({"puntaje": nuevo_puntaje}) \
                .eq("id_detalle", id_detalle) \
                .execute()

            if not update_resp.data:
                raise HTTPException(status_code=404, detail="Detalle no encontrado")

            detalle = update_resp.data[0]
            id_diagnostico = detalle["id_diagnostico"]
            id_pregunta = detalle["id_pregunta"]

            # 3. Obtener id_area de la pregunta
            pregunta_resp = self.supabase.table("pregunta") \
                .select("id_area") \
                .eq("id_pregunta", id_pregunta) \
                .execute()

            if not pregunta_resp.data:
                raise HTTPException(status_code=404, detail="Pregunta no encontrada")

            id_area = pregunta_resp.data[0]["id_area"]
            area_key = self.AREA_ID_TO_KEY.get(id_area, "cf")
            area_column = self.AREA_KEY_TO_COLUMN.get(area_key, "puntaje_cf")

            # 4. Obtener TODAS las preguntas de esta área
            preguntas_area_resp = self.supabase.table("pregunta") \
                .select("id_pregunta") \
                .eq("id_area", id_area) \
                .execute()

            ids_preguntas_area = [p["id_pregunta"] for p in preguntas_area_resp.data]

            # 5. Obtener todos los detalles del diagnóstico que pertenecen a esta área
            detalles_area_resp = self.supabase.table("detalle_diagnostico") \
                .select("puntaje") \
                .eq("id_diagnostico", id_diagnostico) \
                .in_("id_pregunta", ids_preguntas_area) \
                .execute()

            # 6. Recalcular promedio del área
            puntajes = [float(d["puntaje"]) for d in detalles_area_resp.data]
            puntaje_area = round(sum(puntajes) / len(puntajes)) if puntajes else 0

            # 7. Actualizar la columna del área en diagnostico
            self.supabase.table("diagnostico") \
                .update({area_column: puntaje_area}) \
                .eq("id_diagnostico", id_diagnostico) \
                .execute()

            # 8. Leer todos los puntajes de área del diagnóstico para recalcular total
            diag_resp = self.supabase.table("diagnostico") \
                .select("puntaje_cf, puntaje_gp, puntaje_m, puntaje_v, puntaje_tp, puntaje_rh, puntaje_ec") \
                .eq("id_diagnostico", id_diagnostico) \
                .execute()

            diag = diag_resp.data[0]
            all_area_scores = [
                float(diag["puntaje_cf"] or 0),
                float(diag["puntaje_gp"] or 0),
                float(diag["puntaje_m"] or 0),
                float(diag["puntaje_v"] or 0),
                float(diag["puntaje_tp"] or 0),
                float(diag["puntaje_rh"] or 0),
                float(diag["puntaje_ec"] or 0),
            ]
            puntaje_total = round(sum(all_area_scores) / len(all_area_scores))

            # 9. Determinar resultado según Rúbrica IMESUN (OIT)
            if puntaje_total <= 20:
                resultado = "OBSERVADO"
            elif puntaje_total <= 80:
                resultado = "APROBADO"
            else:
                resultado = "EXIMIDO"

            # 10. Actualizar puntaje_total y resultado en diagnostico
            self.supabase.table("diagnostico") \
                .update({"puntaje_total": puntaje_total, "resultado": resultado}) \
                .eq("id_diagnostico", id_diagnostico) \
                .execute()

            return UpdateCalificacionResponse(
                puntaje_area=puntaje_area,
                area_key=area_key,
                puntaje_total=puntaje_total,
                resultado=resultado
            )

        except HTTPException:
            raise
        except Exception as e:
            print(f"Error al actualizar calificación: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error al actualizar calificación: {str(e)}"
            )


mentor_service = MentorService()
