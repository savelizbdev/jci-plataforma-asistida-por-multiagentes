"""
Servicio de Preguntas
Maneja la lógica de negocio para obtener preguntas del diagnóstico.
Incluye un sistema de In-Memory TTL Cache para responder consultas en 0 ms
sin sobrecargar el servidor EC2 ni saturar peticiones HTTP a Supabase.
"""
import time
from typing import Optional, List, Dict, Any
from fastapi import HTTPException, status
from app.services.supabase_client import get_supabase_client
from app.models.pregunta import PreguntaResponse, PreguntaConAreaResponse, AreaResponse

# ══════════════════════════════════════════════════════════════════
# In-Memory Cache Global (Vive en la memoria RAM del proceso FastAPI)
# ══════════════════════════════════════════════════════════════════
_CACHE_TTL_SECONDS = 3600  # 1 hora de validez antes de refrescar automáticamente

_PREGUNTAS_CACHE: Dict[str, Any] = {
    "all_active": None,       # List[PreguntaConAreaResponse]
    "timestamp_all": 0.0,
    "areas": None,            # List[AreaResponse]
    "timestamp_areas": 0.0,
}


def clear_preguntas_cache():
    """
    Invalida el caché en memoria para forzar una lectura fresca
    desde la base de datos Supabase en la siguiente petición.
    """
    _PREGUNTAS_CACHE["all_active"] = None
    _PREGUNTAS_CACHE["timestamp_all"] = 0.0
    _PREGUNTAS_CACHE["areas"] = None
    _PREGUNTAS_CACHE["timestamp_areas"] = 0.0
    print("[CACHE] Caché en memoria de preguntas y áreas invalidado.")


class PreguntaService:
    """Servicio para manejar preguntas con caché en memoria integrado"""
    
    def __init__(self):
        self.supabase = get_supabase_client()
    
    async def get_pregunta_by_id(self, id_pregunta: int) -> PreguntaResponse:
        """
        Obtiene una pregunta por su ID.
        Si las preguntas están en caché en memoria, la recupera instantáneamente.
        """
        # Intentar buscar primero en el caché de preguntas activas
        cached_all = _PREGUNTAS_CACHE.get("all_active")
        if cached_all:
            for p in cached_all:
                if p.id_pregunta == id_pregunta:
                    return PreguntaResponse(
                        id_pregunta=p.id_pregunta,
                        id_area=p.id_area,
                        enunciado=p.enunciado
                    )

        # Si no está en caché, consulta Supabase
        try:
            response = self.supabase.table("pregunta").select(
                "id_pregunta, id_area, enunciado"
            ).eq("id_pregunta", id_pregunta).execute()
            
            if not response.data or len(response.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Pregunta con ID {id_pregunta} no encontrada"
                )
            
            pregunta_data = response.data[0]
            
            return PreguntaResponse(
                id_pregunta=pregunta_data["id_pregunta"],
                id_area=pregunta_data["id_area"],
                enunciado=pregunta_data["enunciado"]
            )
        
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al obtener pregunta: {str(e)}"
            )
    
    async def get_all_active_preguntas(self, force_refresh: bool = False) -> List[PreguntaConAreaResponse]:
        """
        Obtiene todas las preguntas activas con el nombre del área, ordenadas por id_area e id_pregunta.
        Utiliza caché en memoria con TTL para responder en ~0.05 ms.
        """
        now = time.time()
        cached = _PREGUNTAS_CACHE.get("all_active")
        ts = _PREGUNTAS_CACHE.get("timestamp_all", 0.0)

        # Si el caché es válido y no se fuerza recarga, retornar directo de RAM
        if not force_refresh and cached is not None and (now - ts) < _CACHE_TTL_SECONDS:
            return cached

        try:
            # Obtener preguntas con join al área ordenadas
            response = self.supabase.table("pregunta").select(
                "id_pregunta, id_area, enunciado, area(nombre_area)"
            ).eq("estado", True).order("id_area").order("id_pregunta").execute()
            
            if not response.data or len(response.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No se encontraron preguntas activas"
                )
            
            preguntas = []
            for p in response.data:
                nombre_area = p["area"]["nombre_area"] if isinstance(p.get("area"), dict) else "Desconocida"
                preguntas.append(PreguntaConAreaResponse(
                    id_pregunta=p["id_pregunta"],
                    id_area=p["id_area"],
                    nombre_area=nombre_area,
                    enunciado=p["enunciado"],
                ))
            
            # Guardar en memoria RAM
            _PREGUNTAS_CACHE["all_active"] = preguntas
            _PREGUNTAS_CACHE["timestamp_all"] = now
            print(f"[CACHE] {len(preguntas)} preguntas cargadas en memoria RAM.")
            
            return preguntas
        
        except HTTPException:
            raise
        except Exception as e:
            # Si hay un error de red pero tenemos datos en caché previos, retornarlos como respaldo
            if cached is not None:
                print(f"[WARN] Error en Supabase ({e}), usando caché previo de preguntas.")
                return cached
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al obtener todas las preguntas activas: {str(e)}"
            )

    async def get_preguntas_by_area(self, id_area: int) -> List[PreguntaConAreaResponse]:
        """
        Obtiene todas las preguntas de un área con el nombre del área que estén activas.
        Aprovecha el caché en memoria para filtrar instantáneamente sin llamada de red.
        """
        # 1. Intentar obtener desde el caché global en memoria
        todas = await self.get_all_active_preguntas()
        preguntas_area = [p for p in todas if p.id_area == id_area]
        if preguntas_area:
            return preguntas_area

        # 2. Si por alguna razón no estaban, consultar directamente a Supabase
        try:
            response = self.supabase.table("pregunta").select(
                "id_pregunta, id_area, enunciado, area(nombre_area)"
            ).eq("id_area", id_area).eq("estado", True).order("id_pregunta").execute()
            
            if not response.data or len(response.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No se encontraron preguntas activas para el área {id_area}"
                )
            
            preguntas = []
            for p in response.data:
                nombre_area = p["area"]["nombre_area"] if isinstance(p.get("area"), dict) else "Desconocida"
                preguntas.append(PreguntaConAreaResponse(
                    id_pregunta=p["id_pregunta"],
                    id_area=p["id_area"],
                    nombre_area=nombre_area,
                    enunciado=p["enunciado"],
                ))
            
            return preguntas
        
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al obtener preguntas por área: {str(e)}"
            )
    
    async def get_all_areas(self) -> List[AreaResponse]:
        """
        Obtiene todas las áreas disponibles ordenadas por id_area con caché en memoria.
        """
        now = time.time()
        cached = _PREGUNTAS_CACHE.get("areas")
        ts = _PREGUNTAS_CACHE.get("timestamp_areas", 0.0)

        if cached is not None and (now - ts) < _CACHE_TTL_SECONDS:
            return cached

        try:
            response = self.supabase.table("area").select(
                "id_area, nombre_area"
            ).order("id_area").execute()
            
            if not response.data or len(response.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No se encontraron áreas"
                )
            
            areas = [
                AreaResponse(
                    id_area=a["id_area"],
                    nombre_area=a["nombre_area"],
                )
                for a in response.data
            ]
            
            _PREGUNTAS_CACHE["areas"] = areas
            _PREGUNTAS_CACHE["timestamp_areas"] = now
            return areas
        
        except HTTPException:
            raise
        except Exception as e:
            if cached is not None:
                return cached
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al obtener áreas: {str(e)}"
            )
