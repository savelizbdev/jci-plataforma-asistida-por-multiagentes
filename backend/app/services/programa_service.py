"""
Servicio para gestión de Organizaciones y Programas
"""
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from app.services.supabase_client import get_supabase_client
from app.models.programa import CrearOrganizacionRequest, CrearProgramaRequest, UnirseProgramaRequest


class ProgramaService:
    def __init__(self):
        self.supabase = get_supabase_client()

    async def unirse_a_programa(self, request: UnirseProgramaRequest) -> Dict[str, Any]:
        """
        Ejecuta la RPC unirse_a_programa en Supabase
        """
        try:
            response = self.supabase.rpc(
                "unirse_a_programa",
                {
                    "p_id_usuario": request.id_usuario,
                    "p_codigo": request.codigo.strip().upper()
                }
            ).execute()

            if response.data:
                return response.data
            raise HTTPException(status_code=400, detail="No se pudo completar el enrolamiento")
        except Exception as e:
            # PostgREST-py a veces produce "JSON could not be generated" con status 200 al recibir bytes UTF-8
            err_str = str(e)
            if "'code': 200" in err_str or (hasattr(e, 'args') and len(e.args) > 0 and isinstance(e.args[0], dict) and e.args[0].get('code') == 200):
                import ast
                import json
                import re
                try:
                    match = re.search(r"b'({.*?})'", err_str)
                    if match:
                        raw_bytes_str = f"b'{match.group(1)}'"
                        decoded = ast.literal_eval(raw_bytes_str).decode('utf-8')
                        return json.loads(decoded)
                except Exception:
                    pass

                # El registro ya se creó con éxito en la base de datos
                return {
                    "success": True,
                    "message": "Enrolamiento completado con éxito"
                }

            error_msg = str(e)
            if "exception" in error_msg.lower() or "error" in error_msg.lower():
                # Limpiar mensaje de Postgres si viene con prefijos
                clean_msg = error_msg.split("CONTEXT:")[0].replace("raise exception", "").strip()
                raise HTTPException(status_code=400, detail=clean_msg)
            raise HTTPException(status_code=500, detail=f"Error al unirse al programa: {str(e)}")

    async def obtener_mis_programas(self, id_usuario: str) -> List[Dict[str, Any]]:
        """
        Ejecuta la RPC obtener_mis_programas en Supabase
        """
        try:
            response = self.supabase.rpc(
                "obtener_mis_programas",
                {"p_id_usuario": id_usuario}
            ).execute()

            return response.data or []
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al obtener programas: {str(e)}")

    async def listar_organizaciones(self) -> List[Dict[str, Any]]:
        """
        Lista todas las organizaciones activas
        """
        try:
            response = self.supabase.table("organizacion")\
                .select("*")\
                .eq("estado", True)\
                .order("created_at", desc=True)\
                .execute()
            return response.data or []
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al listar organizaciones: {str(e)}")

    async def crear_organizacion(self, request: CrearOrganizacionRequest) -> Dict[str, Any]:
        """
        Crea una nueva organización
        """
        try:
            response = self.supabase.rpc(
                "crear_organizacion",
                {
                    "p_nombre": request.nombre.strip(),
                    "p_descripcion": request.descripcion.strip() if request.descripcion else None
                }
            ).execute()
            return response.data
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al crear organización: {str(e)}")

    async def listar_programas(self, id_organizacion: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Lista programas globales o por organización
        """
        try:
            query = self.supabase.table("programa")\
                .select("id_programa, nombre, codigo, estado, created_at, id_organizacion, organizacion(nombre)")\
                .eq("estado", True)
            
            if id_organizacion:
                query = query.eq("id_organizacion", id_organizacion)

            response = query.order("created_at", desc=True).execute()
            return response.data or []
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al listar programas: {str(e)}")

    async def crear_programa(self, request: CrearProgramaRequest) -> Dict[str, Any]:
        """
        Crea un nuevo programa con código de 8 caracteres
        """
        try:
            clean_codigo = request.codigo.strip().upper()
            if len(clean_codigo) != 8:
                raise HTTPException(status_code=400, detail="El código debe tener exactamente 8 caracteres")

            response = self.supabase.rpc(
                "crear_programa",
                {
                    "p_id_organizacion": request.id_organizacion,
                    "p_nombre": request.nombre.strip(),
                    "p_codigo": clean_codigo
                }
            ).execute()
            return response.data
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al crear programa: {str(e)}")


programa_service = ProgramaService()
