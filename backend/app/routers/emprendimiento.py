"""
Router de Emprendimiento
Endpoints para gestión de emprendimientos y sus estados
"""
from fastapi import APIRouter, HTTPException, status
from app.services.emprendimiento_service import EmprendimientoService
from app.models.emprendimiento import (
    CreateEmprendimientoRequest,
    EmprendimientoResponse
)


router = APIRouter(prefix="/emprendimiento", tags=["Emprendimiento"])


@router.post("", response_model=EmprendimientoResponse, status_code=status.HTTP_201_CREATED)
async def create_emprendimiento(emprendimiento_data: CreateEmprendimientoRequest):
    """
    Crea un nuevo emprendimiento para un usuario

    Args:
        emprendimiento_data: Datos del emprendimiento (id_usuario, nombre, rubro, anio_inicio)

    Returns:
        EmprendimientoResponse: Emprendimiento creado

    Raises:
        400: Si el usuario ya tiene un emprendimiento
        500: Error interno del servidor
    """
    emprendimiento_service = EmprendimientoService()

    try:
        emprendimiento = await emprendimiento_service.create_emprendimiento(emprendimiento_data)
        return emprendimiento

    except Exception as e:
        error_message = str(e)
        if "ya tiene un emprendimiento" in error_message:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_message
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear emprendimiento: {error_message}"
        )


@router.get("/usuario/{id_usuario}", response_model=EmprendimientoResponse | None)
async def get_emprendimiento_by_user(id_usuario: str):
    """
    Obtiene el emprendimiento de un usuario

    Args:
        id_usuario: ID del usuario

    Returns:
        EmprendimientoResponse | None: Emprendimiento del usuario o null si no existe

    Raises:
        500: Error interno del servidor
    """
    emprendimiento_service = EmprendimientoService()

    try:
        emprendimiento = await emprendimiento_service.get_emprendimiento_by_user(id_usuario)
        return emprendimiento

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener emprendimiento: {str(e)}"
        )

