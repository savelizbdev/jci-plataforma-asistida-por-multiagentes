"""
Router para Programas y Super Administrador
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from app.models.programa import (
    UnirseProgramaRequest,
    CrearOrganizacionRequest,
    ActualizarOrganizacionRequest,
    CrearProgramaRequest,
    ActualizarProgramaRequest,
    OrganizacionItem
)
from app.services.programa_service import programa_service

router = APIRouter(tags=["programas"])


# ==================== ENROLAMIENTO Y PROGRAMAS ====================

@router.post("/programas/unirse")
async def unirse_a_programa(request: UnirseProgramaRequest):
    """
    Canjea un código de 8 caracteres para unirse a un programa (Emprendedor/Mentor/Admin)
    """
    return await programa_service.unirse_a_programa(request)


@router.get("/programas/mis-programas")
async def obtener_mis_programas(id_usuario: str = Query(..., description="ID del usuario en sesión")):
    """
    Obtiene la lista de programas a los que pertenece un usuario
    """
    return await programa_service.obtener_mis_programas(id_usuario)


# ==================== SUPER ADMINISTRADOR ====================

@router.get("/superadmin/organizaciones")
async def listar_organizaciones():
    """
    Lista todas las organizaciones registradas
    """
    return await programa_service.listar_organizaciones()


@router.post("/superadmin/organizaciones")
async def crear_organizacion(request: CrearOrganizacionRequest):
    """
    Crea una nueva organización
    """
    return await programa_service.crear_organizacion(request)


@router.put("/superadmin/organizaciones/{id_organizacion}")
async def actualizar_organizacion(id_organizacion: int, request: ActualizarOrganizacionRequest):
    """
    Actualiza una organización existente
    """
    return await programa_service.actualizar_organizacion(id_organizacion, request)


@router.get("/superadmin/programas")
async def listar_programas(id_organizacion: Optional[int] = Query(None)):
    """
    Lista los programas registrados
    """
    return await programa_service.listar_programas(id_organizacion)


@router.post("/superadmin/programas")
async def crear_programa(request: CrearProgramaRequest):
    """
    Crea un nuevo programa con código de 8 caracteres
    """
    return await programa_service.crear_programa(request)


@router.put("/superadmin/programas/{id_programa}")
async def actualizar_programa(id_programa: int, request: ActualizarProgramaRequest):
    """
    Actualiza un programa existente
    """
    return await programa_service.actualizar_programa(id_programa, request)
