"""
Servicio de Diagnóstico
Maneja la lógica de negocio para diagnósticos y detalles de diagnóstico
"""
from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from app.services.supabase_client import get_supabase_client
from app.models.diagnostico import (
    DiagnosticoResponse,
    DetalleDiagnosticoResponse,
    DiagnosticoUpdate
)


class DiagnosticoService:
    """Servicio para manejar diagnósticos"""
    
    def __init__(self):
        self.supabase = get_supabase_client()
    
    async def create_diagnostico(self, id_usuario: str) -> DiagnosticoResponse:
        """
        Crea un nuevo registro de diagnóstico
        
        Args:
            id_usuario: ID del usuario que inicia el diagnóstico
        
        Returns:
            DiagnosticoResponse: Diagnóstico creado con su ID
        
        Raises:
            HTTPException: Si hay error en la creación
        """
        try:
            # Insertar nuevo diagnóstico
            # fecha_inicio se crea automáticamente con DEFAULT NOW()
            # puntaje_total por defecto es 0
            # conclusion y resultado por defecto son vacíos
            insert_data = {
                "id_usuario": id_usuario,
                "puntaje_total": 0,
                "conclusion": "",
                "resultado": "",
                "puntaje_cf": 0,
                "puntaje_gp": 0,
                "puntaje_m": 0,
                "puntaje_v": 0,
                "puntaje_tp": 0,
                "puntaje_rh": 0,
                "puntaje_ec": 0,
            }
            
            response = self.supabase.table("diagnostico").insert(insert_data).execute()
            
            if not response.data or len(response.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Error al crear diagnóstico"
                )
            
            diagnostico_data = response.data[0]
            
            return DiagnosticoResponse(
                id_diagnostico=diagnostico_data["id_diagnostico"],
                id_usuario=diagnostico_data["id_usuario"],
                fecha_inicio=diagnostico_data["fecha_inicio"],
                puntaje_total=diagnostico_data.get("puntaje_total"),
                conclusion=diagnostico_data.get("conclusion"),
                resultado=diagnostico_data.get("resultado"),
                puntaje_cf=diagnostico_data.get("puntaje_cf"),
                puntaje_gp=diagnostico_data.get("puntaje_gp"),
                puntaje_m=diagnostico_data.get("puntaje_m"),
                puntaje_v=diagnostico_data.get("puntaje_v"),
                puntaje_tp=diagnostico_data.get("puntaje_tp"),
                puntaje_rh=diagnostico_data.get("puntaje_rh"),
            )
        
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al crear diagnóstico: {str(e)}"
            )
    
    async def create_detalle_diagnostico(
        self,
        id_diagnostico: int,
        id_pregunta: int,
        respuesta_usuario: str,
        puntaje: float
    ) -> DetalleDiagnosticoResponse:
        """
        Crea un detalle de diagnóstico (respuesta a una pregunta)
        
        Args:
            id_diagnostico: ID del diagnóstico
            id_pregunta: ID de la pregunta respondida
            respuesta_usuario: Respuesta del usuario
            puntaje: Puntaje obtenido
        
        Returns:
            DetalleDiagnosticoResponse: Detalle creado
        
        Raises:
            HTTPException: Si hay error en la creación
        """
        try:
            # Insertar detalle de diagnóstico
            insert_data = {
                "id_diagnostico": id_diagnostico,
                "id_pregunta": id_pregunta,
                "respuesta_usuario": respuesta_usuario,
                "puntaje": puntaje
            }
            
            response = self.supabase.table("detalle_diagnostico").insert(insert_data).execute()
            
            if not response.data or len(response.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Error al crear detalle de diagnóstico"
                )
            
            detalle_data = response.data[0]
            
            return DetalleDiagnosticoResponse(
                id_detalle=detalle_data["id_detalle"],
                id_diagnostico=detalle_data["id_diagnostico"],
                id_pregunta=detalle_data["id_pregunta"],
                respuesta_usuario=detalle_data["respuesta_usuario"],
                puntaje=float(detalle_data["puntaje"])  # Convertir Decimal a float
            )
        
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al crear detalle de diagnóstico: {str(e)}"
            )

    async def create_detalles_batch(
        self,
        detalles_list: list[dict]
    ) -> list[dict]:
        """
        Inserta múltiples detalles de diagnóstico en una sola petición HTTP (Bulk Insert).
        """
        if not detalles_list:
            return []
        try:
            response = self.supabase.table("detalle_diagnostico").insert(detalles_list).execute()
            return response.data or []
        except Exception as e:
            print(f"[ERROR] Error al insertar detalles en lote: {e}")
            raise
    
    async def update_diagnostico(
        self,
        id_diagnostico: int,
        update_data: DiagnosticoUpdate
    ) -> DiagnosticoResponse:
        """
        Actualiza un diagnóstico con los resultados finales
        
        Args:
            id_diagnostico: ID del diagnóstico a actualizar
            update_data: Datos a actualizar (puntaje_total, conclusion, resultado)
        
        Returns:
            DiagnosticoResponse: Diagnóstico actualizado
        
        Raises:
            HTTPException: Si hay error en la actualización
        """
        try:
            # Preparar datos para actualizar
            data_to_update = {
                "puntaje_total": float(update_data.puntaje_total),
                "conclusion": update_data.conclusion,
                "resultado": update_data.resultado,
                "puntaje_cf": float(update_data.puntaje_cf),
                "puntaje_gp": float(update_data.puntaje_gp),
                "puntaje_m": float(update_data.puntaje_m),
                "puntaje_v": float(update_data.puntaje_v),
                "puntaje_tp": float(update_data.puntaje_tp),
                "puntaje_rh": float(update_data.puntaje_rh),
                "puntaje_ec": float(update_data.puntaje_ec),
            }
            
            # Agregar campos opcionales si están presentes
            if update_data.recomendaciones is not None:
                data_to_update["recomendaciones"] = update_data.recomendaciones
            if update_data.inconsistencias is not None:
                data_to_update["inconsistencias"] = update_data.inconsistencias
            
            # Actualizar el diagnóstico
            response = self.supabase.table("diagnostico").update(
                data_to_update
            ).eq("id_diagnostico", id_diagnostico).execute()
            
            if not response.data or len(response.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Diagnóstico no encontrado"
                )
            
            diagnostico_data = response.data[0]
            
            return DiagnosticoResponse(
                id_diagnostico=diagnostico_data["id_diagnostico"],
                id_usuario=diagnostico_data["id_usuario"],
                fecha_inicio=diagnostico_data["fecha_inicio"],
                puntaje_total=diagnostico_data.get("puntaje_total"),
                conclusion=diagnostico_data.get("conclusion"),
                resultado=diagnostico_data.get("resultado"),
                puntaje_cf=diagnostico_data.get("puntaje_cf"),
                puntaje_gp=diagnostico_data.get("puntaje_gp"),
                puntaje_m=diagnostico_data.get("puntaje_m"),
                puntaje_v=diagnostico_data.get("puntaje_v"),
                puntaje_tp=diagnostico_data.get("puntaje_tp"),
                puntaje_rh=diagnostico_data.get("puntaje_rh"),
                recomendaciones=diagnostico_data.get("recomendaciones"),
                inconsistencias=diagnostico_data.get("inconsistencias"),
            )
        
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al actualizar diagnóstico: {str(e)}"
            )
            
    async def delete_diagnostico(self, id_diagnostico: int) -> bool:
        """
        Elimina físicamente un diagnóstico de la base de datos.
        Se usa para limpiar diagnósticos abandonados (incompletos).
        
        Args:
            id_diagnostico: ID del diagnóstico a eliminar
            
        Returns:
            bool: True si se eliminó correctamente
        """
        try:
            # Eliminar primero los detalles (fk)
            self.supabase.table("detalle_diagnostico").delete().eq("id_diagnostico", id_diagnostico).execute()
            
            # Eliminar diagnóstico
            response = self.supabase.table("diagnostico").delete().eq("id_diagnostico", id_diagnostico).execute()
            
            if not response.data or len(response.data) == 0:
                # Podría ya no existir o falló
                return False
                
            return True
        except Exception as e:
            print(f"[Error] No se pudo eliminar diagnóstico {id_diagnostico}: {e}")
            return False