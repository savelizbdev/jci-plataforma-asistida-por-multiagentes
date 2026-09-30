"""
Router de seguimiento de tareas.
- GET /seguimiento/tareas-proximas : consultado por el agente ADK para obtener las tareas.
- POST /seguimiento/ejecutar        : dispara el agente de seguimiento vía ADK.
"""

import os
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, status, Query
from app.services.supabase_client import get_supabase_client
from app.services.org_filter import get_admin_org_user_ids

router = APIRouter(prefix="/seguimiento", tags=["seguimiento"])

IA_BASE_URL = os.environ.get("IA_BASE_URL", "http://localhost:9000")
APP_NAME = "multi_agente_seguimiento"

# Variable de estado temporal para el último admin_id que disparó el seguimiento
_last_admin_id: Optional[str] = None


class EjecutarSeguimientoRequest(BaseModel):
    admin_id: Optional[str] = None


# ---------------------------------------------------------------------------
# GET /seguimiento/tareas-proximas
# Consultado por el agente ADK a través del tools.py
# ---------------------------------------------------------------------------

@router.get("/tareas-proximas")
async def obtener_tareas_proximas(admin_id: Optional[str] = Query(None)):
    """
    Devuelve todas las tareas pendientes que vencen en los próximos 2 días.
    Incluye el nombre y email del emprendedor para que el agente pueda enviarle un correo.
    """
    try:
        supabase = get_supabase_client()
        ahora = datetime.now(timezone.utc)
        limite = ahora + timedelta(days=2)

        effective_admin_id = admin_id or _last_admin_id
        org_users = get_admin_org_user_ids(effective_admin_id, supabase) if effective_admin_id else None

        # Buscar tareas pendientes que vencen dentro de 2 días
        query = (
            supabase.table("tarea")
            .select("id_tarea, id_usuario, titulo, descripcion, fecha_expiracion, estado")
            .neq("estado", "Completada")
            .lte("fecha_expiracion", limite.isoformat())
            .gte("fecha_expiracion", ahora.isoformat())
        )

        if org_users is not None:
            if len(org_users) == 0:
                return {"cantidad": 0, "tareas": [], "mensaje": "No hay tareas próximas a vencer en la organización."}
            query = query.in_("id_usuario", org_users)

        resp = query.execute()

        tareas = resp.data or []

        if not tareas:
            return {"cantidad": 0, "tareas": [], "mensaje": "No hay tareas próximas a vencer."}

        # Obtener datos de los emprendedores en un solo query
        ids_usuarios = list({t["id_usuario"] for t in tareas})
        usuarios_resp = (
            supabase.table("usuario")
            .select("id_usuario, nombre, apellido, email")
            .in_("id_usuario", ids_usuarios)
            .execute()
        )
        usuarios_map = {u["id_usuario"]: u for u in (usuarios_resp.data or [])}

        resultado = []
        for tarea in tareas:
            usuario = usuarios_map.get(tarea["id_usuario"], {})
            resultado.append({
                "id_tarea": tarea["id_tarea"],
                "titulo": tarea["titulo"],
                "descripcion": tarea.get("descripcion", ""),
                "fecha_expiracion": tarea["fecha_expiracion"],
                "estado": tarea["estado"],
                "id_usuario": tarea["id_usuario"],
                "nombre_emprendedor": f"{usuario.get('nombre', '')} {usuario.get('apellido', '')}".strip(),
                "email_emprendedor": usuario.get("email", ""),
            })

        return {"cantidad": len(resultado), "tareas": resultado}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener tareas próximas: {str(e)}",
        )


# ---------------------------------------------------------------------------
# POST /seguimiento/ejecutar
# Dispara el agente ADK de seguimiento
# ---------------------------------------------------------------------------

@router.post("/ejecutar")
async def ejecutar_seguimiento(request: Optional[EjecutarSeguimientoRequest] = None):
    """
    Dispara el agente de seguimiento de tareas.
    El agente consulta `/seguimiento/tareas-proximas`, obtiene las tareas
    que vencen en los próximos 2 días y envía correos de recordatorio.
    """
    global _last_admin_id
    try:
        _last_admin_id = request.admin_id if request else None
        user_id = "sistema"
        session_id = "session_seguimiento"

        url_session = f"{IA_BASE_URL}/apps/{APP_NAME}/users/{user_id}/sessions/{session_id}"

        async with httpx.AsyncClient() as client:
            # Limpiar sesión anterior si existe
            await client.delete(url_session, timeout=5.0)
            # Crear sesión nueva
            resp_session = await client.post(url_session, json={}, timeout=10.0)
            resp_session.raise_for_status()

        # Enviar mensaje de activación al agente
        url_run = f"{IA_BASE_URL}/run"
        payload = {
            "app_name": APP_NAME,
            "user_id": user_id,
            "session_id": session_id,
            "new_message": {
                "role": "user",
                "parts": [{"text": "Ejecuta el proceso de seguimiento completo ahora."}],
            },
            "streaming": False,
        }

        async with httpx.AsyncClient() as client:
            resp_run = await client.post(url_run, json=payload, timeout=120.0)
            resp_run.raise_for_status()
            resultado = resp_run.json()

        # Limpiar la sesión temporal
        async with httpx.AsyncClient() as client:
            await client.delete(url_session, timeout=5.0)

        # Extraer el último texto del agente como resumen
        resumen = "Proceso ejecutado."
        eventos = resultado if isinstance(resultado, list) else []
        for evento in reversed(eventos):
            content = evento.get("content", {})
            parts = content.get("parts", [])
            for part in parts:
                if isinstance(part, dict) and part.get("text"):
                    resumen = part["text"]
                    break
            if resumen != "Proceso ejecutado.":
                break

        return {
            "mensaje": "Proceso de seguimiento ejecutado correctamente.",
            "resumen_agente": resumen,
        }

    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"No se pudo conectar con el agente de IA: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al ejecutar el seguimiento: {str(e)}",
        )
