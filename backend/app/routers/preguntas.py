"""
Router de Preguntas
Endpoints para obtener preguntas del diagnóstico
"""
from fastapi import APIRouter, HTTPException, status
from typing import List
from app.services.pregunta_service import PreguntaService
from app.models.pregunta import PreguntaResponse, PreguntaConAreaResponse, AreaResponse


router = APIRouter(prefix="/preguntas", tags=["Preguntas"])


@router.get("/{id_pregunta}", response_model=PreguntaResponse)
async def obtener_pregunta(id_pregunta: int):
    """
    Obtiene una pregunta por su ID
    """
    pregunta_service = PreguntaService()
    
    try:
        pregunta = await pregunta_service.get_pregunta_by_id(id_pregunta)
        return pregunta
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener pregunta: {str(e)}"
        )


@router.get("/area/{id_area}", response_model=List[PreguntaConAreaResponse])
async def obtener_preguntas_por_area(id_area: int):
    """
    Obtiene todas las preguntas de un área específica con su nombre de área
    """
    pregunta_service = PreguntaService()
    
    try:
        preguntas = await pregunta_service.get_preguntas_by_area(id_area)
        return preguntas
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener preguntas por área: {str(e)}"
        )


@router.get("/", response_model=List[AreaResponse])
async def obtener_areas():
    """
    Obtiene todas las áreas disponibles ordenadas por id_area
    """
    pregunta_service = PreguntaService()
    
    try:
        areas = await pregunta_service.get_all_areas()
        return areas
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener áreas: {str(e)}"
        )


@router.post("/cache/clear")
async def limpiar_cache_preguntas():
    """
    Invalida el caché en memoria de preguntas y áreas para forzar
    que la siguiente petición recargue todo fresco desde Supabase.
    """
    from app.services.pregunta_service import clear_preguntas_cache
    clear_preguntas_cache()
    return {"message": "Caché de preguntas y áreas limpiado correctamente"}

