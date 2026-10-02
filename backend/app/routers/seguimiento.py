"""
Router de seguimiento de tareas.
Migrado a servicio determinista en backend.
- POST /seguimiento/ejecutar: dispara el envío de recordatorios directos por Gmail SMTP.
"""

from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, status
from app.services.seguimiento_service import ejecutar_proceso_seguimiento

router = APIRouter(prefix="/seguimiento", tags=["seguimiento"])


class EjecutarSeguimientoRequest(BaseModel):
    admin_id: Optional[str] = None


@router.post("/ejecutar")
async def ejecutar_seguimiento(request: Optional[EjecutarSeguimientoRequest] = None):
    """
    Dispara el proceso determinista de seguimiento de tareas.
    Identifica tareas pendientes que vencen en los próximos 2 días para la organización
    del administrador, las agrupa por emprendedor y programa, y despacha recordatorios
    consolidados vía Gmail SMTP sin depender de agentes de IA ni LLMs.
    """
    try:
        admin_id = request.admin_id if request else None
        resultado = ejecutar_proceso_seguimiento(admin_id=admin_id)
        return resultado

    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(val_err)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al ejecutar el seguimiento: {str(e)}"
        )
