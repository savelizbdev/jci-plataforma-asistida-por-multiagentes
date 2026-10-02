"""
Servicio Determinista de Seguimiento de Tareas
Migrado desde el agente IA a algoritmo nativo en Python en el backend.

Funcionalidades:
- Consulta de tareas pendientes (vence <= 2 días) aisladas por organización.
- Agrupación por emprendedor y vinculación con su programa respectivo.
- Formateo de fechas a la hora oficial de Bolivia (America/La_Paz, UTC-4).
- Validación de correos electrónicos y captura de errores sin abortar el lote.
- Despacho secuencial mediante una única conexión persistente Gmail SMTP SSL.
- Retorno de resumen estructurado compatible con el frontend.
"""

import os
import re
import smtplib
from datetime import datetime, timezone, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List, Dict, Any, Tuple
from supabase import Client

from app.services.supabase_client import get_supabase_client
from app.services.org_filter import get_admin_org_user_ids

# Zona horaria de Bolivia: UTC-4 permanente (sin horario de verano)
ZONA_BOLIVIA = timezone(timedelta(hours=-4))
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def es_email_valido(email: Optional[str]) -> bool:
    """Valida la sintaxis básica de una dirección de correo electrónico."""
    if not email or not isinstance(email, str):
        return False
    email = email.strip()
    return bool(EMAIL_REGEX.match(email))


def formatear_fecha_bolivia(fecha_str: str) -> str:
    """
    Convierte una marca de tiempo ISO (usualmente UTC) a la hora local
    oficial de Bolivia (America/La_Paz, UTC-4) en formato DD/MM/YYYY a las HH:MM.
    """
    try:
        dt = datetime.fromisoformat(fecha_str.replace("Z", "+00:00"))
        dt_bo = dt.astimezone(ZONA_BOLIVIA)
        return dt_bo.strftime("%d/%m/%Y a las %H:%M")
    except Exception:
        return fecha_str


def obtener_tareas_pendientes_org(
    admin_id: Optional[str] = None,
    supabase: Optional[Client] = None
) -> List[Dict[str, Any]]:
    """
    Consulta en la base de datos las tareas activas pendientes que vencen
    en los próximos 2 días a partir de ahora, filtradas por los usuarios
    de la organización a la que pertenece el administrador.
    """
    if supabase is None:
        supabase = get_supabase_client()

    ahora = datetime.now(timezone.utc)
    limite = ahora + timedelta(days=2)

    # Deducir usuarios de la organización del admin
    org_users = get_admin_org_user_ids(admin_id, supabase) if admin_id else None

    if org_users is not None and len(org_users) == 0:
        return []

    query = (
        supabase.table("tarea")
        .select("id_tarea, id_usuario, id_diagnostico, titulo, descripcion, fecha_expiracion, estado")
        .neq("estado", "Completada")
        .lte("fecha_expiracion", limite.isoformat())
        .gte("fecha_expiracion", ahora.isoformat())
    )

    if org_users is not None:
        query = query.in_("id_usuario", org_users)

    resp = query.execute()
    return resp.data or []


def agrupar_tareas_por_emprendedor(
    tareas: List[Dict[str, Any]],
    supabase: Optional[Client] = None
) -> List[Dict[str, Any]]:
    """
    Agrupa las tareas por cada emprendedor (`id_usuario`), vinculando
    el nombre del emprendedor, su correo electrónico y el nombre del
    programa al que corresponde cada tarea.
    """
    if not tareas:
        return []

    if supabase is None:
        supabase = get_supabase_client()

    ids_usuarios = list({t["id_usuario"] for t in tareas if t.get("id_usuario")})
    if not ids_usuarios:
        return []

    # 1. Obtener datos de usuarios
    usuarios_resp = (
        supabase.table("usuario")
        .select("id_usuario, nombre, apellido, email")
        .in_("id_usuario", ids_usuarios)
        .execute()
    )
    usuarios_map = {u["id_usuario"]: u for u in (usuarios_resp.data or [])}

    # 2. Obtener programas de los usuarios
    up_resp = (
        supabase.table("usuario_programa")
        .select("id_usuario, id_programa, programa(nombre)")
        .in_("id_usuario", ids_usuarios)
        .execute()
    )
    programas_map: Dict[str, str] = {}
    for up in (up_resp.data or []):
        uid = up.get("id_usuario")
        if uid and uid not in programas_map:
            prog_data = up.get("programa")
            if isinstance(prog_data, dict) and prog_data.get("nombre"):
                programas_map[uid] = prog_data["nombre"]

    # 3. Agrupar tareas bajo cada usuario
    agrupados_dict: Dict[str, Dict[str, Any]] = {}
    for t in tareas:
        uid = t["id_usuario"]
        if uid not in agrupados_dict:
            u_info = usuarios_map.get(uid, {})
            nombre = f"{u_info.get('nombre', '')} {u_info.get('apellido', '')}".strip() or "Emprendedor"
            agrupados_dict[uid] = {
                "id_usuario": uid,
                "nombre_completo": nombre,
                "email": u_info.get("email", ""),
                "tareas": []
            }

        nombre_prog = programas_map.get(uid, "Programa General")
        agrupados_dict[uid]["tareas"].append({
            "id_tarea": t["id_tarea"],
            "titulo": t["titulo"],
            "descripcion": t.get("descripcion") or "",
            "fecha_expiracion": t.get("fecha_expiracion"),
            "fecha_legible": formatear_fecha_bolivia(t.get("fecha_expiracion", "")),
            "nombre_programa": nombre_prog,
            "estado": t.get("estado")
        })

    return list(agrupados_dict.values())


def generar_correo_emprendedor(
    nombre_emprendedor: str,
    tareas: List[Dict[str, Any]]
) -> Tuple[str, str]:
    """
    Genera el asunto dinámico y el cuerpo HTML institucional para el correo
    del emprendedor.
    - Si tiene 1 tarea: asunto singular y tarjeta destacada individual.
    - Si tiene 2 o más tareas: asunto plural y lista estructurada rotulando programas.
    """
    total = len(tareas)

    if total == 1:
        tarea = tareas[0]
        asunto = f"⏰ Recordatorio: Tienes 1 tarea próxima a vencer - {tarea['titulo']}"
        contenido_tareas = f"""
        <div style="background: #f8fafc; border-left: 4px solid #00AEEF; border-radius: 8px; padding: 18px; margin: 20px 0;">
            <div style="display: inline-block; background: #e0f2fe; color: #0369a1; font-size: 11px; font-weight: bold; padding: 3px 8px; rounded: 4px; border-radius: 4px; margin-bottom: 8px; text-transform: uppercase;">
                {tarea['nombre_programa']}
            </div>
            <h3 style="margin: 0 0 6px 0; color: #112B56; font-size: 17px;">{tarea['titulo']}</h3>
            <p style="margin: 0 0 10px 0; color: #475569; font-size: 14px; line-height: 1.5;">
                {tarea['descripcion'] or "Sin descripción adicional."}
            </p>
            <p style="margin: 0; color: #dc2626; font-weight: bold; font-size: 13px;">
                📅 Fecha límite: {tarea['fecha_legible']}
            </p>
        </div>
        """
        encabezado_sub = "Tienes una tarea pendiente que vence en los próximos 2 días:"
    else:
        asunto = f"⏰ Recordatorio: Tienes {total} tareas próximas a vencer"
        items_html = []
        for t in tareas:
            items_html.append(f"""
            <div style="background: #f8fafc; border-left: 4px solid #3AADA8; border-radius: 8px; padding: 14px; margin-bottom: 12px;">
                <div style="display: inline-block; background: #ccfbf1; color: #0f766e; font-size: 11px; font-weight: bold; padding: 2px 7px; border-radius: 4px; margin-bottom: 6px; text-transform: uppercase;">
                    {t['nombre_programa']}
                </div>
                <h4 style="margin: 0 0 4px 0; color: #112B56; font-size: 15px;">{t['titulo']}</h4>
                <p style="margin: 0 0 8px 0; color: #475569; font-size: 13px;">
                    {t['descripcion'] or "Sin descripción adicional."}
                </p>
                <p style="margin: 0; color: #dc2626; font-weight: 600; font-size: 12px;">
                    📅 Fecha límite: {t['fecha_legible']}
                </p>
            </div>
            """)
        contenido_tareas = "".join(items_html)
        encabezado_sub = f"Tienes <strong>{total} tareas pendientes</strong> que vencen en los próximos 2 días:"

    cuerpo_html = f"""
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; padding: 25px; margin: 0;">
      <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
        <!-- Header con degradado institucional -->
        <div style="background: linear-gradient(135deg, #112B56 0%, #00AEEF 100%); padding: 25px 30px; text-align: left;">
          <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">
            ⏰ Recordatorio de Tareas Pendientes
          </h2>
          <p style="color: rgba(255,255,255,0.8); margin: 6px 0 0 0; font-size: 13px;">
            Plataforma de Diagnóstico y Acompañamiento JCI
          </p>
        </div>

        <!-- Contenido principal -->
        <div style="padding: 30px;">
          <p style="font-size: 15px; color: #1e293b; margin-top: 0;">
            Hola <strong>{nombre_emprendedor}</strong>,
          </p>
          <p style="font-size: 14px; color: #475569; line-height: 1.5;">
            {encabezado_sub}
          </p>

          {contenido_tareas}

          <div style="margin-top: 25px; text-align: center;">
            <p style="font-size: 13px; color: #64748b; margin-bottom: 20px;">
              Ingresa a la plataforma para marcar tus tareas como completadas o consultar el material de apoyo.
            </p>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />

          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0; line-height: 1.4;">
            Este es un recordatorio automático generado por la plataforma JCI.<br />
            Por favor, no respondas a este correo.
          </p>
        </div>
      </div>
    </body>
    </html>
    """
    return asunto, cuerpo_html


def despachar_lote_correos(
    emprendedores: List[Dict[str, Any]],
    total_tareas_detectadas: int
) -> Dict[str, Any]:
    """
    Despacha el lote de correos a los emprendedores agrupados utilizando una
    única conexión persistente SMTP SSL con Gmail (smtp.gmail.com:465).
    Captura fallos individuales sin abortar el lote y retorna métricas completas.
    """
    from app.config import settings
    sender = (os.environ.get("EMAIL_SENDER") or getattr(settings, "EMAIL_SENDER", "")).strip()
    password = (os.environ.get("EMAIL_PASSWORD") or getattr(settings, "EMAIL_PASSWORD", "")).strip()

    if not sender or not password:
        raise ValueError("Credenciales de correo no configuradas (EMAIL_SENDER / EMAIL_PASSWORD en .env).")

    enviados_exitosos = 0
    fallidos = 0
    errores_detalle: List[Dict[str, str]] = []

    # Filtrar emprendedores con correo válido vs inválido
    destinatarios_validos: List[Dict[str, Any]] = []
    for emp in emprendedores:
        email = emp.get("email")
        if not es_email_valido(email):
            fallidos += 1
            errores_detalle.append({
                "id_usuario": emp.get("id_usuario", ""),
                "email": email or "",
                "motivo": "Dirección de correo inválida o inexistente"
            })
        else:
            destinatarios_validos.append(emp)

    if destinatarios_validos:
        server: Optional[smtplib.SMTP_SSL] = None
        try:
            server = smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=20)
            server.login(sender, password)

            for emp in destinatarios_validos:
                try:
                    asunto, cuerpo_html = generar_correo_emprendedor(
                        emp["nombre_completo"],
                        emp["tareas"]
                    )

                    msg = MIMEMultipart("alternative")
                    msg["Subject"] = asunto
                    msg["From"] = sender
                    msg["To"] = emp["email"]
                    msg.attach(MIMEText(cuerpo_html, "html"))

                    server.sendmail(sender, emp["email"], msg.as_string())
                    enviados_exitosos += 1

                except smtplib.SMTPException as smtp_err:
                    fallidos += 1
                    errores_detalle.append({
                        "id_usuario": emp.get("id_usuario", ""),
                        "email": emp.get("email", ""),
                        "motivo": f"Error SMTP: {str(smtp_err)}"
                    })
                except Exception as ex:
                    fallidos += 1
                    errores_detalle.append({
                        "id_usuario": emp.get("id_usuario", ""),
                        "email": emp.get("email", ""),
                        "motivo": f"Error general: {str(ex)}"
                    })
        finally:
            if server:
                try:
                    server.quit()
                except Exception:
                    pass

    total_emps = len(emprendedores)
    resumen_texto = (
        f"Se procesaron {total_emps} emprendedor(es) con un total de {total_tareas_detectadas} tarea(s). "
        f"{enviados_exitosos} correo(s) enviado(s) con éxito, {fallidos} fallido(s)."
    )
    if errores_detalle:
        resumen_texto += f" Errores identificados: {len(errores_detalle)}."

    return {
        "mensaje": "Proceso de seguimiento ejecutado correctamente.",
        "total_tareas": total_tareas_detectadas,
        "total_emprendedores": total_emps,
        "enviados_exitosos": enviados_exitosos,
        "fallidos": fallidos,
        "errores_detalle": errores_detalle,
        "resumen_agente": resumen_texto
    }


def ejecutar_proceso_seguimiento(
    admin_id: Optional[str] = None,
    supabase: Optional[Client] = None
) -> Dict[str, Any]:
    """
    Orquestador principal del servicio de seguimiento:
    1. Consulta tareas próximas a vencer en la organización del admin.
    2. Si no hay tareas, concluye de inmediato sin conectar a SMTP.
    3. Agrupa por emprendedor y mapea programas y fechas.
    4. Despacha el lote por SMTP SSL y retorna resumen estructurado.
    """
    if supabase is None:
        supabase = get_supabase_client()

    tareas = obtener_tareas_pendientes_org(admin_id=admin_id, supabase=supabase)

    if not tareas:
        return {
            "mensaje": "No se encontraron tareas pendientes próximas a vencer en la organización.",
            "total_tareas": 0,
            "total_emprendedores": 0,
            "enviados_exitosos": 0,
            "fallidos": 0,
            "errores_detalle": [],
            "resumen_agente": "No hay recordatorios pendientes para enviar en este momento."
        }

    emprendedores = agrupar_tareas_por_emprendedor(tareas, supabase=supabase)
    return despachar_lote_correos(emprendedores, total_tareas_detectadas=len(tareas))
