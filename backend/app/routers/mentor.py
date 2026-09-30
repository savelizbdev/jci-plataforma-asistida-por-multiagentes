"""
Router para operaciones del Mentor
"""
from fastapi import APIRouter, HTTPException, Query
from app.services.mentor_service import mentor_service
from app.models.mentor import (
    MentorDashboardResponse,
    EmprendedorAsignado,
    DiagnosticoResumen,
    ConversacionDiagnostico,
    UpdateCalificacionRequest,
    UpdateCalificacionResponse
)
from typing import List, Optional

router = APIRouter(prefix="/mentor", tags=["mentor"])


@router.get("/dashboard/{id_mentor}", response_model=MentorDashboardResponse)
async def get_mentor_dashboard(id_mentor: str, id_programa: Optional[int] = Query(None)):
    """
    Obtiene las estadísticas del dashboard para un mentor específico (opcionalmente filtrado por programa)
    """
    try:
        stats = await mentor_service.get_dashboard_stats(id_mentor, id_programa=id_programa)
        return stats
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener dashboard del mentor: {str(e)}"
        )


# ==================== ENDPOINTS PARA RESULTADOS DE DIAGNÓSTICO ====================

@router.get("/emprendedores/{id_mentor}", response_model=List[EmprendedorAsignado])
async def get_emprendedores_asignados(id_mentor: str, id_programa: Optional[int] = Query(None)):
    """
    Obtiene la lista de emprendedores asignados a un mentor (opcionalmente filtrado por programa)
    """
    try:
        return await mentor_service.get_emprendedores_asignados(id_mentor, id_programa=id_programa)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener emprendedores: {str(e)}"
        )


@router.get("/diagnosticos/{id_emprendedor}", response_model=List[DiagnosticoResumen])
async def get_diagnosticos_emprendedor(id_emprendedor: str):
    """
    Obtiene la lista de diagnósticos de un emprendedor
    Ordenados por fecha (más recientes primero) y numerados
    
    Args:
        id_emprendedor: ID del emprendedor
        
    Returns:
        Lista de diagnósticos del emprendedor
    """
    try:
        return await mentor_service.get_diagnosticos_emprendedor(id_emprendedor)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener diagnósticos: {str(e)}"
        )


@router.get("/diagnostico/{id_diagnostico}/conversacion", response_model=ConversacionDiagnostico)
async def get_conversacion_diagnostico(id_diagnostico: int):
    """
    Obtiene la conversación completa de un diagnóstico
    Incluye preguntas y respuestas ordenadas por área
    
    Args:
        id_diagnostico: ID del diagnóstico
        
    Returns:
        Conversación completa con detalles del diagnóstico
    """
    try:
        return await mentor_service.get_conversacion_diagnostico(id_diagnostico)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al obtener conversación: {str(e)}"
        )


@router.patch("/{user_id}/toggle-diag")
async def toggle_habilitado_diag(user_id: str, habilitado: bool):
    """
    Activa o desactiva el acceso al diagnóstico para un emprendedor
    
    Args:
        user_id: ID del emprendedor
        habilitado: Nuevo valor de habilitado_diag
        
    Returns:
        Estado actualizado
    """
    try:
        result = await mentor_service.toggle_habilitado_diag(user_id, habilitado)
        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al actualizar habilitado_diag: {str(e)}"
        )


@router.put("/detalle/{id_detalle}/calificacion", response_model=UpdateCalificacionResponse)
async def update_calificacion_respuesta(id_detalle: int, request: UpdateCalificacionRequest):
    """
    Actualiza la calificación de una respuesta individual.
    Recalcula automáticamente el puntaje del área, puntaje total y resultado.
    
    Args:
        id_detalle: ID del detalle de diagnóstico
        request: Nuevo puntaje (0-100)
        
    Returns:
        Valores recalculados (puntaje_area, area_key, puntaje_total, resultado)
    """
    try:
        return await mentor_service.update_calificacion_respuesta(
            id_detalle=id_detalle,
            nuevo_puntaje=request.puntaje
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al actualizar calificación: {str(e)}"
        )
