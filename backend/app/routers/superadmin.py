"""
Router para operaciones del Super Administrador (Spec 004)
Prefijo: /api/superadmin
"""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Query, Header, Depends, Body
from app.services.superadmin_service import superadmin_service
from app.models.superadmin import (
    OrganizacionSimple,
    ProgramaSimple,
    UsuarioSuperAdminItem,
    DiagnosticoSupervisionItem,
    AsignacionesResponse,
    PaginatedResponse,
    CambiarRolRequest,
    CambiarEstadoUsuarioRequest,
    MatricularUsuarioRequest,
)

router = APIRouter(prefix="/api/superadmin", tags=["superadmin"])


async def get_current_superadmin(
    user: Optional[Dict[str, Any]] = None,
    superadmin_id: Optional[str] = Query(None, description="ID del Super Administrador"),
    x_user_role: Optional[int] = Header(None, alias="X-User-Role"),
) -> Dict[str, Any]:
    """
    Dependencia de seguridad: Valida que el usuario tenga rol Super_admin (id_rol == 4).
    """
    if isinstance(user, dict):
        if user.get("id_rol") != 4:
            raise HTTPException(status_code=403, detail="Acceso restringido exclusivamente a Super Administradores")
        return user

    if x_user_role is not None:
        if x_user_role != 4:
            raise HTTPException(status_code=403, detail="Acceso restringido exclusivamente a Super Administradores")
        return {"id_usuario": superadmin_id or "superadmin", "id_rol": 4}

    if superadmin_id:
        from app.services.supabase_client import get_supabase_client
        supabase = get_supabase_client()
        res = supabase.table("usuario").select("id_usuario, id_rol, nombre, email").eq("id_usuario", superadmin_id).execute()
        if not res.data or res.data[0].get("id_rol") != 4:
            raise HTTPException(status_code=403, detail="Acceso restringido exclusivamente a Super Administradores")
        return res.data[0]

    return {"id_rol": 4}


# ==================== ORGANIZACIONES Y PROGRAMAS ====================

@router.get("/organizaciones-activas", response_model=List[OrganizacionSimple])
async def listar_organizaciones_activas(admin: Dict[str, Any] = Depends(get_current_superadmin)):
    """
    RF-02.3, RF-02.4: Lista organizaciones activas en orden alfabético.
    """
    return await superadmin_service.listar_organizaciones_activas()


@router.get("/programas-activos", response_model=List[ProgramaSimple])
async def listar_programas_activos(
    id_organizacion: int = Query(..., description="ID de la organización"),
    admin: Dict[str, Any] = Depends(get_current_superadmin),
):
    """
    RF-02.3, RF-02.4: Lista programas activos de la organización en orden alfabético.
    """
    return await superadmin_service.listar_programas_activos(id_organizacion=id_organizacion)


# ==================== GESTIÓN DE USUARIOS ====================

@router.get("/usuarios", response_model=PaginatedResponse[UsuarioSuperAdminItem])
async def obtener_usuarios(
    id_organizacion: int = Query(..., description="ID de la organización"),
    id_programa: Optional[int] = Query(None, description="ID del programa (opcional)"),
    page: int = Query(1, ge=1, description="Número de página"),
    limit: int = Query(15, ge=1, le=100, description="Registros por página"),
    q: Optional[str] = Query(None, description="Término de búsqueda por nombre, apellido o correo"),
    admin: Dict[str, Any] = Depends(get_current_superadmin),
):
    """
    RF-04.3, RF-04.6, RF-04.7: Lista usuarios matriculados paginados en backend (15 por página).
    """
    return await superadmin_service.obtener_usuarios_paginados(
        id_organizacion=id_organizacion,
        id_programa=id_programa,
        page=page,
        limit=limit,
        q=q,
    )


@router.get("/usuarios-sin-programa", response_model=PaginatedResponse[UsuarioSuperAdminItem])
async def obtener_usuarios_sin_programa(
    id_organizacion: int = Query(..., description="ID de la organización"),
    page: int = Query(1, ge=1, description="Número de página"),
    limit: int = Query(15, ge=1, le=100, description="Registros por página"),
    q: Optional[str] = Query(None, description="Término de búsqueda por nombre, apellido o correo"),
    admin: Dict[str, Any] = Depends(get_current_superadmin),
):
    """
    RF-04.4, RF-04.7: Lista usuarios de la organización que no tienen programa asignado.
    """
    return await superadmin_service.obtener_usuarios_sin_programa(
        id_organizacion=id_organizacion,
        page=page,
        limit=limit,
        q=q,
    )


@router.put("/cambiar-rol")
async def cambiar_rol(
    request: CambiarRolRequest,
    admin: Dict[str, Any] = Depends(get_current_superadmin),
):
    """
    RF-04.2: Modifica el rol de un usuario (1 a 4).
    """
    await superadmin_service.cambiar_rol_usuario(request.id_usuario, request.nuevo_rol)
    return {"success": True, "message": "Rol actualizado correctamente"}


@router.put("/cambiar-estado-usuario")
async def cambiar_estado_usuario(
    request: CambiarEstadoUsuarioRequest,
    admin: Dict[str, Any] = Depends(get_current_superadmin),
):
    """
    RF-04.1: Activa o desactiva la cuenta de un usuario.
    """
    await superadmin_service.cambiar_estado_usuario(request.id_usuario, request.activo)
    return {"success": True, "message": "Estado de usuario actualizado correctamente"}


@router.post("/matricular-usuario")
async def matricular_usuario(
    request: MatricularUsuarioRequest,
    admin: Dict[str, Any] = Depends(get_current_superadmin),
):
    """
    RF-04.5: Matricula a un usuario en un programa activo.
    """
    await superadmin_service.matricular_usuario(request.id_usuario, request.id_programa)
    return {"success": True, "message": "Usuario matriculado exitosamente"}


# ==================== ASIGNACIÓN DE MENTORES ====================

@router.get("/asignaciones", response_model=AsignacionesResponse)
async def obtener_asignaciones(
    id_organizacion: int = Query(..., description="ID de la organización"),
    id_programa: Optional[int] = Query(None, description="ID del programa"),
    page_mentores: int = Query(1, ge=1),
    page_sin_mentor: int = Query(1, ge=1),
    page_con_mentor: int = Query(1, ge=1),
    limit: int = Query(15, ge=1, le=100),
    admin: Dict[str, Any] = Depends(get_current_superadmin),
):
    """
    RF-05.1, RF-05.4: Obtiene mentores y emprendedores con paginación independiente de 15.
    """
    return await superadmin_service.obtener_asignaciones_mentores(
        id_organizacion=id_organizacion,
        id_programa=id_programa,
        page_mentores=page_mentores,
        page_sin_mentor=page_sin_mentor,
        page_con_mentor=page_con_mentor,
        limit=limit,
    )


class AsignarMentorRequest(BaseModel):
    id_mentor: str
    id_emprendedores: List[str]


class DesasignarMentorRequest(BaseModel):
    id_emprendedor: str


@router.post("/asignaciones/asignar")
async def asignar_mentor(
    request: AsignarMentorRequest,
    admin: Dict[str, Any] = Depends(get_current_superadmin),
):
    """
    RF-05.2: Asigna emprendedores a un mentor.
    """
    await superadmin_service.asignar_mentor(id_mentor=request.id_mentor, id_emprendedores=request.id_emprendedores)
    return {"success": True, "message": "Mentor asignado correctamente"}


@router.post("/asignaciones/desasignar")
async def desasignar_mentor(
    request: DesasignarMentorRequest,
    admin: Dict[str, Any] = Depends(get_current_superadmin),
):
    """
    RF-05.2: Revoca la asignación de un emprendedor.
    """
    await superadmin_service.desasignar_mentor(id_emprendedor=request.id_emprendedor)
    return {"success": True, "message": "Asignación revocada correctamente"}


# ==================== SUPERVISIÓN DE DIAGNÓSTICOS ====================

@router.get("/diagnosticos", response_model=PaginatedResponse[DiagnosticoSupervisionItem])
async def obtener_diagnosticos(
    id_organizacion: int = Query(..., description="ID de la organización"),
    id_programa: Optional[int] = Query(None, description="ID del programa"),
    page: int = Query(1, ge=1),
    limit: int = Query(15, ge=1, le=100),
    admin: Dict[str, Any] = Depends(get_current_superadmin),
):
    """
    RF-07.1, RF-07.2, RF-07.3, RF-07.5, RF-07.6:
    Lista diagnósticos en solo lectura, desglosando por programa con paginación de 15.
    """
    return await superadmin_service.obtener_diagnosticos_supervision(
        id_organizacion=id_organizacion,
        id_programa=id_programa,
        page=page,
        limit=limit,
    )
