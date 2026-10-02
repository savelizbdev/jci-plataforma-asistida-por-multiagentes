"""
Router para gestión de asignaciones mentor-emprendedor
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from fastapi import Query
from supabase import Client
from app.services.supabase_client import get_supabase_client

router = APIRouter(prefix="/asignaciones", tags=["asignaciones"])


from app.services.org_filter import get_admin_org_user_ids


def _get_org_user_ids(supabase: Client, admin_id: Optional[str]):
    return get_admin_org_user_ids(admin_id, supabase)



# ==================== MODELOS ====================

class AsignarMentoresRequest(BaseModel):
    id_mentor: str
    id_emprendedores: List[str]


# ==================== ENDPOINTS ====================

def _adjuntar_programas_ids(supabase: Client, usuarios: List[dict]) -> List[dict]:
    if not usuarios:
        return []
    user_ids = [u["id_usuario"] for u in usuarios if "id_usuario" in u]
    if not user_ids:
        return usuarios
    
    try:
        up_res = supabase.table("usuario_programa")\
            .select("id_usuario, id_programa")\
            .in_("id_usuario", user_ids)\
            .execute()
        
        map_progs = {}
        for row in (up_res.data or []):
            uid = str(row["id_usuario"])
            pid = row["id_programa"]
            if uid not in map_progs:
                map_progs[uid] = []
            map_progs[uid].append(pid)
            
        for u in usuarios:
            uid = str(u.get("id_usuario"))
            u["programas_ids"] = map_progs.get(uid, [])
    except Exception:
        for u in usuarios:
            u.setdefault("programas_ids", [])
            
    return usuarios


@router.get("/mentores")
async def obtener_mentores(admin_id: Optional[str] = Query(None)):
    """
    Obtiene todos los mentores (id_rol = 3) activos, filtrados por la organización del admin si se especifica
    """
    try:
        supabase: Client = get_supabase_client()
        org_users = _get_org_user_ids(supabase, admin_id)
        
        query = supabase.table("usuario")\
            .select("id_usuario, nombre, apellido, email")\
            .eq("id_rol", 3)\
            .eq("estado", True)
        
        if org_users is not None:
            if len(org_users) == 0:
                query = query.in_("id_usuario", ["00000000-0000-0000-0000-000000000000"])
            else:
                query = query.in_("id_usuario", org_users)
        
        response = query.execute()
        mentores = response.data or []
        return _adjuntar_programas_ids(supabase, mentores)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener mentores: {str(e)}")


@router.get("/emprendedores-sin-mentor")
async def obtener_emprendedores_sin_mentor(admin_id: Optional[str] = Query(None)):
    """
    Obtiene todos los emprendedores (id_rol = 2) que NO tienen mentor asignado activo,
    filtrados por la organización del admin si se especifica
    """
    try:
        supabase: Client = get_supabase_client()
        org_users = _get_org_user_ids(supabase, admin_id)
        
        # Obtener todos los emprendedores
        query_emp = supabase.table("usuario")\
            .select("id_usuario, nombre, apellido, email")\
            .eq("id_rol", 2)\
            .eq("estado", True)
        
        if org_users is not None:
            if len(org_users) == 0:
                query_emp = query_emp.in_("id_usuario", ["00000000-0000-0000-0000-000000000000"])
            else:
                query_emp = query_emp.in_("id_usuario", org_users)

        response_emprendedores = query_emp.execute()
        
        # Obtener emprendedores con asignación
        response_asignaciones = supabase.table("asignacion_mentor")\
            .select("id_emprendedor")\
            .execute()
        
        # IDs de emprendedores que ya tienen mentor
        ids_con_mentor = {asig["id_emprendedor"] for asig in (response_asignaciones.data or [])}
        
        # Filtrar emprendedores sin mentor
        emprendedores_sin_mentor = [
            emp for emp in (response_emprendedores.data or [])
            if emp["id_usuario"] not in ids_con_mentor
        ]
        
        return _adjuntar_programas_ids(supabase, emprendedores_sin_mentor)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener emprendedores: {str(e)}")


@router.get("/todos-emprendedores")
async def obtener_todos_emprendedores(admin_id: Optional[str] = Query(None)):
    """
    Obtiene emprendedores activos del sistema (o de la organización del admin).
    Usado por el administrador para seleccionar en reportes.
    """
    try:
        supabase: Client = get_supabase_client()
        org_users = _get_org_user_ids(supabase, admin_id)

        query = supabase.table("usuario") \
            .select("id_usuario, nombre, apellido") \
            .eq("id_rol", 2) \
            .eq("estado", True) \
            .order("apellido", desc=False)

        if org_users is not None:
            if len(org_users) == 0:
                query = query.in_("id_usuario", ["00000000-0000-0000-0000-000000000000"])
            else:
                query = query.in_("id_usuario", org_users)

        response = query.execute()
        return response.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener emprendedores: {str(e)}")

@router.get("/mi-mentor")
async def obtener_mi_mentor(user_id: str):
    """
    Obtiene el mentor asignado a un emprendedor
    
    Args:
        user_id: ID del emprendedor (query parameter)
    
    Returns:
        Datos del mentor o null si no tiene asignación
    """
    try:
        supabase: Client = get_supabase_client()
        
        # Buscar asignación del emprendedor (toda fila = activa)
        asignacion = supabase.table("asignacion_mentor")\
            .select("id_mentor")\
            .eq("id_emprendedor", user_id)\
            .execute()
        
        if not asignacion.data or len(asignacion.data) == 0:
            return {"mentor": None}
        
        id_mentor = asignacion.data[0]["id_mentor"]
        
        # Obtener datos del mentor
        mentor = supabase.table("usuario")\
            .select("nombre, apellido, email")\
            .eq("id_usuario", id_mentor)\
            .execute()
        
        if not mentor.data or len(mentor.data) == 0:
            return {"mentor": None}
        
        return {"mentor": mentor.data[0]}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener mentor: {str(e)}")


@router.post("/asignar-mentores")
async def asignar_mentores(request: AsignarMentoresRequest):
    """
    Asigna múltiples emprendedores a un mentor
    """
    try:
        supabase: Client = get_supabase_client()
        
        # Validar que el mentor existe y es rol 3
        mentor = supabase.table("usuario")\
            .select("id_usuario, id_rol")\
            .eq("id_usuario", request.id_mentor)\
            .execute()
        
        if not mentor.data:
            raise HTTPException(status_code=404, detail="Mentor no encontrado")
        
        if mentor.data[0]["id_rol"] != 3:
            raise HTTPException(status_code=400, detail="El usuario no es mentor")
        
        # Validar que todos los emprendedores existen y son rol 2
        for id_emp in request.id_emprendedores:
            emprendedor = supabase.table("usuario")\
                .select("id_usuario, id_rol, nombre, apellido")\
                .eq("id_usuario", id_emp)\
                .execute()
            
            if not emprendedor.data:
                raise HTTPException(status_code=404, detail=f"Emprendedor {id_emp} no encontrado")
            
            if emprendedor.data[0]["id_rol"] != 2:
                raise HTTPException(status_code=400, detail=f"El usuario {id_emp} no es emprendedor")

            # Verificar si el emprendedor ya tiene un mentor asignado
            asignacion_existente = supabase.table("asignacion_mentor")\
                .select("id_mentor")\
                .eq("id_emprendedor", id_emp)\
                .execute()

            if asignacion_existente.data:
                nombre = emprendedor.data[0].get('nombre', '')
                apellido = emprendedor.data[0].get('apellido', '')
                raise HTTPException(
                    status_code=400,
                    detail=f"El emprendedor {nombre} {apellido} ya tiene un mentor asignado."
                )
        
        # Crear asignaciones
        asignaciones_creadas = []
        for id_emp in request.id_emprendedores:
            asignacion = {
                "id_mentor": request.id_mentor,
                "id_emprendedor": id_emp,
            }
            
            result = supabase.table("asignacion_mentor").insert(asignacion).execute()
            asignaciones_creadas.append(result.data[0])
        
        return {
            "message": "Asignaciones creadas exitosamente",
            "cantidad": len(asignaciones_creadas),
            "asignaciones": asignaciones_creadas
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al asignar mentores: {str(e)}")


@router.get("/emprendedores-con-mentor")
async def obtener_emprendedores_con_mentor(admin_id: Optional[str] = Query(None)):
    """
    Obtiene todos los emprendedores que tienen mentor asignado activo,
    incluyendo nombre del emprendimiento y datos del mentor (filtrados por organización del admin si aplica).
    """
    try:
        supabase: Client = get_supabase_client()
        org_users = _get_org_user_ids(supabase, admin_id)

        # Obtener todas las asignaciones (toda fila = activa)
        response = supabase.table("asignacion_mentor")\
            .select("id_emprendedor, id_mentor")\
            .execute()

        if not response.data:
            return []

        # IDs únicos para hacer queries por lotes
        ids_emprendedores = list({asig["id_emprendedor"] for asig in response.data})
        if org_users is not None:
            ids_emprendedores = [id_emp for id_emp in ids_emprendedores if id_emp in org_users]

        if not ids_emprendedores:
            return []

        ids_mentores = list({asig["id_mentor"] for asig in response.data if asig["id_emprendedor"] in ids_emprendedores})
        if not ids_mentores:
            return []

        # Obtener datos de todos los emprendedores
        emps_resp = supabase.table("usuario")\
            .select("id_usuario, nombre, apellido, email")\
            .in_("id_usuario", ids_emprendedores)\
            .execute()
        emps_map = {u["id_usuario"]: u for u in emps_resp.data}

        # Obtener nombre del emprendimiento de la tabla emprendimiento
        emprendimientos_resp = supabase.table("emprendimiento")\
            .select("id_usuario, nombre")\
            .in_("id_usuario", ids_emprendedores)\
            .execute()
        emp_nombre_map = {e["id_usuario"]: e.get("nombre") for e in emprendimientos_resp.data}

        # Obtener datos de todos los mentores
        mentores_resp = supabase.table("usuario")\
            .select("id_usuario, nombre, apellido, email")\
            .in_("id_usuario", ids_mentores)\
            .execute()
        mentores_map = {u["id_usuario"]: u for u in mentores_resp.data}

        resultado = []
        for asig in response.data:
            emp_data = emps_map.get(asig["id_emprendedor"])
            mentor_data = mentores_map.get(asig["id_mentor"])
            if emp_data and mentor_data:
                emp_out = dict(emp_data)
                emp_out["nombre_emprendimiento"] = emp_nombre_map.get(asig["id_emprendedor"])
                resultado.append({
                    "id_emprendedor": asig["id_emprendedor"],
                    "emprendedor": emp_out,
                    "mentor": mentor_data,
                })

        return resultado

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener asignaciones: {str(e)}")


class QuitarAsignacionRequest(BaseModel):
    id_emprendedor: str


@router.delete("/quitar-asignacion")
async def quitar_asignacion(request: QuitarAsignacionRequest):
    """
    Elimina permanentemente la asignación de un emprendedor.
    """
    try:
        supabase: Client = get_supabase_client()

        # Verificar que existe una asignación
        existente = supabase.table("asignacion_mentor")\
            .select("id_asignacion")\
            .eq("id_emprendedor", request.id_emprendedor)\
            .execute()

        if not existente.data:
            raise HTTPException(status_code=404, detail="No existe asignación para este emprendedor")

        # Eliminar permanentemente la asignación
        supabase.table("asignacion_mentor")\
            .delete()\
            .eq("id_emprendedor", request.id_emprendedor)\
            .execute()

        return {
            "message": "Asignación eliminada correctamente",
            "id_emprendedor": request.id_emprendedor
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al quitar asignación: {str(e)}")


# ==================== ENDPOINTS DE TAREAS ====================

@router.get("/tareas/mis-tareas")
async def obtener_mis_tareas(user_id: str):
    """
    Obtiene todas las tareas asignadas al usuario actual
    
    Args:
        user_id: ID del usuario (query parameter)
    
    Returns:
        Lista de tareas del usuario
    """
    try:
        supabase: Client = get_supabase_client()
        
        response = supabase.table("tarea")\
            .select("*")\
            .eq("id_usuario", user_id)\
            .order("fecha_asignacion", desc=True)\
            .execute()
        
        tareas = response.data or []
        if not tareas:
            return []

        nombre_programa = "Programa General"
        try:
            prog_res = supabase.table("usuario_programa")\
                .select("id_programa, programa(nombre)")\
                .eq("id_usuario", user_id)\
                .execute()

            if prog_res.data and len(prog_res.data) > 0:
                first_prog = prog_res.data[0]
                if isinstance(first_prog.get("programa"), dict) and first_prog["programa"].get("nombre"):
                    nombre_programa = first_prog["programa"]["nombre"]
        except Exception:
            pass

        for t in tareas:
            t["nombre_programa"] = nombre_programa

        return tareas
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al obtener tareas: {str(e)}")


@router.patch("/tareas/{id_tarea}/completar")
async def marcar_tarea_completada(id_tarea: int, user_id: str):
    """
    Marca una tarea como completada
    
    Args:
        id_tarea: ID de la tarea
        user_id: ID del usuario (query parameter para validar)
    
    Returns:
        Tarea actualizada
    """
    try:
        supabase: Client = get_supabase_client()
        
        # Verificar que la tarea pertenece al usuario
        tarea = supabase.table("tarea")\
            .select("*")\
            .eq("id_tarea", id_tarea)\
            .eq("id_usuario", user_id)\
            .execute()
        
        if not tarea.data:
            raise HTTPException(status_code=404, detail="Tarea no encontrada o no pertenece al usuario")
        
        # Actualizar estado a "Completada"
        result = supabase.table("tarea")\
            .update({"estado": "Completada"})\
            .eq("id_tarea", id_tarea)\
            .execute()
        
        return result.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al completar tarea: {str(e)}")
