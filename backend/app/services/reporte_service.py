"""
Servicio de Generación de Reportes
Maneja la creación de reportes PDF con gráficos
"""
import io
import os
import tempfile
from datetime import datetime
from typing import List
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
        Obtiene todos los datos necesarios para generar el reporte
        """
        try:
            # 1. Obtener información del mentor
            mentor_response = self.supabase.table("usuario") \
                .select("nombre, apellido") \
                .eq("id_usuario", request.id_mentor) \
                .execute()
            
            if not mentor_response.data or len(mentor_response.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Mentor no encontrado"
                )
            
            mentor = mentor_response.data[0]
            
            # 2. Obtener emprendedores asignados
            asignaciones_response = self.supabase.table("asignacion_mentor") \
                .select("id_emprendedor") \
                .eq("id_mentor", request.id_mentor) \
                .execute()
            
            if not asignaciones_response.data or len(asignaciones_response.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No hay emprendedores asignados a este mentor"
                )
            
            emprendedor_ids = [asig["id_emprendedor"] for asig in asignaciones_response.data]
            
            # 3. Obtener diagnósticos en el rango de fechas
            diagnosticos_response = self.supabase.table("diagnostico") \
                .select("*") \
                .in_("id_usuario", emprendedor_ids) \
                .gte("fecha_inicio", request.fecha_inicio.isoformat()) \
                .lte("fecha_inicio", request.fecha_fin.isoformat()) \
                .execute()
            
            if not diagnosticos_response.data or len(diagnosticos_response.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No hay diagnósticos en el rango de fechas especificado"
                )
            
            diagnosticos = diagnosticos_response.data
            
            # 4. Obtener detalles de diagnósticos
            diag_ids = [d["id_diagnostico"] for d in diagnosticos]
            detalles_response = self.supabase.table("detalle_diagnostico") \
                .select("*") \
                .in_("id_diagnostico", diag_ids) \
                .execute()
            
            detalles = detalles_response.data if detalles_response.data else []
            
            # 5. Obtener información de usuarios (emprendedores)
            usuarios_response = self.supabase.table("usuario") \
                .select("id_usuario, nombre, apellido") \
                .in_("id_usuario", emprendedor_ids) \
                .execute()
            
            usuarios_dict = {u["id_usuario"]: u for u in usuarios_response.data}
            
            # 6. Obtener emprendimientos
            emprendimientos_response = self.supabase.table("emprendimiento") \
                .select("id_usuario, nombre") \
                .in_("id_usuario", emprendedor_ids) \
                .execute()
            
            emprendimientos_dict = {e["id_usuario"]: e["nombre"] 
                                   for e in emprendimientos_response.data} if emprendimientos_response.data else {}
            
            # 7. Calcular estadísticas por emprendedor
            emprendedores = []
            diag_timeline = []
            
            for emp_id in emprendedor_ids:
                emp_diagnosticos = [d for d in diagnosticos if d["id_usuario"] == emp_id]
                
                if len(emp_diagnosticos) == 0:
                    continue
                
                # Promedios por área
                areas_sum = {"cf": 0, "gp": 0, "m": 0, "v": 0, "tp": 0, "rh": 0, "ec": 0}
                total_diags = len(emp_diagnosticos)
                
                for diag in emp_diagnosticos:
                    # Agregar a timeline
                    diag_timeline.append(DiagnosticoPorFecha(
                        fecha=datetime.fromisoformat(diag["fecha_inicio"].replace('Z', '+00:00')),
                        promedio=diag["puntaje_total"]
                    ))
                    
                    # Sumar puntajes
                    areas_sum["cf"] += diag.get("puntaje_cf", 0)
                    areas_sum["gp"] += diag.get("puntaje_gp", 0)
                    areas_sum["m"] += diag.get("puntaje_m", 0)
                    areas_sum["v"] += diag.get("puntaje_v", 0)
                    areas_sum["tp"] += diag.get("puntaje_tp", 0)
                    areas_sum["rh"] += diag.get("puntaje_rh", 0)
                    areas_sum["ec"] += diag.get("puntaje_ec", 0)
                
                usuario = usuarios_dict.get(emp_id, {})
                emprendimiento = emprendimientos_dict.get(emp_id, "N/A")
                
                promedio_general = sum([
                    areas_sum["cf"], areas_sum["gp"], areas_sum["m"],
                    areas_sum["v"], areas_sum["tp"], areas_sum["rh"], areas_sum["ec"]
                ]) / (total_diags * 7) if total_diags > 0 else 0
                
                emprendedores.append(EmprendedorReporte(
                    nombre=usuario.get("nombre", "N/A"),
                    apellido=usuario.get("apellido", "N/A"),
                    emprendimiento=emprendimiento,
                    promedio_general=round(promedio_general, 1),
                    promedio_cf=round(areas_sum["cf"] / total_diags, 1) if total_diags > 0 else 0,
                    promedio_gp=round(areas_sum["gp"] / total_diags, 1) if total_diags > 0 else 0,
                    promedio_m=round(areas_sum["m"] / total_diags, 1) if total_diags > 0 else 0,
                    promedio_v=round(areas_sum["v"] / total_diags, 1) if total_diags > 0 else 0,
                    promedio_tp=round(areas_sum["tp"] / total_diags, 1) if total_diags > 0 else 0,
                   promedio_rh=round(areas_sum["rh"] / total_diags, 1) if total_diags > 0 else 0,
                    promedio_ec=round(areas_sum["ec"] / total_diags, 1) if total_diags > 0 else 0,
                    num_diagnosticos=total_diags
                ))
            
            # 8. Calcular estadísticas globales
            total_emprendedores = len(emprendedores)
            
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
            diagnosticos_aceptados = len([d for d in diagnosticos_valido if d.get("resultado") in ("ACEPTADO", "APROBADO", "EXIMIDO")])
            tasa_aprobado = (diagnosticos_aceptados / len(diagnosticos_valido) * 100) if len(diagnosticos_valido) > 0 else 0
            
            global_cf = sum(e.promedio_cf for e in emprendedores) / total_emprendedores if total_emprendedores > 0 else 0
            global_gp = sum(e.promedio_gp for e in emprendedores) / total_emprendedores if total_emprendedores > 0 else 0
            global_m = sum(e.promedio_m for e in emprendedores) / total_emprendedores if total_emprendedores > 0 else 0
            global_v = sum(e.promedio_v for e in emprendedores) / total_emprendedores if total_emprendedores > 0 else 0
            global_tp = sum(e.promedio_tp for e in emprendedores) / total_emprendedores if total_emprendedores > 0 else 0
            global_rh = sum(e.promedio_rh for e in emprendedores) / total_emprendedores if total_emprendedores > 0 else 0
            global_ec = sum(e.promedio_ec for e in emprendedores) / total_emprendedores if total_emprendedores > 0 else 0
            global_promedio = (global_cf + global_gp + global_m + global_v + global_tp + global_rh + global_ec) / 7
            
            estadisticas = EstadisticasGlobales(
                total_emprendedores=total_emprendedores,
                tasa_aprobado=round(tasa_aprobado, 1),
                promedio_cf=round(global_cf, 1),
                promedio_gp=round(global_gp, 1),
                promedio_m=round(global_m, 1),
                promedio_v=round(global_v, 1),
                promedio_tp=round(global_tp, 1),
                promedio_rh=round(global_rh, 1),
                promedio_ec=round(global_ec, 1),
                promedio_general=round(global_promedio, 1)
            )
            
            # Ordenar timeline por fecha
            diag_timeline_sorted = sorted(diag_timeline, key=lambda x: x.fecha)
            
            return ReporteData(
                mentor_nombre=mentor["nombre"],
                mentor_apellido=mentor["apellido"],
                fecha_inicio=request.fecha_inicio,
                fecha_fin=request.fecha_fin,
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
        Obtiene todos los datos para generar reporte de administrador (todos los emprendedores)
        """
        try:
            # 1. Obtener TODOS los emprendedores (rol 2)
            roles_response = self.supabase.table("usuario") \
                .select("id_usuario") \
                .eq("id_rol", 2) \
                .execute()
            
            if not roles_response.data or len(roles_response.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No hay emprendedores registrados en el sistema"
                )
            
            emprendedor_ids = [r["id_usuario"] for r in roles_response.data]
            
            # 2. Obtener diagnósticos en el rango de fechas
            diagnosticos_response = self.supabase.table("diagnostico") \
                .select("*") \
                .in_("id_usuario", emprendedor_ids) \
                .gte("fecha_inicio", request.fecha_inicio.isoformat()) \
                .lte("fecha_inicio", request.fecha_fin.isoformat()) \
                .execute()
            
            if not diagnosticos_response.data or len(diagnosticos_response.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No hay diagnósticos en el rango de fechas especificado"
                )
            
            diagnosticos = diagnosticos_response.data
            
            # 3. Obtener información de usuarios
            usuarios_response = self.supabase.table("usuario") \
                .select("id_usuario, nombre, apellido") \
                .in_("id_usuario", emprendedor_ids) \
                .execute()
            
            usuarios_dict = {u["id_usuario"]: u for u in usuarios_response.data}
            
            # 4. Obtener emprendimientos
            emprendimientos_response = self.supabase.table("emprendimiento") \
                .select("id_usuario, nombre") \
                .in_("id_usuario", emprendedor_ids) \
                .execute()
            
            emprendimientos_dict = {e["id_usuario"]: e["nombre"] 
                                   for e in emprendimientos_response.data} if emprendimientos_response.data else {}
            
            # 5. Calcular estadísticas por emprendedor
            emprendedores = []
            diag_timeline = []
            
            for emp_id in emprendedor_ids:
                emp_diagnosticos = [d for d in diagnosticos if d["id_usuario"] == emp_id]
                
                if len(emp_diagnosticos) == 0:
                    continue
                
                areas_sum = {"cf": 0, "gp": 0, "m": 0, "v": 0, "tp": 0, "rh": 0, "ec": 0}
                total_diags = len(emp_diagnosticos)
                
                for diag in emp_diagnosticos:
                    diag_timeline.append(DiagnosticoPorFecha(
                        fecha=datetime.fromisoformat(diag["fecha_inicio"].replace('Z', '+00:00')),
                        promedio=diag["puntaje_total"]
                    ))
                    
                    areas_sum["cf"] += diag.get("puntaje_cf", 0)
                    areas_sum["gp"] += diag.get("puntaje_gp", 0)
                    areas_sum["m"] += diag.get("puntaje_m", 0)
                    areas_sum["v"] += diag.get("puntaje_v", 0)
                    areas_sum["tp"] += diag.get("puntaje_tp", 0)
                    areas_sum["rh"] += diag.get("puntaje_rh", 0)
                    areas_sum["ec"] += diag.get("puntaje_ec", 0)
                
                usuario = usuarios_dict.get(emp_id, {})
                emprendimiento = emprendimientos_dict.get(emp_id, "N/A")
                
                promedio_general = sum([
                    areas_sum["cf"], areas_sum["gp"], areas_sum["m"],
                    areas_sum["v"], areas_sum["tp"], areas_sum["rh"], areas_sum["ec"]
                ]) / (total_diags * 7) if total_diags > 0 else 0
                
                emprendedores.append(EmprendedorReporte(
                    nombre=usuario.get("nombre", "N/A"),
                    apellido=usuario.get("apellido", "N/A"),
                    emprendimiento=emprendimiento,
                    promedio_general=round(promedio_general, 1),
                    promedio_cf=round(areas_sum["cf"] / total_diags, 1) if total_diags > 0 else 0,
                    promedio_gp=round(areas_sum["gp"] / total_diags, 1) if total_diags > 0 else 0,
                    promedio_m=round(areas_sum["m"] / total_diags, 1) if total_diags > 0 else 0,
                    promedio_v=round(areas_sum["v"] / total_diags, 1) if total_diags > 0 else 0,
                    promedio_tp=round(areas_sum["tp"] / total_diags, 1) if total_diags > 0 else 0,
                    promedio_rh=round(areas_sum["rh"] / total_diags, 1) if total_diags > 0 else 0,
                    promedio_ec=round(areas_sum["ec"] / total_diags, 1) if total_diags > 0 else 0,
                    num_diagnosticos=total_diags
                ))
            
            # 6. Estadísticas globales
            total_emprendedores = len(emprendedores)
            
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
            diagnosticos_aceptados = len([d for d in diagnosticos_valido if d.get("resultado") in ("ACEPTADO", "APROBADO", "EXIMIDO")])
            tasa_aprobado = (diagnosticos_aceptados / len(diagnosticos_valido) * 100) if len(diagnosticos_valido) > 0 else 0
            
            global_cf = sum(e.promedio_cf for e in emprendedores) / total_emprendedores if total_emprendedores > 0 else 0
            global_gp = sum(e.promedio_gp for e in emprendedores) / total_emprendedores if total_emprendedores > 0 else 0
            global_m = sum(e.promedio_m for e in emprendedores) / total_emprendedores if total_emprendedores > 0 else 0
            global_v = sum(e.promedio_v for e in emprendedores) / total_emprendedores if total_emprendedores > 0 else 0
            global_tp = sum(e.promedio_tp for e in emprendedores) / total_emprendedores if total_emprendedores > 0 else 0
            global_rh = sum(e.promedio_rh for e in emprendedores) / total_emprendedores if total_emprendedores > 0 else 0
            global_ec = sum(e.promedio_ec for e in emprendedores) / total_emprendedores if total_emprendedores > 0 else 0
            global_promedio = (global_cf + global_gp + global_m + global_v + global_tp + global_rh + global_ec) / 7
            
            estadisticas = EstadisticasGlobales(
                total_emprendedores=total_emprendedores,
                tasa_aprobado=round(tasa_aprobado, 1),
                promedio_cf=round(global_cf, 1),
                promedio_gp=round(global_gp, 1),
                promedio_m=round(global_m, 1),
                promedio_v=round(global_v, 1),
                promedio_tp=round(global_tp, 1),
                promedio_rh=round(global_rh, 1),
                promedio_ec=round(global_ec, 1),
                promedio_general=round(global_promedio, 1)
            )
            
            diag_timeline_sorted = sorted(diag_timeline, key=lambda x: x.fecha)
            
            return ReporteData(
                mentor_nombre="Administrador",
                mentor_apellido="General",
                fecha_inicio=request.fecha_inicio,
                fecha_fin=request.fecha_fin,
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
                "siete áreas de evaluación del diagnóstico empresarial. Estos valores "
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
                    promedio=d.get("puntaje_total", 0) or 0
                ))
            
            # 5. Obtener el último diagnóstico para las estadísticas actuales
            ultimo = diagnosticos[-1]
            estadisticas = EstadisticasGlobales(
                total_emprendedores=1,
                tasa_aprobado=100 if ultimo.get("resultado") == "ACEPTADO" else 0,
                promedio_cf=ultimo.get("puntaje_cf", 0) or 0,
                promedio_gp=ultimo.get("puntaje_gp", 0) or 0,
                promedio_m=ultimo.get("puntaje_m", 0) or 0,
                promedio_v=ultimo.get("puntaje_v", 0) or 0,
                promedio_tp=ultimo.get("puntaje_tp", 0) or 0,
                promedio_rh=ultimo.get("puntaje_rh", 0) or 0,
                promedio_ec=ultimo.get("puntaje_ec", 0) or 0,
                promedio_general=ultimo.get("puntaje_total", 0) or 0
            )
            
            return ReporteDataEmprendedor(
                nombre_emprendedor=usuario["nombre"],
                apellido_emprendedor=usuario["apellido"],
                nombre_emprendimiento=emprendimiento["nombre"],
                rubro=emprendimiento["rubro"],
                estadisticas_actuales=estadisticas,
                diagnosticos_timeline=diag_timeline
            )
            
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error al obtener datos reporte individual: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error validando reporte individual: {str(e)}")

    async def generate_pdf_emprendedor(self, data: ReporteDataEmprendedor) -> bytes:
        try:
            # Sin radar — solo gráfico de línea
            chart_line = self.generate_chart_line(data.diagnosticos_timeline)

            buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                buffer,
                pagesize=letter,
                topMargin=65, bottomMargin=55, leftMargin=50, rightMargin=50,
            )
            story = []
            s = self._get_styles()

            # Portada
            story.append(Spacer(1, 1.8 * inch))
            cover_title = ParagraphStyle(
                'CoverTitle', parent=s['base']['Heading1'], fontSize=26, textColor=self.NAVY,
                fontName='Helvetica-Bold', alignment=TA_CENTER, spaceAfter=12
            )
            cover_sub = ParagraphStyle(
                'CoverSub', parent=s['base']['Normal'], fontSize=14, textColor=self.DARK_GRAY,
                fontName='Helvetica', alignment=TA_CENTER, spaceAfter=6
            )

            story.append(Paragraph("REPORTE INDIVIDUAL", cover_title))
            story.append(Paragraph("Incubadora JCI Empresarios La Paz", cover_sub))
            story.append(Spacer(1, 0.6 * inch))

            line_table = Table([['']], colWidths=[4 * inch], rowHeights=[2])
            line_table.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), self.NAVY)]))
            line_wrapper = Table([[line_table]], colWidths=[doc.width])
            line_wrapper.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
            story.append(line_wrapper)
            story.append(Spacer(1, 0.6 * inch))

            cover_data = [
                ['Emprendedor', f"{data.nombre_emprendedor} {data.apellido_emprendedor}"],
                ['Negocio', data.nombre_emprendimiento],
                ['Rubro', data.rubro],
                ['Fecha de generación', datetime.now().strftime('%d/%m/%Y %H:%M')],
            ]
            story.append(self._build_label_value_table(cover_data, col_widths=[2.5 * inch, 3.5 * inch]))

            story.append(PageBreak())
            story.append(Paragraph("1. INFORMACIÓN DEL ÚLTIMO DIAGNÓSTICO", s['section']))
            story.append(Paragraph("A continuación se detallan los puntajes en el diagnóstico más reciente.", s['body']))
            
            stats_rows = [
                ['Costos y Finanzas (CF)', str(data.estadisticas_actuales.promedio_cf)],
                ['Gestión y Producción (GP)', str(data.estadisticas_actuales.promedio_gp)],
                ['Marketing (M)', str(data.estadisticas_actuales.promedio_m)],
                ['Ventas (V)', str(data.estadisticas_actuales.promedio_v)],
                ['Talento y Personas (TP)', str(data.estadisticas_actuales.promedio_tp)],
                ['Recursos Humanos (RH)', str(data.estadisticas_actuales.promedio_rh)],
                ['Economía del Cuidado (EC)', str(data.estadisticas_actuales.promedio_ec)],
            ]
            story.append(self._build_label_value_table(stats_rows))
            story.append(Spacer(1, 0.15 * inch))

            summary_data = [['PUNTAJE GENERAL', str(data.estadisticas_actuales.promedio_general)]]
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

            story.append(Spacer(1, 0.3 * inch))

            story.append(PageBreak())
            story.append(Paragraph("2. EVOLUCIÓN HISTÓRICA", s['section']))
            story.append(Paragraph("Gráfico de evolución de puntajes a través del tiempo.", s['body']))
            story.append(Spacer(1, 0.2 * inch))
            if chart_line:
                story.append(Image(chart_line, width=5.5*inch, height=2.75*inch))

            # Build document
            doc.build(story, onFirstPage=self._header_footer, onLaterPages=self._header_footer)

            for chart_file in [chart_line]:
                if chart_file and os.path.exists(chart_file):
                    try:
                        os.remove(chart_file)
                    except:
                        pass

            pdf_bytes = buffer.getvalue()
            buffer.close()
            return pdf_bytes

        except Exception as e:
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

    async def get_reporte_data_todos_mentores(self) -> ReporteDataTodosMentores:
        """Obtiene estadísticas agrupadas por mentor para el reporte comparativo."""
        try:
            # 1. Todos los mentores activos
            mentores_resp = self.supabase.table("usuario") \
                .select("id_usuario, nombre, apellido") \
                .eq("id_rol", 3) \
                .eq("estado", True) \
                .execute()
            if not mentores_resp.data:
                raise HTTPException(status_code=404, detail="No hay mentores registrados")

            mentores_raw = mentores_resp.data
            mentor_ids = [m["id_usuario"] for m in mentores_raw]

            # 2. Todas las asignaciones activas
            asig_resp = self.supabase.table("asignacion_mentor") \
                .select("id_mentor, id_emprendedor") \
                .in_("id_mentor", mentor_ids) \
                .execute()
            asignaciones = asig_resp.data or []

            # Mapa mentor → emprendedores
            mentor_emp_map: dict = {m["id_usuario"]: [] for m in mentores_raw}
            for a in asignaciones:
                mid = a["id_mentor"]
                if mid in mentor_emp_map:
                    mentor_emp_map[mid].append(a["id_emprendedor"])

            # Todos los emprendedores únicos
            all_emp_ids = list({e for emps in mentor_emp_map.values() for e in emps})
            if not all_emp_ids:
                raise HTTPException(status_code=404, detail="No hay emprendedores asignados a ningún mentor")

            # 3. Todos los diagnósticos completados
            diag_resp = self.supabase.table("diagnostico") \
                .select("*") \
                .in_("id_usuario", all_emp_ids) \
                .not_.is_("resultado", "null") \
                .execute()
            diagnosticos = diag_resp.data or []

            # Mapa emprendedor → diagnósticos
            diag_by_emp: dict = {}
            for d in diagnosticos:
                eid = d["id_usuario"]
                diag_by_emp.setdefault(eid, []).append(d)

            # 4. Calcular estadísticas por mentor
            resultados = []
            for m in mentores_raw:
                mid = m["id_usuario"]
                emp_ids_m = mentor_emp_map.get(mid, [])
                if not emp_ids_m:
                    continue

                all_diags_m = [d for eid in emp_ids_m for d in diag_by_emp.get(eid, [])]
                if not all_diags_m:
                    continue

                areas = {k: 0.0 for k in ["cf", "gp", "m", "v", "tp", "rh", "ec"]}
                for d in all_diags_m:
                    for area in areas:
                        areas[area] += d.get(f"puntaje_{area}", 0) or 0

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
                aceptados = len([d for d in diags_validas if d.get("resultado") in ("ACEPTADO", "APROBADO", "EXIMIDO")])
                tasa = round(aceptados / n_validas * 100, 1) if n_validas else 0
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

            if not resultados:
                raise HTTPException(status_code=404, detail="No hay diagnósticos disponibles para generar el reporte")

            return ReporteDataTodosMentores(
                fecha_generacion=datetime.now(),
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
