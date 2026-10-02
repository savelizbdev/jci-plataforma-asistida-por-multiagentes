"""
Servicio de Generación de Reportes
Maneja la creación de reportes PDF con gráficos
"""
import io
import os
import re
import tempfile
from datetime import datetime
from typing import List, Optional
from fastapi import HTTPException, status

# PDF generation
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfgen import canvas

# Chart generation
import matplotlib
matplotlib.use('Agg')  # Backend sin GUI
import matplotlib.pyplot as plt
import numpy as np

from app.services.supabase_client import get_supabase_client
from app.models.reporte import (
    ReporteRequest,
    ReporteAdminRequest,
    ReporteData,
    EmprendedorReporte,
    EstadisticasGlobales,
    DiagnosticoPorFecha,
    ReporteEmprendedorRequest,
    ReporteDataEmprendedor,
    SeccionItem,
    RecomendacionItem,
    ReporteDataMentor,
    MentorResumenReporte,
    ReporteDataTodosMentores,
)


class ReporteService:
    """Servicio para generar reportes PDF"""
    
    def __init__(self):
        self.supabase = get_supabase_client()
    
    async def get_reporte_data(self, request: ReporteRequest) -> ReporteData:
        """
        Obtiene todos los datos necesarios para generar el reporte de Mentor
        filtrado por programa y asignación (Spec 003).
        """
        try:
            nombre_programa = "Consolidado - Todos los usuarios asignados"
            if request.id_programa:
                try:
                    p_res = self.supabase.table("programa").select("nombre").eq("id_programa", request.id_programa).execute()
                    if isinstance(p_res.data, list) and len(p_res.data) > 0 and isinstance(p_res.data[0], dict) and p_res.data[0].get("nombre"):
                        nombre_programa = str(p_res.data[0]["nombre"])
                    else:
                        nombre_programa = f"Programa {request.id_programa}"
                except Exception:
                    nombre_programa = f"Programa {request.id_programa}"

            # 1. Obtener información del mentor
            mentor_response = self.supabase.table("usuario") \
                .select("nombre, apellido") \
                .eq("id_usuario", request.id_mentor) \
                .execute()
            
            mentor = mentor_response.data[0] if (mentor_response.data and len(mentor_response.data) > 0) else {"nombre": "Mentor", "apellido": ""}
            
            # 2. Obtener emprendedores asignados al mentor
            asignaciones_response = self.supabase.table("asignacion_mentor") \
                .select("id_emprendedor") \
                .eq("id_mentor", request.id_mentor) \
                .execute()
            
            asig_ids = [asig["id_emprendedor"] for asig in (asignaciones_response.data or [])]
            if not asig_ids:
                return ReporteData(
                    mentor_nombre=mentor.get("nombre", "Mentor"),
                    mentor_apellido=mentor.get("apellido", ""),
                    fecha_inicio=request.fecha_inicio,
                    fecha_fin=request.fecha_fin,
                    nombre_programa=nombre_programa,
                    emprendedores=[],
                    estadisticas=EstadisticasGlobales(
                        total_emprendedores=0, tasa_aprobado=0.0, promedio_cf=0.0,
                        promedio_gp=0.0, promedio_m=0.0, promedio_v=0.0,
                        promedio_tp=0.0, promedio_rh=0.0, promedio_ec=0.0, promedio_general=0.0
                    ),
                    diagnosticos_timeline=[]
                )

            # 3. Filtrar emprendedores que compartan programa con el mentor
            if request.id_programa:
                up_res = self.supabase.table("usuario_programa") \
                    .select("id_usuario") \
                    .eq("id_programa", request.id_programa) \
                    .in_("id_usuario", asig_ids) \
                    .execute()
            else:
                mentor_progs_res = self.supabase.table("usuario_programa") \
                    .select("id_programa") \
                    .eq("id_usuario", request.id_mentor) \
                    .execute()
                mentor_prog_ids = [p["id_programa"] for p in (mentor_progs_res.data or [])]
                if not mentor_prog_ids:
                    up_res = type("MockObj", (), {"data": []})()
                else:
                    up_res = self.supabase.table("usuario_programa") \
                        .select("id_usuario") \
                        .in_("id_programa", mentor_prog_ids) \
                        .in_("id_usuario", asig_ids) \
                        .execute()

            emprendedor_ids = list({u["id_usuario"] for u in (up_res.data or [])})
            if not emprendedor_ids:
                return ReporteData(
                    mentor_nombre=mentor.get("nombre", "Mentor"),
                    mentor_apellido=mentor.get("apellido", ""),
                    fecha_inicio=request.fecha_inicio,
                    fecha_fin=request.fecha_fin,
                    nombre_programa=nombre_programa,
                    emprendedores=[],
                    estadisticas=EstadisticasGlobales(
                        total_emprendedores=0, tasa_aprobado=0.0, promedio_cf=0.0,
                        promedio_gp=0.0, promedio_m=0.0, promedio_v=0.0,
                        promedio_tp=0.0, promedio_rh=0.0, promedio_ec=0.0, promedio_general=0.0
                    ),
                    diagnosticos_timeline=[]
                )

            # 4. Obtener información de usuarios (emprendedores) y emprendimientos
            usuarios_response = self.supabase.table("usuario") \
                .select("id_usuario, nombre, apellido") \
                .in_("id_usuario", emprendedor_ids) \
                .execute()
            usuarios_dict = {u.get("id_usuario"): u for u in (usuarios_response.data or []) if u.get("id_usuario")}

            emp_response = self.supabase.table("emprendimiento") \
                .select("id_usuario, nombre") \
                .in_("id_usuario", emprendedor_ids) \
                .execute()
            emprendimientos_dict = {e["id_usuario"]: e["nombre"] for e in (emp_response.data or [])}

            # 5. Obtener diagnósticos en el rango de fechas
            diagnosticos_response = self.supabase.table("diagnostico") \
                .select("*") \
                .in_("id_usuario", emprendedor_ids) \
                .gte("fecha_inicio", request.fecha_inicio.isoformat()) \
                .lte("fecha_inicio", request.fecha_fin.isoformat()) \
                .execute()
            diagnosticos = diagnosticos_response.data or []

            # 6. Construir lista de emprendedores respetando diagnóstico más reciente y Sin diagnóstico
            emprendedores = []
            diag_timeline = []

            for emp_id in emprendedor_ids:
                emp_diags = [d for d in diagnosticos if d.get("id_usuario") == emp_id]
                u_info = usuarios_dict.get(emp_id, {})
                e_nombre = emprendimientos_dict.get(emp_id, "N/A")

                if not emp_diags:
                    emprendedores.append(EmprendedorReporte(
                        nombre=u_info.get("nombre", "N/A"),
                        apellido=u_info.get("apellido", "N/A"),
                        emprendimiento=e_nombre,
                        promedio_general=None,
                        promedio_cf=None, promedio_gp=None, promedio_m=None,
                        promedio_v=None, promedio_tp=None, promedio_rh=None, promedio_ec=None,
                        num_diagnosticos=0,
                        estado_diagnostico="Sin diagnóstico"
                    ))
                    continue

                # RF-04.1: Seleccionar diagnóstico más reciente
                latest_d = sorted(emp_diags, key=lambda x: str(x.get("fecha_inicio") or ""), reverse=True)[0]
                cf = float(latest_d.get("puntaje_cf") or 0)
                gp = float(latest_d.get("puntaje_gp") or 0)
                m = float(latest_d.get("puntaje_m") or 0)
                v = float(latest_d.get("puntaje_v") or 0)
                tp = float(latest_d.get("puntaje_tp") or 0)
                rh = float(latest_d.get("puntaje_rh") or 0)
                ec = float(latest_d.get("puntaje_ec") or 0)
                prom_gen = latest_d.get("puntaje_total")
                if prom_gen is None:
                    prom_gen = (cf + gp + m + v + tp + rh + ec) / 7.0

                for d in emp_diags:
                    if d.get("fecha_inicio") and d.get("puntaje_total") is not None:
                        try:
                            diag_timeline.append(DiagnosticoPorFecha(
                                fecha=datetime.fromisoformat(d["fecha_inicio"].replace('Z', '+00:00')),
                                promedio=float(d["puntaje_total"])
                            ))
                        except Exception:
                            pass

                emprendedores.append(EmprendedorReporte(
                    nombre=u_info.get("nombre", "N/A"),
                    apellido=u_info.get("apellido", "N/A"),
                    emprendimiento=e_nombre,
                    promedio_general=round(float(prom_gen), 1),
                    promedio_cf=round(cf, 1),
                    promedio_gp=round(gp, 1),
                    promedio_m=round(m, 1),
                    promedio_v=round(v, 1),
                    promedio_tp=round(tp, 1),
                    promedio_rh=round(rh, 1),
                    promedio_ec=round(ec, 1),
                    num_diagnosticos=len(emp_diags),
                    estado_diagnostico="Con diagnóstico"
                ))

            # 7. Estadísticas globales (RF-04.3: solo evaluados)
            evaluados = [e for e in emprendedores if e.estado_diagnostico == "Con diagnóstico"]
            n_eval = len(evaluados)
            if n_eval > 0:
                g_cf = sum(e.promedio_cf or 0 for e in evaluados) / n_eval
                g_gp = sum(e.promedio_gp or 0 for e in evaluados) / n_eval
                g_m = sum(e.promedio_m or 0 for e in evaluados) / n_eval
                g_v = sum(e.promedio_v or 0 for e in evaluados) / n_eval
                g_tp = sum(e.promedio_tp or 0 for e in evaluados) / n_eval
                g_rh = sum(e.promedio_rh or 0 for e in evaluados) / n_eval
                g_ec = sum(e.promedio_ec or 0 for e in evaluados) / n_eval
                g_prom = sum(e.promedio_general or 0 for e in evaluados) / n_eval

                aprobados = len([d for d in diagnosticos if d.get("resultado") in ("ACEPTADO", "APROBADO", "EXIMIDO")])
                tasa = round(aprobados / len(diagnosticos) * 100, 1) if diagnosticos else 0.0

                estadisticas = EstadisticasGlobales(
                    total_emprendedores=len(emprendedores),
                    tasa_aprobado=tasa,
                    promedio_cf=round(g_cf, 1),
                    promedio_gp=round(g_gp, 1),
                    promedio_m=round(g_m, 1),
                    promedio_v=round(g_v, 1),
                    promedio_tp=round(g_tp, 1),
                    promedio_rh=round(g_rh, 1),
                    promedio_ec=round(g_ec, 1),
                    promedio_general=round(g_prom, 1)
                )
            else:
                estadisticas = EstadisticasGlobales(
                    total_emprendedores=len(emprendedores),
                    tasa_aprobado=0.0,
                    promedio_cf=0.0, promedio_gp=0.0, promedio_m=0.0,
                    promedio_v=0.0, promedio_tp=0.0, promedio_rh=0.0, promedio_ec=0.0,
                    promedio_general=0.0
                )

            diag_timeline_sorted = sorted(diag_timeline, key=lambda x: x.fecha)

            return ReporteData(
                mentor_nombre=mentor.get("nombre", "Mentor"),
                mentor_apellido=mentor.get("apellido", ""),
                fecha_inicio=request.fecha_inicio,
                fecha_fin=request.fecha_fin,
                nombre_programa=nombre_programa,
                emprendedores=emprendedores,
                estadisticas=estadisticas,
                diagnosticos_timeline=diag_timeline_sorted
            )

        except HTTPException:
            raise
        except Exception as e:
            print(f"Error al obtener datos del reporte: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al generar reporte: {str(e)}"
            )

    async def get_reporte_data_admin(self, request: ReporteAdminRequest) -> ReporteData:
        """
        Obtiene todos los datos para generar reporte de administrador con filtro de programa
        o consolidado general con duplicación por programa (Spec 003).
        """
        try:
            from app.services.org_filter import get_admin_org_user_ids

            nombre_programa = "Consolidado - Todos los programas"
            if request.id_programa:
                try:
                    p_res = self.supabase.table("programa").select("nombre").eq("id_programa", request.id_programa).execute()
                    if isinstance(p_res.data, list) and len(p_res.data) > 0 and isinstance(p_res.data[0], dict) and p_res.data[0].get("nombre"):
                        nombre_programa = str(p_res.data[0]["nombre"])
                    else:
                        nombre_programa = f"Programa {request.id_programa}"
                except Exception:
                    nombre_programa = f"Programa {request.id_programa}"

            org_users = None
            if request.admin_id:
                org_users = get_admin_org_user_ids(request.admin_id, self.supabase)

            emprendedores = []
            diag_timeline = []

            if request.id_programa:
                # Filtrar emprendedores por programa específico
                up_query = self.supabase.table("usuario_programa") \
                    .select("id_usuario") \
                    .eq("id_programa", request.id_programa)
                if org_users is not None:
                    if len(org_users) == 0:
                        up_query = up_query.in_("id_usuario", ["00000000-0000-0000-0000-000000000000"])
                    else:
                        up_query = up_query.in_("id_usuario", org_users)
                up_resp = up_query.execute()
                emp_ids = list({u["id_usuario"] for u in (up_resp.data or [])})

                if not emp_ids:
                    return ReporteData(
                        mentor_nombre="Administrador",
                        mentor_apellido="General",
                        fecha_inicio=request.fecha_inicio,
                        fecha_fin=request.fecha_fin,
                        nombre_programa=nombre_programa,
                        emprendedores=[],
                        estadisticas=EstadisticasGlobales(
                            total_emprendedores=0, tasa_aprobado=0.0, promedio_cf=0.0,
                            promedio_gp=0.0, promedio_m=0.0, promedio_v=0.0,
                            promedio_tp=0.0, promedio_rh=0.0, promedio_ec=0.0, promedio_general=0.0
                        ),
                        diagnosticos_timeline=[]
                    )

                u_resp = self.supabase.table("usuario") \
                    .select("id_usuario, nombre, apellido") \
                    .in_("id_usuario", emp_ids) \
                    .eq("id_rol", 2) \
                    .execute()
                u_data = u_resp.data or []
                emp_ids = [u.get("id_usuario") for u in u_data if u.get("id_usuario")]
                u_dict = {u.get("id_usuario"): u for u in u_data if u.get("id_usuario")}

                if not emp_ids:
                    return ReporteData(
                        mentor_nombre="Administrador",
                        mentor_apellido="General",
                        fecha_inicio=request.fecha_inicio,
                        fecha_fin=request.fecha_fin,
                        nombre_programa=nombre_programa,
                        emprendedores=[],
                        estadisticas=EstadisticasGlobales(
                            total_emprendedores=0, tasa_aprobado=0.0, promedio_cf=0.0,
                            promedio_gp=0.0, promedio_m=0.0, promedio_v=0.0,
                            promedio_tp=0.0, promedio_rh=0.0, promedio_ec=0.0, promedio_general=0.0
                        ),
                        diagnosticos_timeline=[]
                    )

                emp_resp = self.supabase.table("emprendimiento").select("id_usuario, nombre").in_("id_usuario", emp_ids).execute()
                emp_dict = {e["id_usuario"]: e["nombre"] for e in (emp_resp.data or [])}

                diag_resp = self.supabase.table("diagnostico") \
                    .select("*") \
                    .in_("id_usuario", emp_ids) \
                    .gte("fecha_inicio", request.fecha_inicio.isoformat()) \
                    .lte("fecha_inicio", request.fecha_fin.isoformat()) \
                    .execute()
                diagnosticos = diag_resp.data or []

                for eid in emp_ids:
                    diags_emp = [d for d in diagnosticos if d.get("id_usuario") == eid]
                    u = u_dict.get(eid, {})
                    e_nom = emp_dict.get(eid, "N/A")

                    if not diags_emp:
                        emprendedores.append(EmprendedorReporte(
                            nombre=u.get("nombre", "N/A"),
                            apellido=u.get("apellido", "N/A"),
                            emprendimiento=e_nom,
                            promedio_general=None,
                            promedio_cf=None, promedio_gp=None, promedio_m=None,
                            promedio_v=None, promedio_tp=None, promedio_rh=None, promedio_ec=None,
                            num_diagnosticos=0,
                            estado_diagnostico="Sin diagnóstico"
                        ))
                        continue

                    latest_d = sorted(diags_emp, key=lambda x: str(x.get("fecha_inicio") or ""), reverse=True)[0]
                    cf = float(latest_d.get("puntaje_cf") or 0)
                    gp = float(latest_d.get("puntaje_gp") or 0)
                    m = float(latest_d.get("puntaje_m") or 0)
                    v = float(latest_d.get("puntaje_v") or 0)
                    tp = float(latest_d.get("puntaje_tp") or 0)
                    rh = float(latest_d.get("puntaje_rh") or 0)
                    ec = float(latest_d.get("puntaje_ec") or 0)
                    prom_gen = latest_d.get("puntaje_total")
                    if prom_gen is None:
                        prom_gen = (cf + gp + m + v + tp + rh + ec) / 7.0

                    for d in diags_emp:
                        if d.get("fecha_inicio") and d.get("puntaje_total") is not None:
                            try:
                                diag_timeline.append(DiagnosticoPorFecha(
                                    fecha=datetime.fromisoformat(d["fecha_inicio"].replace('Z', '+00:00')),
                                    promedio=float(d["puntaje_total"])
                                ))
                            except Exception:
                                pass

                    emprendedores.append(EmprendedorReporte(
                        nombre=u.get("nombre", "N/A"),
                        apellido=u.get("apellido", "N/A"),
                        emprendimiento=e_nom,
                        promedio_general=round(float(prom_gen), 1),
                        promedio_cf=round(cf, 1),
                        promedio_gp=round(gp, 1),
                        promedio_m=round(m, 1),
                        promedio_v=round(v, 1),
                        promedio_tp=round(tp, 1),
                        promedio_rh=round(rh, 1),
                        promedio_ec=round(ec, 1),
                        num_diagnosticos=len(diags_emp),
                        estado_diagnostico="Con diagnóstico"
                    ))

            else:
                # RF-03.3: Consolidado con duplicación por programa
                up_query = self.supabase.table("usuario_programa") \
                    .select("id_usuario, id_programa, programa(nombre)")
                if org_users is not None:
                    if len(org_users) == 0:
                        up_query = up_query.in_("id_usuario", ["00000000-0000-0000-0000-000000000000"])
                    else:
                        up_query = up_query.in_("id_usuario", org_users)
                up_resp = up_query.execute()
                up_entries = up_resp.data or []

                all_emp_ids = list({item["id_usuario"] for item in up_entries})

                u_dict = {}
                diagnosticos = []
                if all_emp_ids:
                    u_resp = self.supabase.table("usuario") \
                        .select("id_usuario, nombre, apellido") \
                        .in_("id_usuario", all_emp_ids) \
                        .eq("id_rol", 2) \
                        .execute()
                    u_data = u_resp.data or []
                    valid_emp_ids = {u.get("id_usuario") for u in u_data if u.get("id_usuario")}
                    u_dict = {u.get("id_usuario"): u for u in u_data if u.get("id_usuario")}

                    # Filtrar up_entries para conservar EXCLUSIVAMENTE a emprendedores (id_rol = 2)
                    up_entries = [item for item in up_entries if item.get("id_usuario") in valid_emp_ids]
                    all_emp_ids = list(valid_emp_ids)

                    if all_emp_ids:
                        diag_resp = self.supabase.table("diagnostico") \
                            .select("*") \
                            .in_("id_usuario", all_emp_ids) \
                            .gte("fecha_inicio", request.fecha_inicio.isoformat()) \
                            .lte("fecha_inicio", request.fecha_fin.isoformat()) \
                            .execute()
                        diagnosticos = diag_resp.data or []

                for item in up_entries:
                    eid = item["id_usuario"]
                    prog_info = item.get("programa") or {}
                    prog_nom = prog_info.get("nombre") if isinstance(prog_info, dict) else f"Programa {item.get('id_programa')}"
                    u = u_dict.get(eid, {})

                    diags_emp = [d for d in diagnosticos if d.get("id_usuario") == eid]
                    if not diags_emp:
                        emprendedores.append(EmprendedorReporte(
                            nombre=u.get("nombre", "N/A"),
                            apellido=u.get("apellido", "N/A"),
                            emprendimiento=prog_nom,
                            promedio_general=None,
                            promedio_cf=None, promedio_gp=None, promedio_m=None,
                            promedio_v=None, promedio_tp=None, promedio_rh=None, promedio_ec=None,
                            num_diagnosticos=0,
                            estado_diagnostico="Sin diagnóstico"
                        ))
                        continue

                    latest_d = sorted(diags_emp, key=lambda x: str(x.get("fecha_inicio") or ""), reverse=True)[0]
                    cf = float(latest_d.get("puntaje_cf") or 0)
                    gp = float(latest_d.get("puntaje_gp") or 0)
                    m = float(latest_d.get("puntaje_m") or 0)
                    v = float(latest_d.get("puntaje_v") or 0)
                    tp = float(latest_d.get("puntaje_tp") or 0)
                    rh = float(latest_d.get("puntaje_rh") or 0)
                    ec = float(latest_d.get("puntaje_ec") or 0)
                    prom_gen = latest_d.get("puntaje_total")
                    if prom_gen is None:
                        prom_gen = (cf + gp + m + v + tp + rh + ec) / 7.0

                    for d in diags_emp:
                        if d.get("fecha_inicio") and d.get("puntaje_total") is not None:
                            try:
                                diag_timeline.append(DiagnosticoPorFecha(
                                    fecha=datetime.fromisoformat(d["fecha_inicio"].replace('Z', '+00:00')),
                                    promedio=float(d["puntaje_total"])
                                ))
                            except Exception:
                                pass

                    emprendedores.append(EmprendedorReporte(
                        nombre=u.get("nombre", "N/A"),
                        apellido=u.get("apellido", "N/A"),
                        emprendimiento=prog_nom,
                        promedio_general=round(float(prom_gen), 1),
                        promedio_cf=round(cf, 1),
                        promedio_gp=round(gp, 1),
                        promedio_m=round(m, 1),
                        promedio_v=round(v, 1),
                        promedio_tp=round(tp, 1),
                        promedio_rh=round(rh, 1),
                        promedio_ec=round(ec, 1),
                        num_diagnosticos=len(diags_emp),
                        estado_diagnostico="Con diagnóstico"
                    ))

            # Estadísticas globales
            evaluados = [e for e in emprendedores if e.estado_diagnostico == "Con diagnóstico"]
            n_eval = len(evaluados)
            if n_eval > 0:
                g_cf = sum(e.promedio_cf or 0 for e in evaluados) / n_eval
                g_gp = sum(e.promedio_gp or 0 for e in evaluados) / n_eval
                g_m = sum(e.promedio_m or 0 for e in evaluados) / n_eval
                g_v = sum(e.promedio_v or 0 for e in evaluados) / n_eval
                g_tp = sum(e.promedio_tp or 0 for e in evaluados) / n_eval
                g_rh = sum(e.promedio_rh or 0 for e in evaluados) / n_eval
                g_ec = sum(e.promedio_ec or 0 for e in evaluados) / n_eval
                g_prom = sum(e.promedio_general or 0 for e in evaluados) / n_eval

                aprobados = len([d for d in diagnosticos if d.get("resultado") in ("ACEPTADO", "APROBADO", "EXIMIDO")])
                tasa = round(aprobados / len(diagnosticos) * 100, 1) if diagnosticos else 0.0

                estadisticas = EstadisticasGlobales(
                    total_emprendedores=len(emprendedores),
                    tasa_aprobado=tasa,
                    promedio_cf=round(g_cf, 1),
                    promedio_gp=round(g_gp, 1),
                    promedio_m=round(g_m, 1),
                    promedio_v=round(g_v, 1),
                    promedio_tp=round(g_tp, 1),
                    promedio_rh=round(g_rh, 1),
                    promedio_ec=round(g_ec, 1),
                    promedio_general=round(g_prom, 1)
                )
            else:
                estadisticas = EstadisticasGlobales(
                    total_emprendedores=len(emprendedores),
                    tasa_aprobado=0.0,
                    promedio_cf=0.0, promedio_gp=0.0, promedio_m=0.0,
                    promedio_v=0.0, promedio_tp=0.0, promedio_rh=0.0, promedio_ec=0.0,
                    promedio_general=0.0
                )

            diag_timeline_sorted = sorted(diag_timeline, key=lambda x: x.fecha)

            return ReporteData(
                mentor_nombre="Administrador",
                mentor_apellido="General",
                fecha_inicio=request.fecha_inicio,
                fecha_fin=request.fecha_fin,
                nombre_programa=nombre_programa,
                emprendedores=emprendedores,
                estadisticas=estadisticas,
                diagnosticos_timeline=diag_timeline_sorted
            )

        except HTTPException:
            raise
        except Exception as e:
            print(f"Error al obtener datos del reporte admin: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al generar reporte: {str(e)}"
            )

    # ── Colores institucionales (Activa Mujer / JCI) ─────────────
    TEAL        = colors.HexColor('#1E766F')   # activa-dark-teal → encabezados, tablas
    TEAL_LIGHT  = colors.HexColor('#3AADA8')   # activa-teal → accentos, gráficos
    DARK_GRAY   = colors.HexColor('#374151')
    LIGHT_GRAY_ROW = colors.HexColor('#F0FAFA')  # fondo de fila alternada (teal muy suave)
    WHITE       = colors.white
    RED_CONF    = colors.HexColor('#C0392B')
    HEADER_LINE = colors.HexColor('#1E766F')   # línea de encabezado = activa-dark-teal
    # Alias para compatibilidad interna
    NAVY = colors.HexColor('#1E766F')

    # ── Callbacks de encabezado / pie de página ────────────────
    @staticmethod
    def _header_footer(canvas_obj: canvas.Canvas, doc):
        """Dibuja encabezado y pie en cada página."""
        canvas_obj.saveState()
        page_w, page_h = letter

        # —— Encabezado ——
        y_line = page_h - 45
        canvas_obj.setStrokeColor(ReporteService.HEADER_LINE)
        canvas_obj.setLineWidth(1.2)
        canvas_obj.line(50, y_line, page_w - 50, y_line)

        canvas_obj.setFont("Helvetica", 8)
        canvas_obj.setFillColor(ReporteService.DARK_GRAY)
        canvas_obj.drawString(50, y_line + 6,
                              "Incubadora JCI Empresarios La Paz")

        canvas_obj.setFont("Helvetica", 8)
        canvas_obj.setFillColor(ReporteService.DARK_GRAY)
        canvas_obj.drawRightString(page_w - 50, y_line + 6, "Reporte de Desempeño")

        # —— Pie de página ——
        y_foot = 35
        canvas_obj.setStrokeColor(ReporteService.HEADER_LINE)
        canvas_obj.setLineWidth(0.8)
        canvas_obj.line(50, y_foot, page_w - 50, y_foot)

        canvas_obj.setFont("Helvetica", 7)
        canvas_obj.setFillColor(ReporteService.DARK_GRAY)
        canvas_obj.drawString(
            50, y_foot - 12,
            f"Generado el: {datetime.now().strftime('%d/%m/%Y %H:%M')}")
        canvas_obj.drawRightString(
            page_w - 50, y_foot - 12,
            f"Página {canvas_obj.getPageNumber()}")

        canvas_obj.restoreState()

    # ── Estilos reutilizables ──────────────────────────────────
    def _get_styles(self):
        """Retorna los estilos personalizados para el reporte formal."""
        styles = getSampleStyleSheet()

        section_title = ParagraphStyle(
            'SectionTitle',
            parent=styles['Heading1'],
            fontSize=16,
            textColor=self.NAVY,
            fontName='Helvetica-Bold',
            spaceBefore=18,
            spaceAfter=6,
        )

        subsection_title = ParagraphStyle(
            'SubsectionTitle',
            parent=styles['Heading2'],
            fontSize=13,
            textColor=self.NAVY,
            fontName='Helvetica-Bold',
            spaceBefore=14,
            spaceAfter=6,
        )

        body_text = ParagraphStyle(
            'BodyText2',
            parent=styles['Normal'],
            fontSize=10,
            textColor=self.DARK_GRAY,
            fontName='Helvetica',
            leading=14,
            spaceAfter=10,
        )

        label_style = ParagraphStyle(
            'LabelCell',
            parent=styles['Normal'],
            fontSize=10,
            textColor=self.DARK_GRAY,
            fontName='Helvetica-Bold',
            leading=13,
        )

        value_style = ParagraphStyle(
            'ValueCell',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#111827'),
            fontName='Helvetica',
            leading=13,
        )

        return {
            'base': styles,
            'section': section_title,
            'subsection': subsection_title,
            'body': body_text,
            'label': label_style,
            'value': value_style,
        }

    # ── Tablas auxiliares ──────────────────────────────────────
    def _build_label_value_table(self, rows, col_widths=None):
        """Construye una tabla de dos columnas label / valor con filas alternadas."""
        if col_widths is None:
            col_widths = [2.8 * inch, 3.5 * inch]

        table = Table(rows, colWidths=col_widths)
        style_cmds = [
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('TEXTCOLOR', (0, 0), (0, -1), self.DARK_GRAY),
            ('TEXTCOLOR', (1, 0), (1, -1), colors.HexColor('#111827')),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
            ('TOPPADDING', (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
        ]
        # Filas alternadas
        for i in range(0, len(rows), 2):
            style_cmds.append(('BACKGROUND', (0, i), (-1, i), self.LIGHT_GRAY_ROW))

        table.setStyle(TableStyle(style_cmds))
        return table

    # ── Gráficos ──────────────────────────────────────────────
    def generate_chart_bars(self, estadisticas: EstadisticasGlobales) -> str:
        """Genera gráfico de barras con estilo formal."""
        try:
            areas = [
                'Costos y\nFinanzas',
                'Gestión y\nProducción',
                'Marketing',
                'Ventas',
                'Talento y\nPersonas',
                'Recursos\nHumanos',
                'Economía\ndel Cuidado',
            ]
            valores = [
                estadisticas.promedio_cf,
                estadisticas.promedio_gp,
                estadisticas.promedio_m,
                estadisticas.promedio_v,
                estadisticas.promedio_tp,
                estadisticas.promedio_rh,
                estadisticas.promedio_ec,
            ]
            bar_colors = ['#1E766F', '#3AADA8', '#1E766F', '#3AADA8',
                          '#1E766F', '#3AADA8', '#1E766F']

            fig, ax = plt.subplots(figsize=(10, 5))
            bars = ax.bar(areas, valores, color=bar_colors, width=0.6, edgecolor='white')
            for bar, val in zip(bars, valores):
                ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 1.5,
                        f'{val}', ha='center', va='bottom', fontsize=9,
                        fontweight='bold', color='#374151')

            ax.set_ylabel('Puntaje Promedio', fontsize=11, color='#374151')
            ax.set_ylim(0, max(valores) * 1.2 if max(valores) > 0 else 100)
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            ax.spines['left'].set_color('#D1D5DB')
            ax.spines['bottom'].set_color('#D1D5DB')
            ax.tick_params(colors='#374151', labelsize=9)
            ax.yaxis.grid(True, alpha=0.3, color='#9CA3AF')
            ax.set_axisbelow(True)
            fig.tight_layout()

            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
            fig.savefig(temp_file.name, dpi=170, bbox_inches='tight',
                        facecolor='white', edgecolor='none')
            plt.close(fig)
            return temp_file.name
        except Exception as e:
            print(f"Error al generar gráfico de barras: {str(e)}")
            return None

    def generate_chart_line(self, timeline: List[DiagnosticoPorFecha]) -> str:
        """Genera gráfico de líneas con estilo formal."""
        try:
            if len(timeline) == 0:
                return None

            fechas = [d.fecha for d in timeline]
            promedios = [d.promedio for d in timeline]

            fig, ax = plt.subplots(figsize=(10, 5))
            ax.plot(fechas, promedios, marker='o', linewidth=2.2, markersize=7,
                    color='#3AADA8', markerfacecolor='#1E766F', markeredgecolor='white',
                    markeredgewidth=1.5)
            ax.fill_between(fechas, promedios, alpha=0.08, color='#3AADA8')

            ax.set_ylabel('Puntaje Promedio', fontsize=11, color='#374151')
            ax.set_xlabel('Fecha', fontsize=11, color='#374151')
            ax.set_ylim(0, 100)
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            ax.spines['left'].set_color('#D1D5DB')
            ax.spines['bottom'].set_color('#D1D5DB')
            ax.tick_params(colors='#374151', labelsize=9)
            ax.yaxis.grid(True, alpha=0.3, color='#9CA3AF')
            ax.set_axisbelow(True)
            plt.xticks(rotation=45, ha='right')
            fig.tight_layout()

            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
            fig.savefig(temp_file.name, dpi=170, bbox_inches='tight',
                        facecolor='white', edgecolor='none')
            plt.close(fig)
            return temp_file.name
        except Exception as e:
            print(f"Error al generar gráfico de líneas: {str(e)}")
            return None

    def generate_chart_radar(self, estadisticas: EstadisticasGlobales) -> str:
        """Genera gráfico radar con estilo formal."""
        try:
            categories = ['CF', 'GP', 'M', 'V', 'TP', 'RH', 'EC']
            valores = [
                estadisticas.promedio_cf,
                estadisticas.promedio_gp,
                estadisticas.promedio_m,
                estadisticas.promedio_v,
                estadisticas.promedio_tp,
                estadisticas.promedio_rh,
                estadisticas.promedio_ec,
            ]
            valores += valores[:1]

            angles = np.linspace(0, 2 * np.pi, len(categories), endpoint=False).tolist()
            angles += angles[:1]

            fig, ax = plt.subplots(figsize=(7, 7), subplot_kw=dict(projection='polar'))
            ax.plot(angles, valores, 'o-', linewidth=2, color='#2563EB',
                    markersize=6, markerfacecolor='#1B2A4A', markeredgecolor='white')
            ax.fill(angles, valores, alpha=0.15, color='#2563EB')
            ax.set_xticks(angles[:-1])
            ax.set_xticklabels(categories, fontsize=11, fontweight='bold', color='#1B2A4A')
            ax.set_ylim(0, 100)
            ax.set_rlabel_position(30)
            ax.tick_params(axis='y', labelsize=8, colors='#6B7280')
            ax.grid(True, color='#D1D5DB', linewidth=0.5)
            ax.spines['polar'].set_color('#D1D5DB')
            fig.tight_layout()

            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
            fig.savefig(temp_file.name, dpi=170, bbox_inches='tight',
                        facecolor='white', edgecolor='none')
            plt.close(fig)
            return temp_file.name
        except Exception as e:
            print(f"Error al generar gráfico radar: {str(e)}")
            return None

    # ── Generación del PDF ────────────────────────────────────
    async def generate_pdf(self, reporte_data: ReporteData) -> bytes:
        """Genera el PDF final del reporte con estilo formal institucional."""
        try:
            # Generar gráficos (sin radar)
            chart_bars = self.generate_chart_bars(reporte_data.estadisticas)
            chart_line = self.generate_chart_line(reporte_data.diagnosticos_timeline)

            # Crear PDF en memoria
            buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                buffer,
                pagesize=letter,
                topMargin=65,
                bottomMargin=55,
                leftMargin=50,
                rightMargin=50,
            )
            story = []
            s = self._get_styles()

            # ═══════════════════════════════════════════════════
            # PORTADA
            # ═══════════════════════════════════════════════════
            story.append(Spacer(1, 1.8 * inch))

            cover_title = ParagraphStyle(
                'CoverTitle', parent=s['base']['Heading1'],
                fontSize=26, textColor=self.NAVY,
                fontName='Helvetica-Bold', alignment=TA_CENTER,
                spaceAfter=12,
            )
            cover_sub = ParagraphStyle(
                'CoverSub', parent=s['base']['Normal'],
                fontSize=14, textColor=self.DARK_GRAY,
                fontName='Helvetica', alignment=TA_CENTER,
                spaceAfter=6,
            )

            story.append(Paragraph(
                "REPORTE DE DESEMPEÑO", cover_title))
            story.append(Paragraph(
                "Incubadora JCI Empresarios La Paz", cover_sub))
            story.append(Spacer(1, 0.6 * inch))

            # Línea decorativa
            line_table = Table([['']],
                               colWidths=[4 * inch], rowHeights=[2])
            line_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), self.NAVY),
            ]))
            # Centrar la línea
            line_wrapper = Table([[line_table]], colWidths=[doc.width])
            line_wrapper.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ]))
            story.append(line_wrapper)
            story.append(Spacer(1, 0.6 * inch))

            # Datos de la portada
            es_admin = reporte_data.mentor_nombre == "Administrador"
            tipo_reporte = "Reporte General del Sistema" if es_admin else "Reporte de Mentor"
            responsable = "Administrador General" if es_admin else f"{reporte_data.mentor_nombre} {reporte_data.mentor_apellido}"

            cover_data = [
                ['Tipo de reporte', tipo_reporte],
                ['Programa', reporte_data.nombre_programa or 'Consolidado - Todos los programas'],
                ['Responsable', responsable],
                ['Período',
                 f"{reporte_data.fecha_inicio.strftime('%d/%m/%Y')}  —  "
                 f"{reporte_data.fecha_fin.strftime('%d/%m/%Y')}"],
                ['Fecha de generación', datetime.now().strftime('%d/%m/%Y %H:%M')],
            ]
            story.append(self._build_label_value_table(cover_data,
                                                       col_widths=[2.5 * inch, 3.5 * inch]))

            # ═══════════════════════════════════════════════════
            # 1. INFORMACIÓN GENERAL
            # ═══════════════════════════════════════════════════
            story.append(PageBreak())
            story.append(Paragraph("1. INFORMACIÓN GENERAL", s['section']))
            story.append(Paragraph(
                "En esta sección se presentan los datos generales del reporte, incluyendo "
                "la información del responsable, el período evaluado y un resumen de los "
                "indicadores principales.",
                s['body']))
            story.append(Spacer(1, 0.15 * inch))

            story.append(Paragraph("1.1 Datos del reporte", s['subsection']))
            info_rows = [
                ['Responsable', responsable],
                ['Período evaluado',
                 f"{reporte_data.fecha_inicio.strftime('%d/%m/%Y')} — "
                 f"{reporte_data.fecha_fin.strftime('%d/%m/%Y')}"],
                ['Total emprendedores',
                 str(reporte_data.estadisticas.total_emprendedores)],
                ['Tasa de aprobado',
                 f"{reporte_data.estadisticas.tasa_aprobado} %"],
                ['Promedio general',
                 f"{reporte_data.estadisticas.promedio_general}"],
            ]
            story.append(self._build_label_value_table(info_rows))
            story.append(Spacer(1, 0.25 * inch))

            # ═══════════════════════════════════════════════════
            # 2. ESTADÍSTICAS GLOBALES POR ÁREA
            # ═══════════════════════════════════════════════════
            story.append(Paragraph("2. ESTADÍSTICAS GLOBALES POR ÁREA", s['section']))
            story.append(Paragraph(
                "A continuación se detallan los promedios obtenidos en cada una de las "
                "siete áreas de evaluación del diagnóstico. Estos valores "
                "representan el promedio general de todos los emprendedores evaluados "
                "en el período indicado.",
                s['body']))
            story.append(Spacer(1, 0.1 * inch))

            story.append(Paragraph("2.1 Promedios por área", s['subsection']))
            stats_rows = [
                ['Costos y Finanzas (CF)',
                 f"{reporte_data.estadisticas.promedio_cf}"],
                ['Gestión y Producción (GP)',
                 f"{reporte_data.estadisticas.promedio_gp}"],
                ['Marketing (M)',
                 f"{reporte_data.estadisticas.promedio_m}"],
                ['Ventas (V)',
                 f"{reporte_data.estadisticas.promedio_v}"],
                ['Talento y Personas (TP)',
                 f"{reporte_data.estadisticas.promedio_tp}"],
                ['Recursos Humanos (RH)',
                 f"{reporte_data.estadisticas.promedio_rh}"],
                ['Economía del Cuidado (EC)',
                 f"{reporte_data.estadisticas.promedio_ec}"],
            ]
            story.append(self._build_label_value_table(stats_rows))
            story.append(Spacer(1, 0.15 * inch))

            # Fila resumen
            summary_data = [['PROMEDIO GENERAL',
                             f"{reporte_data.estadisticas.promedio_general}"]]
            summary_tbl = Table(summary_data, colWidths=[2.8 * inch, 3.5 * inch])
            summary_tbl.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), self.NAVY),
                ('TEXTCOLOR', (0, 0), (-1, -1), self.WHITE),
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 11),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('LEFTPADDING', (0, 0), (-1, -1), 12),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(summary_tbl)

            # ═══════════════════════════════════════════════════
            # 3. ANÁLISIS GRÁFICO
            # ═══════════════════════════════════════════════════
            story.append(PageBreak())
            story.append(Paragraph("3. ANÁLISIS GRÁFICO", s['section']))
            story.append(Paragraph(
                "Los siguientes gráficos permiten visualizar de forma clara el desempeño "
                "de los emprendedores en las distintas áreas evaluadas, así como la "
                "evolución en el tiempo de los diagnósticos realizados.",
                s['body']))

            if chart_bars:
                story.append(Spacer(1, 0.15 * inch))
                story.append(Paragraph(
                    "3.1 Promedios por área de negocio", s['subsection']))
                story.append(Image(chart_bars, width=6.2 * inch, height=3.3 * inch))

            if chart_line:
                story.append(PageBreak())
                story.append(Paragraph(
                    "3.2 Evolución temporal de diagnósticos", s['subsection']))
                story.append(Image(chart_line, width=6.2 * inch, height=3.3 * inch))

            # ═══════════════════════════════════════════════════
            # 4. DETALLE POR EMPRENDEDOR
            # ═══════════════════════════════════════════════════
            story.append(PageBreak())
            story.append(Paragraph("4. DETALLE POR EMPRENDEDOR", s['section']))
            story.append(Paragraph(
                "La siguiente tabla muestra el detalle individual de cada emprendedor "
                "evaluado durante el período, incluyendo su emprendimiento y los "
                "promedios obtenidos en cada área de diagnóstico.",
                s['body']))
            story.append(Spacer(1, 0.1 * inch))

            # Encabezados de la tabla
            header_row = ['Emprendedor', 'Emprendimiento', 'Prom.',
                          'CF', 'GP', 'M', 'V', 'TP', 'RH', 'EC']
            emp_rows = [header_row]
            for emp in reporte_data.emprendedores:
                if emp.estado_diagnostico == "Sin diagnóstico" or emp.num_diagnosticos == 0 or emp.promedio_general is None:
                    emp_rows.append([
                        f'{emp.nombre} {emp.apellido}',
                        emp.emprendimiento or 'N/A',
                        'Sin diagnóstico',
                        '-', '-', '-', '-', '-', '-', '-'
                    ])
                else:
                    emp_rows.append([
                        f'{emp.nombre} {emp.apellido}',
                        emp.emprendimiento or 'N/A',
                        f'{emp.promedio_general}',
                        f'{emp.promedio_cf}',
                        f'{emp.promedio_gp}',
                        f'{emp.promedio_m}',
                        f'{emp.promedio_v}',
                        f'{emp.promedio_tp}',
                        f'{emp.promedio_rh}',
                        f'{emp.promedio_ec}',
                    ])

            col_w = [1.3 * inch, 1.3 * inch, 0.55 * inch,
                     0.45 * inch, 0.45 * inch, 0.45 * inch,
                     0.45 * inch, 0.45 * inch, 0.45 * inch, 0.45 * inch]
            emp_table = Table(emp_rows, colWidths=col_w)

            emp_style_cmds = [
                # Header
                ('BACKGROUND', (0, 0), (-1, 0), self.NAVY),
                ('TEXTCOLOR', (0, 0), (-1, 0), self.WHITE),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                # Body
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
                ('LINEAFTER', (0, 0), (-1, -1), 0.3, colors.HexColor('#E5E7EB')),
            ]
            # Filas alternadas
            for i in range(1, len(emp_rows), 2):
                emp_style_cmds.append(
                    ('BACKGROUND', (0, i), (-1, i), self.LIGHT_GRAY_ROW))

            emp_table.setStyle(TableStyle(emp_style_cmds))
            story.append(emp_table)

            # ═══════════════════════════════════════════════════
            # CONSTRUIR PDF
            # ═══════════════════════════════════════════════════
            doc.build(story,
                      onFirstPage=self._header_footer,
                      onLaterPages=self._header_footer)

            # Limpiar archivos temporales
            for chart_file in [chart_bars, chart_line]:
                if chart_file and os.path.exists(chart_file):
                    try:
                        os.remove(chart_file)
                    except:
                        pass

            pdf_bytes = buffer.getvalue()
            buffer.close()
            return pdf_bytes

        except Exception as e:
            print(f"Error al generar PDF: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al generar PDF: {str(e)}"
            )


    # ── Métodos auxiliares para Reporte Individual Emprendedor ──

    @staticmethod
    def _clean_text_for_reportlab(text: str) -> str:
        """Elimina emojis y caracteres especiales no compatibles con fuentes estándar de ReportLab."""
        if not text:
            return ""
        emoji_pattern = re.compile(
            "[\U00010000-\U0010ffff]|[\u200d\u200c\u200b\ufeff\u2028\u2029]|"
            "[\u2600-\u26ff]|[\u2700-\u27bf]|[\u2300-\u23ff]|[\u2b50]|[\u3030]|[\u00a9\u00ae]",
            flags=re.UNICODE
        )
        clean = emoji_pattern.sub('', text)
        clean = clean.replace('“', '"').replace('”', '"').replace('’', "'").replace('‘', "'")
        clean = clean.replace('–', '-').replace('—', '-')
        return clean.strip()

    @staticmethod
    def _markdown_to_reportlab(text: str) -> str:
        """Convierte negrita y cursiva básica a etiquetas compatibles con Paragraph de ReportLab."""
        if not text:
            return ""
        clean = ReporteService._clean_text_for_reportlab(text)
        clean = re.sub(r'&(?!amp;|lt;|gt;|quot;|apos;)', '&amp;', clean)
        clean = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', clean)
        clean = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'<i>\1</i>', clean)
        return clean

    @staticmethod
    def _get_imesun_nivel(puntaje: float) -> tuple[str, str]:
        """Retorna (Nivel, Descripción) según la escala IMESUN de la OIT."""
        puntaje = float(puntaje or 0)
        if puntaje <= 20:
            return "Nivel 1", "Inicial / Crítico"
        elif puntaje <= 40:
            return "Nivel 2", "Básico"
        elif puntaje <= 60:
            return "Nivel 3", "En Desarrollo"
        elif puntaje <= 80:
            return "Nivel 4", "Establecido"
        else:
            return "Nivel 5", "Consolidado"

    def _parse_conclusion(self, text: str):
        """Separa el texto de conclusión en Diagnóstico General, Fortalezas y Debilidades.
        Excluye estrictamente cualquier sección referente al mentor o sesiones de mentoría."""
        if not text:
            return "", [], []

        diag_gen = ""
        fortalezas = []
        debilidades = []

        sections = re.split(r'\n(?=#{2,3}\s+)', text)
        for sec in sections:
            sec = sec.strip()
            if not sec:
                continue
            first_line = sec.split('\n')[0].lower()
            content = '\n'.join(sec.split('\n')[1:]).strip()

            # Excluir estrictamente enfoque de mentoría
            if any(w in first_line for w in ['mentor', 'sesión', 'sesion', 'enfoque']):
                continue

            if any(w in first_line for w in ['diagnóstico general', 'diagnostico general', 'madurez']):
                diag_gen = content
            elif 'fortaleza' in first_line:
                fortalezas = self._parse_bullet_items(content)
            elif any(w in first_line for w in ['oportunidad', 'debilidad', 'crítica', 'critica']):
                debilidades = self._parse_bullet_items(content)
            elif not diag_gen:
                diag_gen = sec

        return diag_gen, fortalezas, debilidades

    def _parse_bullet_items(self, content: str) -> List[SeccionItem]:
        """Extrae viñetas estructuradas con área y texto."""
        items = []
        if not content:
            return items
        lines = content.split('\n')
        current_area = ''
        current_text = ''
        for line in lines:
            line_s = line.strip()
            if not line_s:
                continue
            m = re.match(r'^[\*\-\d\.]+\s*(?:\*\*(.+?)\*\*[:\s]*)?(.*)$', line_s)
            if m and (m.group(1) or line_s.startswith(('*', '-', '1', '2', '3', '4', '5'))):
                if current_text:
                    items.append(SeccionItem(area=current_area, texto=current_text))
                current_area = (m.group(1) or '').strip()
                current_text = (m.group(2) or '').strip()
            else:
                if current_text:
                    current_text += ' ' + line_s
                else:
                    current_text = line_s
        if current_text:
            items.append(SeccionItem(area=current_area, texto=current_text))
        return items

    def _parse_recomendaciones(self, text: str) -> List[RecomendacionItem]:
        """Extrae las recomendaciones estructuradas (Título, Objetivo, Acciones, Impacto)."""
        items = []
        if not text:
            return items
        blocks = re.split(r'(?:\n---+\n|\n(?=#{2,3}\s+))', text)
        for block in blocks:
            block = block.strip()
            if not block:
                continue
            lines = block.split('\n')
            titulo = ''
            objetivo = ''
            acciones = []
            impacto = ''
            mode = 'header'

            for line in lines:
                line_s = line.strip()
                if not line_s:
                    continue
                if line_s.startswith('###') or line_s.startswith('##'):
                    t = re.sub(r'^#{2,3}\s*(?:Recomendaci[oó]n\s*\d+\s*:\s*)?', '', line_s)
                    titulo = t.strip()
                    continue
                if '**Objetivo:**' in line_s or '**Objetivo**:' in line_s:
                    mode = 'objetivo'
                    objetivo = re.sub(r'^\*?\s*\*\*Objetivo:?\*\*:?\s*', '', line_s).strip()
                    continue
                if '**Acciones sugeridas:**' in line_s or '**Acciones:**' in line_s:
                    mode = 'acciones'
                    continue
                if '**Impacto esperado:**' in line_s or '**Impacto:**' in line_s:
                    mode = 'impacto'
                    impacto = re.sub(r'^\*?\s*\*\*Impacto(?: esperado)?:?\*\*:?\s*', '', line_s).strip()
                    continue

                if mode == 'acciones':
                    m_acc = re.match(r'^(?:[\*\-]|(?:\d+\.))\s*(.*)$', line_s)
                    if m_acc:
                        acciones.append(m_acc.group(1).strip())
                    elif acciones:
                        acciones[-1] += ' ' + line_s
                elif mode == 'objetivo':
                    objetivo += ' ' + line_s
                elif mode == 'impacto':
                    impacto += ' ' + line_s

            if titulo or objetivo or acciones or impacto:
                items.append(RecomendacionItem(
                    titulo=titulo or f"Recomendación Prioritaria {len(items) + 1}",
                    objetivo=objetivo,
                    acciones=acciones,
                    impacto=impacto
                ))
        return items

    def generate_chart_radar_emprendedor(self, estadisticas: EstadisticasGlobales) -> str:
        """Genera gráfico radar en fondo 100% blanco puro con la escala IMESUN."""
        try:
            categories = [
                'Costos y Finanzas\n(CF)',
                'Gestión y Planif.\n(GP)',
                'Marketing\n(M)',
                'Ventas\n(V)',
                'Talento y Pers.\n(TP)',
                'Recursos Hum.\n(RH)',
                'Economía Cuidado\n(EC)',
            ]
            valores = [
                estadisticas.promedio_cf,
                estadisticas.promedio_gp,
                estadisticas.promedio_m,
                estadisticas.promedio_v,
                estadisticas.promedio_tp,
                estadisticas.promedio_rh,
                estadisticas.promedio_ec,
            ]
            valores_loop = valores + valores[:1]
            num_vars = len(categories)
            angles = np.linspace(0, 2 * np.pi, num_vars, endpoint=False).tolist()
            angles += angles[:1]

            fig, ax = plt.subplots(figsize=(5.6, 5.0), subplot_kw=dict(projection='polar'))
            fig.patch.set_facecolor('white')
            ax.set_facecolor('white')

            # Escala concéntrica IMESUN
            ax.set_ylim(0, 100)
            ax.set_yticks([20, 40, 60, 80, 100])
            ax.set_yticklabels(['20', '40', '60', '80', '100'], fontsize=7.5, color='#64748B')
            ax.set_rlabel_position(22)

            # Rejilla suave sobre blanco
            ax.grid(True, color='#E2E8F0', linestyle='--', linewidth=0.8)
            ax.spines['polar'].set_color('#CBD5E1')
            ax.spines['polar'].set_linewidth(1.0)

            # Ejes
            ax.set_xticks(angles[:-1])
            ax.set_xticklabels(categories, fontsize=8.5, fontweight='bold', color='#1E293B')

            # Polígono institucional
            ax.plot(
                angles, valores_loop, 'o-', linewidth=2.2, color='#1E766F',
                markersize=6, markerfacecolor='#3AADA8', markeredgecolor='#1E766F', markeredgewidth=1.2
            )
            ax.fill(angles, valores_loop, color='#3AADA8', alpha=0.22)

            fig.tight_layout()
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
            temp_path = temp_file.name
            temp_file.close()
            fig.savefig(temp_path, dpi=180, bbox_inches='tight', facecolor='white', edgecolor='none')
            plt.close(fig)
            return temp_path
        except Exception as e:
            print(f"Error al generar gráfico radar para emprendedor: {e}")
            return None

    @staticmethod
    def _header_footer_emprendedor(canvas_obj: canvas.Canvas, doc):
        """Encabezado y pie de página limpios sobre fondo blanco puro (ahorro de tinta)."""
        canvas_obj.saveState()
        page_w, page_h = letter

        # Encabezado (superior)
        y_line = page_h - 40
        canvas_obj.setStrokeColor(colors.HexColor('#1E766F'))
        canvas_obj.setLineWidth(1.2)
        canvas_obj.line(45, y_line, page_w - 45, y_line)

        canvas_obj.setFont("Helvetica-Bold", 8)
        canvas_obj.setFillColor(colors.HexColor('#1E766F'))
        canvas_obj.drawString(45, y_line + 5, "INCUBADORA JCI EMPRESARIOS LA PAZ")

        canvas_obj.setFont("Helvetica", 8)
        canvas_obj.setFillColor(colors.HexColor('#64748B'))
        canvas_obj.drawRightString(page_w - 45, y_line + 5, "Informe Ejecutivo de Diagnóstico")

        # Pie de página (inferior)
        y_foot = 36
        canvas_obj.setStrokeColor(colors.HexColor('#E2E8F0'))
        canvas_obj.setLineWidth(0.8)
        canvas_obj.line(45, y_foot, page_w - 45, y_foot)

        canvas_obj.setFont("Helvetica", 7.5)
        canvas_obj.setFillColor(colors.HexColor('#64748B'))
        canvas_obj.drawString(45, y_foot - 12, "Programa Activa Mujer | Metodología IMESUN - OIT")
        canvas_obj.drawRightString(page_w - 45, y_foot - 12, f"Página {canvas_obj.getPageNumber()}")
        canvas_obj.restoreState()

    async def get_reporte_data_emprendedor(self, request: ReporteEmprendedorRequest) -> ReporteDataEmprendedor:
        try:
            # 1. Obtener usuario
            usuario_response = self.supabase.table("usuario") \
                .select("nombre, apellido") \
                .eq("id_usuario", request.id_emprendedor) \
                .execute()
                
            if not usuario_response.data or len(usuario_response.data) == 0:
                raise HTTPException(status_code=404, detail="Emprendedor no encontrado")
                
            usuario = usuario_response.data[0]
            
            # 2. Obtener emprendimiento
            emp_response = self.supabase.table("emprendimiento") \
                .select("nombre, rubro") \
                .eq("id_usuario", request.id_emprendedor) \
                .execute()
                
            emprendimiento = emp_response.data[0] if emp_response.data else {"nombre": "Sin registrar", "rubro": "N/A"}
            
            # 3. Obtener diagnósticos del emprendedor
            diagnosticos_response = self.supabase.table("diagnostico") \
                .select("*") \
                .eq("id_usuario", request.id_emprendedor) \
                .not_.is_("resultado", "null") \
                .order("fecha_inicio", desc=False) \
                .execute()
                
            if not diagnosticos_response.data or len(diagnosticos_response.data) == 0:
                raise HTTPException(status_code=404, detail="El emprendedor no tiene diagnósticos completados")
                
            diagnosticos = diagnosticos_response.data
            
            # 4. Construir timeline
            diag_timeline = []
            for d in diagnosticos:
                fecha_dt = datetime.fromisoformat(d["fecha_inicio"].replace('Z', '+00:00'))
                diag_timeline.append(DiagnosticoPorFecha(
                    fecha=fecha_dt,
                    promedio=float(d.get("puntaje_total", 0) or 0)
                ))
            
            # 5. Obtener el último diagnóstico para las notas y textos
            ultimo = diagnosticos[-1]
            estadisticas = EstadisticasGlobales(
                total_emprendedores=1,
                tasa_aprobado=100 if ultimo.get("resultado") in ["APROBADO", "EXIMIDO", "ACEPTADO"] else 0,
                promedio_cf=float(ultimo.get("puntaje_cf", 0) or 0),
                promedio_gp=float(ultimo.get("puntaje_gp", 0) or 0),
                promedio_m=float(ultimo.get("puntaje_m", 0) or 0),
                promedio_v=float(ultimo.get("puntaje_v", 0) or 0),
                promedio_tp=float(ultimo.get("puntaje_tp", 0) or 0),
                promedio_rh=float(ultimo.get("puntaje_rh", 0) or 0),
                promedio_ec=float(ultimo.get("puntaje_ec", 0) or 0),
                promedio_general=float(ultimo.get("puntaje_total", 0) or 0)
            )

            # 6. Parsear conclusión y recomendaciones del último diagnóstico
            raw_conclusion = ultimo.get("conclusion") or ""
            raw_recom = ultimo.get("recomendaciones") or ""

            diag_gen, fortalezas, debilidades = self._parse_conclusion(raw_conclusion)
            recs = self._parse_recomendaciones(raw_recom)

            fecha_diag = None
            if ultimo.get("fecha_inicio"):
                try:
                    fecha_diag = datetime.fromisoformat(ultimo["fecha_inicio"].replace('Z', '+00:00'))
                except:
                    fecha_diag = datetime.now()
            
            return ReporteDataEmprendedor(
                nombre_emprendedor=usuario["nombre"],
                apellido_emprendedor=usuario["apellido"],
                nombre_emprendimiento=emprendimiento.get("nombre") or "Emprendimiento",
                rubro=emprendimiento.get("rubro") or "General",
                resultado=ultimo.get("resultado") or "APROBADO",
                fecha_diagnostico=fecha_diag,
                diagnostico_general=diag_gen,
                fortalezas=fortalezas,
                debilidades=debilidades,
                recomendaciones=recs,
                estadisticas_actuales=estadisticas,
                diagnosticos_timeline=diag_timeline
            )
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error al obtener datos reporte individual: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error validando reporte individual: {str(e)}")

    async def generate_pdf_emprendedor(self, data: ReporteDataEmprendedor) -> bytes:
        """
        Genera el informe ejecutivo de diagnóstico para el emprendedor.
        Optimizado para impresión en hoja blanca con bajo consumo de tinta y estética formal institucional.
        """
        chart_radar = None
        try:
            chart_radar = self.generate_chart_radar_emprendedor(data.estadisticas_actuales)

            buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                buffer,
                pagesize=letter,
                topMargin=50,
                bottomMargin=48,
                leftMargin=45,
                rightMargin=45,
            )
            story = []

            # ── Estilos Tipográficos Especiales para Reporte Emprendedor ──
            styles = getSampleStyleSheet()

            style_doc_title = ParagraphStyle(
                'DocTitleEmp', parent=styles['Heading1'],
                fontSize=17, leading=21, textColor=colors.HexColor('#1B2A4A'),
                fontName='Helvetica-Bold', alignment=TA_LEFT, spaceAfter=2
            )
            style_doc_sub = ParagraphStyle(
                'DocSubEmp', parent=styles['Normal'],
                fontSize=8.5, leading=12, textColor=colors.HexColor('#64748B'),
                fontName='Helvetica', alignment=TA_LEFT, spaceAfter=12
            )
            style_sec_title = ParagraphStyle(
                'SecTitleEmp', parent=styles['Heading2'],
                fontSize=12, leading=15, textColor=colors.HexColor('#1E766F'),
                fontName='Helvetica-Bold', spaceBefore=10, spaceAfter=6, keepWithNext=True
            )
            style_sec_desc = ParagraphStyle(
                'SecDescEmp', parent=styles['Normal'],
                fontSize=8.5, leading=12, textColor=colors.HexColor('#64748B'),
                fontName='Helvetica', spaceAfter=8, keepWithNext=True
            )
            style_card_label = ParagraphStyle(
                'CardLbl', parent=styles['Normal'],
                fontSize=7.5, leading=10, textColor=colors.HexColor('#64748B'),
                fontName='Helvetica-Bold'
            )
            style_card_val = ParagraphStyle(
                'CardVal', parent=styles['Normal'],
                fontSize=9.5, leading=12, textColor=colors.HexColor('#1E293B'),
                fontName='Helvetica-Bold'
            )
            style_body = ParagraphStyle(
                'BodyEmp', parent=styles['Normal'],
                fontSize=8.5, leading=12.5, textColor=colors.HexColor('#334155'),
                fontName='Helvetica'
            )
            style_body_bold = ParagraphStyle(
                'BodyBoldEmp', parent=styles['Normal'],
                fontSize=8.5, leading=12.5, textColor=colors.HexColor('#1E293B'),
                fontName='Helvetica-Bold'
            )

            # ══════════════════════════════════════════════════════════
            # PÁGINA 1: FICHA DEL EMPRENDIMIENTO & DIAGNÓSTICO GENERAL
            # ══════════════════════════════════════════════════════════
            story.append(Paragraph("INFORME DE DIAGNÓSTICO DE LUCI IA", style_doc_title))
            story.append(Paragraph("Evaluación Integral de Madurez y Capacidades del Emprendimiento — Metodología IMESUN (OIT)", style_doc_sub))

            # Ficha de Emprendimiento & Dictamen Card (Fondo blanco, borde sutil)
            fecha_str = data.fecha_diagnostico.strftime('%d/%m/%Y') if data.fecha_diagnostico else datetime.now().strftime('%d/%m/%Y')
            score_general = round(data.estadisticas_actuales.promedio_general, 1)
            nivel_gral, nivel_gral_desc = self._get_imesun_nivel(score_general)

            color_resultado = colors.HexColor('#1E766F')  # APROBADO
            if data.resultado == "EXIMIDO":
                color_resultado = colors.HexColor('#00AEEF')
            elif data.resultado == "OBSERVADO":
                color_resultado = colors.HexColor('#C0392B')

            ficha_left = [
                [Paragraph("EMPRENDEDOR/A", style_card_label), Paragraph(f"{data.nombre_emprendedor} {data.apellido_emprendedor}", style_card_val)],
                [Paragraph("EMPRENDIMIENTO", style_card_label), Paragraph(data.nombre_emprendimiento, style_card_val)],
                [Paragraph("RUBRO", style_card_label), Paragraph(data.rubro, style_card_val)],
                [Paragraph("FECHA EVALUACIÓN", style_card_label), Paragraph(fecha_str, style_card_val)],
            ]
            tbl_left = Table(ficha_left, colWidths=[1.3 * inch, 2.3 * inch])
            tbl_left.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ]))

            badge_style = ParagraphStyle(
                'BadgeText', parent=styles['Normal'],
                fontSize=12, leading=14, textColor=color_resultado,
                fontName='Helvetica-Bold', alignment=TA_CENTER
            )
            score_style = ParagraphStyle(
                'ScoreText', parent=styles['Normal'],
                fontSize=20, leading=22, textColor=colors.HexColor('#1E293B'),
                fontName='Helvetica-Bold', alignment=TA_CENTER
            )
            score_lbl_style = ParagraphStyle(
                'ScoreLbl', parent=styles['Normal'],
                fontSize=7.5, leading=9, textColor=colors.HexColor('#64748B'),
                fontName='Helvetica-Bold', alignment=TA_CENTER
            )

            ficha_right = [
                [Paragraph("PUNTAJE GLOBAL", score_lbl_style)],
                [Paragraph(f"{score_general} <font size=10 color='#64748B'>/ 100</font>", score_style)],
                [Paragraph(data.resultado, badge_style)],
                [Paragraph(f"{nivel_gral}: {nivel_gral_desc}", score_lbl_style)],
            ]
            tbl_right = Table(ficha_right, colWidths=[2.2 * inch])
            tbl_right.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('TOPPADDING', (0, 0), (-1, -1), 2),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ]))

            ficha_main = Table([[tbl_left, tbl_right]], colWidths=[3.7 * inch, 2.3 * inch])
            ficha_main.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.white),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
                ('LINEBEFORE', (1, 0), (1, 0), 1, colors.HexColor('#E2E8F0')),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 8),
                ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(ficha_main)
            story.append(Spacer(1, 12))

            # Diagnóstico General de Madurez
            story.append(Paragraph("1. Diagnóstico General de Madurez", style_sec_title))
            clean_diag_gen = self._markdown_to_reportlab(data.diagnostico_general) or "Diagnóstico no disponible."
            
            box_diag = Table([[Paragraph(clean_diag_gen, style_body)]], colWidths=[6.0 * inch])
            box_diag.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.white),
                ('LINELEFT', (0, 0), (-1, -1), 3.5, colors.HexColor('#1E766F')),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ]))
            story.append(box_diag)
            story.append(Spacer(1, 12))

            # Rúbrica IMESUN Informativa (Fondo blanco, líneas sutiles)
            rubrica_title = ParagraphStyle(
                'RubTitle', parent=styles['Normal'],
                fontSize=8.5, leading=11, textColor=colors.HexColor('#1E766F'),
                fontName='Helvetica-Bold', spaceAfter=4
            )
            story.append(Paragraph("Marco de Referencia: Escala de Madurez Empresarial IMESUN (OIT)", rubrica_title))
            rubrica_rows = [
                [
                    Paragraph("<b>Nivel 1 (0 - 20 pts)</b><br/>Inicial / Crítico<br/><i>Dictamen: OBSERVADO</i>", style_body),
                    Paragraph("<b>Nivel 2 (21 - 40 pts)</b><br/>Básico / Vulnerable<br/><i>Dictamen: APROBADO</i>", style_body),
                    Paragraph("<b>Nivel 3 (41 - 60 pts)</b><br/>En Desarrollo<br/><i>Dictamen: APROBADO</i>", style_body),
                    Paragraph("<b>Nivel 4 (61 - 80 pts)</b><br/>Establecido / Avanzado<br/><i>Dictamen: APROBADO</i>", style_body),
                    Paragraph("<b>Nivel 5 (81 - 100 pts)</b><br/>Consolidado<br/><i>Dictamen: EXIMIDO</i>", style_body),
                ]
            ]
            tbl_rubrica = Table(rubrica_rows, colWidths=[1.2 * inch, 1.2 * inch, 1.2 * inch, 1.2 * inch, 1.2 * inch])
            tbl_rubrica.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.white),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (-1, -1), 4),
                ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ]))
            story.append(tbl_rubrica)

            # ══════════════════════════════════════════════════════════
            # PÁGINA 2: ANÁLISIS POR ÁREAS & GRÁFICO RADAR
            # ══════════════════════════════════════════════════════════
            story.append(PageBreak())
            story.append(Paragraph("2. Evaluación por Áreas de Gestión (Metodología IMESUN - OIT)", style_sec_title))
            story.append(Paragraph("Mapa integral de capacidades y desglose del rendimiento cuantitativo por dimensión estratégica.", style_sec_desc))

            # Gráfico de Telaraña (Radar)
            if chart_radar and os.path.exists(chart_radar):
                img_radar = Image(chart_radar, width=4.8 * inch, height=4.2 * inch)
                img_radar.hAlign = 'CENTER'
                story.append(img_radar)
                story.append(Spacer(1, 6))

            # Tabla de notas por área
            areas_data = [
                ('Costos y Finanzas', 'CF', data.estadisticas_actuales.promedio_cf),
                ('Gestión y Planificación', 'GP', data.estadisticas_actuales.promedio_gp),
                ('Marketing', 'M', data.estadisticas_actuales.promedio_m),
                ('Ventas', 'V', data.estadisticas_actuales.promedio_v),
                ('Talento y Personas', 'TP', data.estadisticas_actuales.promedio_tp),
                ('Recursos Humanos', 'RH', data.estadisticas_actuales.promedio_rh),
                ('Economía del Cuidado', 'EC', data.estadisticas_actuales.promedio_ec),
            ]

            table_rows = [
                [
                    Paragraph("<b>Área de Gestión</b>", style_body_bold),
                    Paragraph("<b>Cód.</b>", style_body_bold),
                    Paragraph("<b>Puntaje</b>", style_body_bold),
                    Paragraph("<b>Nivel IMESUN</b>", style_body_bold),
                    Paragraph("<b>Diagnóstico de Madurez</b>", style_body_bold),
                ]
            ]

            for nom, cod, pt in areas_data:
                niv, desc = self._get_imesun_nivel(pt)
                table_rows.append([
                    Paragraph(nom, style_body),
                    Paragraph(f"<b>{cod}</b>", style_body),
                    Paragraph(f"<b>{round(pt, 1)}</b> / 100", style_body),
                    Paragraph(niv, style_body),
                    Paragraph(desc, style_body),
                ])

            # Fila Total Promedio
            table_rows.append([
                Paragraph("<b>PUNTAJE GLOBAL PROMEDIO</b>", style_body_bold),
                Paragraph("-", style_body_bold),
                Paragraph(f"<b>{score_general}</b> / 100", style_body_bold),
                Paragraph(f"<b>{nivel_gral}</b>", style_body_bold),
                Paragraph(f"<b>Dictamen: {data.resultado}</b>", style_body_bold),
            ])

            tbl_scores = Table(table_rows, colWidths=[2.0 * inch, 0.5 * inch, 1.0 * inch, 1.0 * inch, 1.7 * inch])
            tbl_scores_style = [
                ('BACKGROUND', (0, 0), (-1, -1), colors.white),
                ('LINEBELOW', (0, 0), (-1, 0), 1.2, colors.HexColor('#1E766F')),
                ('LINEBELOW', (0, 1), (-1, -2), 0.5, colors.HexColor('#E2E8F0')),
                ('LINEABOVE', (0, -1), (-1, -1), 1.0, colors.HexColor('#1E766F')),
                ('LINEBELOW', (0, -1), (-1, -1), 1.0, colors.HexColor('#1E766F')),
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#F8FAFC')),
                ('TOPPADDING', (0, 0), (-1, -1), 3.5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]
            tbl_scores.setStyle(TableStyle(tbl_scores_style))
            story.append(tbl_scores)

            # ══════════════════════════════════════════════════════════
            # PÁGINA 3: PERFIL COMPETITIVO (FORTALEZAS & OPORTUNIDADES)
            # ══════════════════════════════════════════════════════════
            story.append(PageBreak())
            story.append(Paragraph("3. Perfil Competitivo del Emprendimiento", style_sec_title))
            story.append(Paragraph("Identificación de ventajas competitivas consolidadas y factores críticos de mejora.", style_sec_desc))

            # Fortalezas Principales
            lbl_fort = ParagraphStyle(
                'LblFort', parent=styles['Heading3'],
                fontSize=10.5, leading=13, textColor=colors.HexColor('#1E766F'),
                fontName='Helvetica-Bold', spaceBefore=4, spaceAfter=5, keepWithNext=True
            )
            story.append(Paragraph("Fortalezas Clave Identificadas", lbl_fort))

            if data.fortalezas:
                fort_cells = []
                for item in data.fortalezas:
                    area_part = f"<b>{self._clean_text_for_reportlab(item.area)}:</b> " if item.area else ""
                    txt_part = self._markdown_to_reportlab(item.texto)
                    fort_cells.append([
                        Paragraph("<font color='#1E766F'>•</font>", style_body_bold),
                        Paragraph(f"{area_part}{txt_part}", style_body)
                    ])
                tbl_fort = Table(fort_cells, colWidths=[0.25 * inch, 5.75 * inch])
                tbl_fort.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.white),
                    ('LINELEFT', (0, 0), (-1, -1), 3.0, colors.HexColor('#1E766F')),
                    ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ('LEFTPADDING', (0, 0), (-1, -1), 5),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ]))
                story.append(tbl_fort)
            else:
                story.append(Paragraph("No se registraron fortalezas específicas.", style_body))

            story.append(Spacer(1, 14))

            # Áreas Críticas de Oportunidad (Debilidades)
            lbl_deb = ParagraphStyle(
                'LblDeb', parent=styles['Heading3'],
                fontSize=10.5, leading=13, textColor=colors.HexColor('#D97706'),
                fontName='Helvetica-Bold', spaceBefore=4, spaceAfter=5, keepWithNext=True
            )
            story.append(Paragraph("Áreas Críticas de Oportunidad y Mejora", lbl_deb))

            if data.debilidades:
                deb_cells = []
                for item in data.debilidades:
                    area_part = f"<b>{self._clean_text_for_reportlab(item.area)}:</b> " if item.area else ""
                    txt_part = self._markdown_to_reportlab(item.texto)
                    deb_cells.append([
                        Paragraph("<font color='#D97706'>•</font>", style_body_bold),
                        Paragraph(f"{area_part}{txt_part}", style_body)
                    ])
                tbl_deb = Table(deb_cells, colWidths=[0.25 * inch, 5.75 * inch])
                tbl_deb.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), colors.white),
                    ('LINELEFT', (0, 0), (-1, -1), 3.0, colors.HexColor('#D97706')),
                    ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ('LEFTPADDING', (0, 0), (-1, -1), 5),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ]))
                story.append(tbl_deb)
            else:
                story.append(Paragraph("No se registraron áreas críticas de oportunidad.", style_body))

            # ══════════════════════════════════════════════════════════
            # PÁGINA 4: PLAN DE ACCIÓN Y RECOMENDACIONES PRIORITARIAS
            # ══════════════════════════════════════════════════════════
            story.append(PageBreak())
            story.append(Paragraph("4. Plan de Acción y Recomendaciones Prioritarias", style_sec_title))
            story.append(Paragraph("Hoja de ruta sugerida con acciones concretas para acelerar la madurez del negocio.", style_sec_desc))

            style_rec_title = ParagraphStyle(
                'RecTitle', parent=styles['Normal'],
                fontSize=9.5, leading=12, textColor=colors.HexColor('#1E766F'),
                fontName='Helvetica-Bold'
            )

            if data.recomendaciones:
                for idx, rec in enumerate(data.recomendaciones, 1):
                    rec_content = []
                    titulo_clean = self._clean_text_for_reportlab(rec.titulo)
                    rec_content.append(Paragraph(f"<b>Recomendación {idx}: {titulo_clean}</b>", style_rec_title))

                    if rec.objetivo:
                        obj_clean = self._markdown_to_reportlab(rec.objetivo)
                        rec_content.append(Paragraph(f"<b>Objetivo:</b> {obj_clean}", style_body))

                    if rec.acciones:
                        acciones_p = []
                        for a in rec.acciones:
                            a_clean = self._markdown_to_reportlab(a)
                            acciones_p.append(f"• {a_clean}")
                        acciones_str = "<br/>".join(acciones_p)
                        rec_content.append(Paragraph(f"<b>Acciones sugeridas:</b><br/>{acciones_str}", style_body))

                    if rec.impacto:
                        imp_clean = self._markdown_to_reportlab(rec.impacto)
                        rec_content.append(Paragraph(f"<b>Impacto esperado:</b> {imp_clean}", style_body))

                    rec_box = Table([[c] for c in rec_content], colWidths=[6.0 * inch])
                    rec_box.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, -1), colors.white),
                        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
                        ('LINEABOVE', (0, 0), (-1, 0), 1.8, colors.HexColor('#1E766F')),
                        ('TOPPADDING', (0, 0), (-1, -1), 3),
                        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                        ('LEFTPADDING', (0, 0), (-1, -1), 8),
                        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
                    ]))
                    story.append(rec_box)
                    story.append(Spacer(1, 8))
            else:
                story.append(Paragraph("No se encontraron recomendaciones estructuradas en el diagnóstico.", style_body))

            story.append(Spacer(1, 10))

            # Cuadro Institucional de Cierre
            cierre_p = Paragraph(
                "<i>Este informe de diagnóstico ha sido generado por la Incubadora de Emprendimientos de JCI Empresarios La Paz en el marco del Programa Activa Mujer. Para profundizar en la ejecución de este plan de acción y acceder a acompañamiento técnico individualizado, coordina tus sesiones de seguimiento con la coordinación del programa.</i>",
                ParagraphStyle('CierreP', parent=styles['Normal'], fontSize=7.5, leading=10.5, textColor=colors.HexColor('#64748B'), alignment=TA_CENTER)
            )
            tbl_cierre = Table([[cierre_p]], colWidths=[6.0 * inch])
            tbl_cierre.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.white),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ]))
            story.append(tbl_cierre)

            # Compilar PDF
            doc.build(story, onFirstPage=self._header_footer_emprendedor, onLaterPages=self._header_footer_emprendedor)

            # Limpiar archivo temporal de radar
            if chart_radar and os.path.exists(chart_radar):
                try:
                    os.remove(chart_radar)
                except:
                    pass

            pdf_bytes = buffer.getvalue()
            buffer.close()
            return pdf_bytes

        except Exception as e:
            if chart_radar and os.path.exists(chart_radar):
                try:
                    os.remove(chart_radar)
                except:
                    pass
            print(f"Error al generar PDF individual: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error al generar PDF individual: {str(e)}")


    # ══════════════════════════════════════════════════════════════
    # REPORTE DE MENTOR ESPECÍFICO
    # ══════════════════════════════════════════════════════════════

    async def get_reporte_data_mentor(self, id_mentor: str) -> ReporteDataMentor:
        """Obtiene todos los datos históricos de los emprendedores de un mentor."""
        try:
            # 1. Datos del mentor
            mentor_resp = self.supabase.table("usuario") \
                .select("nombre, apellido") \
                .eq("id_usuario", id_mentor) \
                .execute()
            if not mentor_resp.data:
                raise HTTPException(status_code=404, detail="Mentor no encontrado")
            mentor = mentor_resp.data[0]

            # 2. Emprendedores asignados (activos o históricos)
            asig_resp = self.supabase.table("asignacion_mentor") \
                .select("id_emprendedor") \
                .eq("id_mentor", id_mentor) \
                .execute()
            if not asig_resp.data:
                raise HTTPException(status_code=404, detail="Este mentor no tiene emprendedores asignados")

            emp_ids = list({a["id_emprendedor"] for a in asig_resp.data})

            # 3. Todos los diagnósticos completados
            diag_resp = self.supabase.table("diagnostico") \
                .select("*") \
                .in_("id_usuario", emp_ids) \
                .not_.is_("resultado", "null") \
                .order("fecha_inicio", desc=False) \
                .execute()

            diagnosticos = diag_resp.data or []

            # 4. Usuarios y emprendimientos
            usuarios_resp = self.supabase.table("usuario") \
                .select("id_usuario, nombre, apellido") \
                .in_("id_usuario", emp_ids) \
                .execute()
            usuarios_dict = {u["id_usuario"]: u for u in (usuarios_resp.data or [])}

            emp_resp = self.supabase.table("emprendimiento") \
                .select("id_usuario, nombre") \
                .in_("id_usuario", emp_ids) \
                .execute()
            emp_dict = {e["id_usuario"]: e["nombre"] for e in (emp_resp.data or [])}

            # 5. Calcular estadísticas por emprendedor
            emprendedores = []
            diag_timeline = []

            for emp_id in emp_ids:
                emp_diags = [d for d in diagnosticos if d["id_usuario"] == emp_id]
                if not emp_diags:
                    continue

                areas_sum = {k: 0.0 for k in ["cf", "gp", "m", "v", "tp", "rh", "ec"]}
                total = len(emp_diags)

                for d in emp_diags:
                    diag_timeline.append(DiagnosticoPorFecha(
                        fecha=datetime.fromisoformat(d["fecha_inicio"].replace('Z', '+00:00')),
                        promedio=d.get("puntaje_total", 0) or 0
                    ))
                    for area in areas_sum:
                        areas_sum[area] += d.get(f"puntaje_{area}", 0) or 0

                u = usuarios_dict.get(emp_id, {})
                emprendedores.append(EmprendedorReporte(
                    nombre=u.get("nombre", "N/A"),
                    apellido=u.get("apellido", "N/A"),
                    emprendimiento=emp_dict.get(emp_id, "N/A"),
                    promedio_general=round(sum(areas_sum.values()) / (total * 7), 1),
                    promedio_cf=round(areas_sum["cf"] / total, 1),
                    promedio_gp=round(areas_sum["gp"] / total, 1),
                    promedio_m=round(areas_sum["m"] / total, 1),
                    promedio_v=round(areas_sum["v"] / total, 1),
                    promedio_tp=round(areas_sum["tp"] / total, 1),
                    promedio_rh=round(areas_sum["rh"] / total, 1),
                    promedio_ec=round(areas_sum["ec"] / total, 1),
                    num_diagnosticos=total,
                ))

            if not emprendedores:
                raise HTTPException(status_code=404, detail="No hay diagnósticos registrados para los emprendedores de este mentor")

            # 6. Estadísticas globales del grupo
            n = len(emprendedores)
            
            # Obtener el último diagnóstico válido por emprendedor
            latest_map = {}
            for d in diagnosticos:
                uid = d.get("id_usuario")
                if not uid or d.get("resultado") not in ("ACEPTADO", "APROBADO", "EXIMIDO", "RECHAZADO", "OBSERVADO"):
                    continue
                if uid not in latest_map:
                    latest_map[uid] = d
                else:
                    fecha_curr = d.get("fecha_inicio")
                    fecha_prev = latest_map[uid].get("fecha_inicio")
                    if fecha_curr and fecha_prev and str(fecha_curr) > str(fecha_prev):
                        latest_map[uid] = d
            
            diagnosticos_valido = list(latest_map.values())
            aceptados = len([d for d in diagnosticos_valido if d.get("resultado") in ("ACEPTADO", "APROBADO", "EXIMIDO")])
            tasa = round(aceptados / len(diagnosticos_valido) * 100, 1) if diagnosticos_valido else 0

            estadisticas = EstadisticasGlobales(
                total_emprendedores=n,
                tasa_aprobado=tasa,
                promedio_cf=round(sum(e.promedio_cf for e in emprendedores) / n, 1),
                promedio_gp=round(sum(e.promedio_gp for e in emprendedores) / n, 1),
                promedio_m=round(sum(e.promedio_m for e in emprendedores) / n, 1),
                promedio_v=round(sum(e.promedio_v for e in emprendedores) / n, 1),
                promedio_tp=round(sum(e.promedio_tp for e in emprendedores) / n, 1),
                promedio_rh=round(sum(e.promedio_rh for e in emprendedores) / n, 1),
                promedio_ec=round(sum(e.promedio_ec for e in emprendedores) / n, 1),
                promedio_general=round(sum(e.promedio_general for e in emprendedores) / n, 1),
            )

            diag_timeline_sorted = sorted(diag_timeline, key=lambda x: x.fecha)

            return ReporteDataMentor(
                mentor_nombre=mentor["nombre"],
                mentor_apellido=mentor["apellido"],
                fecha_generacion=datetime.now(),
                emprendedores=emprendedores,
                estadisticas=estadisticas,
                diagnosticos_timeline=diag_timeline_sorted,
            )

        except HTTPException:
            raise
        except Exception as e:
            print(f"Error get_reporte_data_mentor: {e}")
            raise HTTPException(status_code=500, detail=f"Error al obtener datos del mentor: {str(e)}")

    async def generate_pdf_mentor(self, data: ReporteDataMentor) -> bytes:
        """Genera el PDF del reporte de un mentor específico."""
        try:
            chart_bars = self.generate_chart_bars(data.estadisticas)
            chart_line = self.generate_chart_line(data.diagnosticos_timeline)

            buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                buffer, pagesize=letter,
                topMargin=65, bottomMargin=55, leftMargin=50, rightMargin=50,
            )
            story = []
            s = self._get_styles()

            # ── Portada ──────────────────────────────────────────────
            story.append(Spacer(1, 1.8 * inch))
            cover_title = ParagraphStyle(
                'CoverTitle', parent=s['base']['Heading1'], fontSize=26,
                textColor=self.TEAL, fontName='Helvetica-Bold',
                alignment=TA_CENTER, spaceAfter=12,
            )
            cover_sub = ParagraphStyle(
                'CoverSub', parent=s['base']['Normal'], fontSize=14,
                textColor=self.DARK_GRAY, fontName='Helvetica',
                alignment=TA_CENTER, spaceAfter=6,
            )
            story.append(Paragraph("REPORTE DE MENTOR", cover_title))
            story.append(Paragraph("Incubadora JCI Empresarios La Paz", cover_sub))
            story.append(Spacer(1, 0.6 * inch))

            line_table = Table([['']], colWidths=[4 * inch], rowHeights=[2])
            line_table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), self.TEAL)]))
            line_wrapper = Table([[line_table]], colWidths=[doc.width])
            line_wrapper.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
            story.append(line_wrapper)
            story.append(Spacer(1, 0.6 * inch))

            cover_data = [
                ['Mentor', f"{data.mentor_nombre} {data.mentor_apellido}"],
                ['Emprendedores a cargo', str(data.estadisticas.total_emprendedores)],
                ['Promedio general del grupo', str(data.estadisticas.promedio_general)],
                ['Tasa de aprobado del grupo', f"{data.estadisticas.tasa_aprobado} %"],
                ['Fecha de generación', data.fecha_generacion.strftime('%d/%m/%Y %H:%M')],
            ]
            story.append(self._build_label_value_table(cover_data, col_widths=[2.5 * inch, 3.5 * inch]))

            # ── Sección 1: Resumen de emprendedores ─────────────────
            story.append(PageBreak())
            story.append(Paragraph("1. EMPRENDEDORES A CARGO", s['section']))
            story.append(Paragraph(
                "Listado de los emprendedores asignados al mentor con sus indicadores de desempeño histórico.",
                s['body']))
            story.append(Spacer(1, 0.1 * inch))

            header_row = ['Emprendedor', 'Emprendimiento', 'Nº Diag.', 'Prom.', 'CF', 'GP', 'M', 'V', 'TP', 'RH', 'EC']
            emp_rows = [header_row]
            for emp in data.emprendedores:
                emp_rows.append([
                    f'{emp.nombre} {emp.apellido}',
                    emp.emprendimiento or 'N/A',
                    str(emp.num_diagnosticos),
                    str(emp.promedio_general),
                    str(emp.promedio_cf), str(emp.promedio_gp), str(emp.promedio_m),
                    str(emp.promedio_v), str(emp.promedio_tp), str(emp.promedio_rh), str(emp.promedio_ec),
                ])

            col_w = [1.3*inch, 1.2*inch, 0.45*inch, 0.45*inch,
                     0.38*inch, 0.38*inch, 0.38*inch, 0.38*inch, 0.38*inch, 0.38*inch, 0.38*inch]
            emp_table = Table(emp_rows, colWidths=col_w)
            emp_style = [
                ('BACKGROUND', (0, 0), (-1, 0), self.TEAL),
                ('TEXTCOLOR', (0, 0), (-1, 0), self.WHITE),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 7.5),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
            ]
            for i in range(1, len(emp_rows), 2):
                emp_style.append(('BACKGROUND', (0, i), (-1, i), self.LIGHT_GRAY_ROW))
            emp_table.setStyle(TableStyle(emp_style))
            story.append(emp_table)

            # ── Sección 2: Promedios por área ───────────────────────
            story.append(PageBreak())
            story.append(Paragraph("2. PROMEDIOS POR ÁREA DEL GRUPO", s['section']))
            story.append(Paragraph(
                "Puntaje promedio obtenido por el grupo de emprendedores en cada área de evaluación.",
                s['body']))

            stats_rows = [
                ['Costos y Finanzas (CF)', str(data.estadisticas.promedio_cf)],
                ['Gestión y Producción (GP)', str(data.estadisticas.promedio_gp)],
                ['Marketing (M)', str(data.estadisticas.promedio_m)],
                ['Ventas (V)', str(data.estadisticas.promedio_v)],
                ['Talento y Personas (TP)', str(data.estadisticas.promedio_tp)],
                ['Recursos Humanos (RH)', str(data.estadisticas.promedio_rh)],
                ['Economía del Cuidado (EC)', str(data.estadisticas.promedio_ec)],
            ]
            story.append(self._build_label_value_table(stats_rows))
            story.append(Spacer(1, 0.15 * inch))

            summary_data = [['PROMEDIO GENERAL DEL GRUPO', str(data.estadisticas.promedio_general)]]
            summary_tbl = Table(summary_data, colWidths=[2.8 * inch, 3.5 * inch])
            summary_tbl.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), self.TEAL),
                ('TEXTCOLOR', (0, 0), (-1, -1), self.WHITE),
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 11),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('LEFTPADDING', (0, 0), (-1, -1), 12),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(summary_tbl)

            if chart_bars:
                story.append(Spacer(1, 0.25 * inch))
                story.append(Paragraph("2.1 Gráfico de promedios por área", s['subsection']))
                story.append(Image(chart_bars, width=6.2 * inch, height=3.3 * inch))

            # ── Sección 3: Evolución histórica ──────────────────────
            if chart_line:
                story.append(PageBreak())
                story.append(Paragraph("3. EVOLUCIÓN HISTÓRICA DEL GRUPO", s['section']))
                story.append(Paragraph(
                    "Evolución del puntaje promedio del grupo a lo largo del tiempo.", s['body']))
                story.append(Spacer(1, 0.2 * inch))
                story.append(Image(chart_line, width=6.2 * inch, height=3.3 * inch))

            doc.build(story, onFirstPage=self._header_footer, onLaterPages=self._header_footer)

            for chart_file in [chart_bars, chart_line]:
                if chart_file and os.path.exists(chart_file):
                    try:
                        os.remove(chart_file)
                    except:
                        pass

            pdf_bytes = buffer.getvalue()
            buffer.close()
            return pdf_bytes

        except Exception as e:
            print(f"Error generate_pdf_mentor: {e}")
            raise HTTPException(status_code=500, detail=f"Error al generar PDF mentor: {str(e)}")

    # ══════════════════════════════════════════════════════════════
    # REPORTE COMPARATIVO DE TODOS LOS MENTORES
    # ══════════════════════════════════════════════════════════════

    async def get_reporte_data_todos_mentores(self, admin_id: Optional[str] = None, id_programa: Optional[int] = None) -> ReporteDataTodosMentores:
        """Obtiene estadísticas agrupadas por mentor para el reporte comparativo (Spec 003)."""
        try:
            from app.services.org_filter import get_admin_org_user_ids

            nombre_programa = "Consolidado - Todos los programas"
            if id_programa:
                try:
                    p_res = self.supabase.table("programa").select("nombre").eq("id_programa", id_programa).execute()
                    if isinstance(p_res.data, list) and len(p_res.data) > 0 and isinstance(p_res.data[0], dict) and p_res.data[0].get("nombre"):
                        nombre_programa = str(p_res.data[0]["nombre"])
                    else:
                        nombre_programa = f"Programa {id_programa}"
                except Exception:
                    nombre_programa = f"Programa {id_programa}"

            # 1. Mentores activos (filtrados por organización si se especifica admin_id)
            ment_query = self.supabase.table("usuario") \
                .select("id_usuario, nombre, apellido") \
                .eq("id_rol", 3) \
                .eq("estado", True)

            org_users = None
            if admin_id:
                org_users = get_admin_org_user_ids(admin_id, self.supabase)
                if org_users is not None:
                    if len(org_users) == 0:
                        ment_query = ment_query.in_("id_usuario", ["00000000-0000-0000-0000-000000000000"])
                    else:
                        ment_query = ment_query.in_("id_usuario", org_users)

            if id_programa:
                # Filtrar solo mentores enrolados en el programa
                prog_m_res = self.supabase.table("usuario_programa") \
                    .select("id_usuario") \
                    .eq("id_programa", id_programa) \
                    .execute()
                prog_m_ids = [p["id_usuario"] for p in (prog_m_res.data or [])]
                ment_query = ment_query.in_("id_usuario", prog_m_ids if prog_m_ids else ["00000000-0000-0000-0000-000000000000"])

            mentores_resp = ment_query.execute()
            if not mentores_resp.data:
                return ReporteDataTodosMentores(
                    fecha_generacion=datetime.now(),
                    nombre_programa=nombre_programa,
                    mentores=[]
                )

            mentores_raw = mentores_resp.data
            mentor_ids = [m["id_usuario"] for m in mentores_raw]

            # 2. Asignaciones
            asig_resp = self.supabase.table("asignacion_mentor") \
                .select("id_mentor, id_emprendedor") \
                .in_("id_mentor", mentor_ids) \
                .execute()
            asignaciones = asig_resp.data or []

            # Si hay id_programa, filtrar emprendedores que también pertenezcan a ese programa
            if id_programa:
                emp_in_p = self.supabase.table("usuario_programa") \
                    .select("id_usuario") \
                    .eq("id_programa", id_programa) \
                    .execute()
                valid_p_emps = {u["id_usuario"] for u in (emp_in_p.data or [])}
                asignaciones = [a for a in asignaciones if a["id_emprendedor"] in valid_p_emps]

            # Mapa mentor → emprendedores
            mentor_emp_map: dict = {m["id_usuario"]: [] for m in mentores_raw}
            for a in asignaciones:
                mid = a["id_mentor"]
                if mid in mentor_emp_map:
                    mentor_emp_map[mid].append(a["id_emprendedor"])

            all_emp_ids = list({e for emps in mentor_emp_map.values() for e in emps})

            diag_by_emp: dict = {}
            if all_emp_ids:
                diag_resp = self.supabase.table("diagnostico") \
                    .select("*") \
                    .in_("id_usuario", all_emp_ids) \
                    .not_.is_("resultado", "null") \
                    .execute()
                diagnosticos = diag_resp.data or []
                for d in diagnosticos:
                    eid = d.get("id_usuario")
                    if eid:
                        diag_by_emp.setdefault(eid, []).append(d)

            # 4. Calcular estadísticas por mentor (con corrección de bug 'n')
            resultados = []
            for m in mentores_raw:
                mid = m["id_usuario"]
                emp_ids_m = mentor_emp_map.get(mid, [])
                if not emp_ids_m:
                    continue

                all_diags_m = [d for eid in emp_ids_m for d in diag_by_emp.get(eid, [])]
                if not all_diags_m:
                    continue

                # Obtener el último diagnóstico válido por emprendedor
                latest_map = {}
                for d in all_diags_m:
                    uid = d.get("id_usuario")
                    if not uid or d.get("resultado") not in ("ACEPTADO", "APROBADO", "EXIMIDO", "RECHAZADO", "OBSERVADO"):
                        continue
                    if uid not in latest_map:
                        latest_map[uid] = d
                    else:
                        fecha_curr = d.get("fecha_inicio")
                        fecha_prev = latest_map[uid].get("fecha_inicio")
                        if fecha_curr and fecha_prev and str(fecha_curr) > str(fecha_prev):
                            latest_map[uid] = d

                diags_validas = list(latest_map.values())
                n_validas = len(diags_validas)
                n = n_validas  # Bug fix: n ahora siempre está definido

                if n > 0:
                    areas = {k: 0.0 for k in ["cf", "gp", "m", "v", "tp", "rh", "ec"]}
                    for d in diags_validas:
                        for area in areas:
                            areas[area] += float(d.get(f"puntaje_{area}", 0) or 0)

                    aceptados = len([d for d in diags_validas if d.get("resultado") in ("ACEPTADO", "APROBADO", "EXIMIDO")])
                    tasa = round(aceptados / n * 100, 1)
                    prom_general = round(sum(areas.values()) / (n * 7), 1)

                    resultados.append(MentorResumenReporte(
                        nombre=m["nombre"],
                        apellido=m["apellido"],
                        total_emprendedores=len(emp_ids_m),
                        promedio_general=prom_general,
                        promedio_cf=round(areas["cf"] / n, 1),
                        promedio_gp=round(areas["gp"] / n, 1),
                        promedio_m=round(areas["m"] / n, 1),
                        promedio_v=round(areas["v"] / n, 1),
                        promedio_tp=round(areas["tp"] / n, 1),
                        promedio_rh=round(areas["rh"] / n, 1),
                        promedio_ec=round(areas["ec"] / n, 1),
                        tasa_aprobado=tasa,
                    ))

            return ReporteDataTodosMentores(
                fecha_generacion=datetime.now(),
                nombre_programa=nombre_programa,
                mentores=resultados,
            )

        except HTTPException:
            raise
        except Exception as e:
            print(f"Error get_reporte_data_todos_mentores: {e}")
            raise HTTPException(status_code=500, detail=f"Error al obtener datos de mentores: {str(e)}")

    def _generate_chart_bars_mentores(self, mentores: list) -> str:
        """Gráfico de barras comparativo de promedios generales por mentor."""
        try:
            nombres = [f"{m.nombre}\n{m.apellido}" for m in mentores]
            valores = [m.promedio_general for m in mentores]
            bar_colors = ['#1E766F' if i % 2 == 0 else '#3AADA8' for i in range(len(nombres))]

            fig, ax = plt.subplots(figsize=(max(8, len(nombres) * 1.5), 5))
            bars = ax.bar(nombres, valores, color=bar_colors, width=0.6, edgecolor='white')
            for bar, val in zip(bars, valores):
                ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 1.5,
                        f'{val}', ha='center', va='bottom', fontsize=9,
                        fontweight='bold', color='#374151')

            ax.set_ylabel('Promedio General', fontsize=11, color='#374151')
            ax.set_ylim(0, max(valores) * 1.25 if max(valores) > 0 else 100)
            ax.spines['top'].set_visible(False)
            ax.spines['right'].set_visible(False)
            ax.spines['left'].set_color('#D1D5DB')
            ax.spines['bottom'].set_color('#D1D5DB')
            ax.tick_params(colors='#374151', labelsize=8)
            ax.yaxis.grid(True, alpha=0.3, color='#9CA3AF')
            ax.set_axisbelow(True)
            fig.tight_layout()

            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.png')
            fig.savefig(temp_file.name, dpi=150, bbox_inches='tight', facecolor='white', edgecolor='none')
            plt.close(fig)
            return temp_file.name
        except Exception as e:
            print(f"Error generando gráfico mentores: {e}")
            return None

    async def generate_pdf_todos_mentores(self, data: ReporteDataTodosMentores) -> bytes:
        """Genera el PDF comparativo de todos los mentores."""
        try:
            chart_bars = self._generate_chart_bars_mentores(data.mentores)

            buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                buffer, pagesize=letter,
                topMargin=65, bottomMargin=55, leftMargin=50, rightMargin=50,
            )
            story = []
            s = self._get_styles()

            # ── Portada ──────────────────────────────────────────────
            story.append(Spacer(1, 1.8 * inch))
            cover_title = ParagraphStyle(
                'CoverTitle', parent=s['base']['Heading1'], fontSize=26,
                textColor=self.TEAL, fontName='Helvetica-Bold',
                alignment=TA_CENTER, spaceAfter=12,
            )
            cover_sub = ParagraphStyle(
                'CoverSub', parent=s['base']['Normal'], fontSize=14,
                textColor=self.DARK_GRAY, fontName='Helvetica',
                alignment=TA_CENTER, spaceAfter=6,
            )
            story.append(Paragraph("REPORTE COMPARATIVO DE MENTORES", cover_title))
            story.append(Paragraph("Incubadora JCI Empresarios La Paz", cover_sub))
            story.append(Spacer(1, 0.6 * inch))

            line_table = Table([['']], colWidths=[4 * inch], rowHeights=[2])
            line_table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), self.TEAL)]))
            line_wrapper = Table([[line_table]], colWidths=[doc.width])
            line_wrapper.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
            story.append(line_wrapper)
            story.append(Spacer(1, 0.6 * inch))

            cover_data = [
                ['Total de mentores evaluados', str(len(data.mentores))],
                ['Fecha de generación', data.fecha_generacion.strftime('%d/%m/%Y %H:%M')],
            ]
            story.append(self._build_label_value_table(cover_data, col_widths=[2.5 * inch, 3.5 * inch]))

            # ── Sección 1: Tabla comparativa ────────────────────────
            story.append(PageBreak())
            story.append(Paragraph("1. RENDIMIENTO COMPARATIVO POR MENTOR", s['section']))
            story.append(Paragraph(
                "La siguiente tabla muestra el desempeño de cada mentor a partir de los "
                "indicadores obtenidos por sus emprendedores a cargo.",
                s['body']))
            story.append(Spacer(1, 0.1 * inch))

            header = ['Mentor', 'Emprend.', 'Prom.', 'Aprobado%', 'CF', 'GP', 'M', 'V', 'TP', 'RH', 'EC']
            rows = [header]
            for m in data.mentores:
                rows.append([
                    f"{m.nombre} {m.apellido}",
                    str(m.total_emprendedores),
                    str(m.promedio_general),
                    f"{m.tasa_aprobado}%",
                    str(m.promedio_cf), str(m.promedio_gp), str(m.promedio_m),
                    str(m.promedio_v), str(m.promedio_tp), str(m.promedio_rh), str(m.promedio_ec),
                ])

            col_w = [1.4*inch, 0.55*inch, 0.48*inch, 0.52*inch,
                     0.38*inch, 0.38*inch, 0.38*inch, 0.38*inch, 0.38*inch, 0.38*inch, 0.38*inch]
            tbl = Table(rows, colWidths=col_w)
            tbl_style = [
                ('BACKGROUND', (0, 0), (-1, 0), self.TEAL),
                ('TEXTCOLOR', (0, 0), (-1, 0), self.WHITE),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 8),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 7.5),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.HexColor('#D1D5DB')),
            ]
            for i in range(1, len(rows), 2):
                tbl_style.append(('BACKGROUND', (0, i), (-1, i), self.LIGHT_GRAY_ROW))
            tbl.setStyle(TableStyle(tbl_style))
            story.append(tbl)

            # ── Sección 2: Gráfico comparativo ──────────────────────
            if chart_bars:
                story.append(PageBreak())
                story.append(Paragraph("2. GRÁFICO COMPARATIVO — PROMEDIO GENERAL POR MENTOR", s['section']))
                story.append(Paragraph(
                    "Comparación visual del promedio general de cada mentor basado en el "
                    "desempeño histórico de sus emprendedores.", s['body']))
                story.append(Spacer(1, 0.2 * inch))
                story.append(Image(chart_bars, width=6.2 * inch, height=3.5 * inch))

            doc.build(story, onFirstPage=self._header_footer, onLaterPages=self._header_footer)

            if chart_bars and os.path.exists(chart_bars):
                try:
                    os.remove(chart_bars)
                except:
                    pass

            pdf_bytes = buffer.getvalue()
            buffer.close()
            return pdf_bytes

        except Exception as e:
            print(f"Error generate_pdf_todos_mentores: {e}")
            raise HTTPException(status_code=500, detail=f"Error al generar PDF mentores: {str(e)}")


reporte_service = ReporteService()
