"""
Router de Autenticación
Endpoints para login y gestión de sesión
"""
from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel
from typing import Dict, Any, Optional
from app.services.auth_service import AuthService
from app.models.user import UserResponse


router = APIRouter(prefix="/auth", tags=["Autenticación"])


class GoogleAuthRequest(BaseModel):
    """Request body para autenticación con Google"""
    id: str  # Google User ID
    email: str
    name: str = ""
    picture: str = ""


class GoogleAuthResponse(BaseModel):
    """Response de autenticación exitosa"""
    user: UserResponse
    message: str


@router.post("/google", response_model=GoogleAuthResponse)
async def authenticate_with_google(auth_data: GoogleAuthRequest):
    """
    Endpoint para autenticación con Google OAuth
    
    - Recibe los datos del usuario de Google
    - Verifica si el usuario existe en la BD
    - Si no existe, crea uno nuevo con rol Emprendedor
    - Retorna los datos del usuario con su rol para redirección
    
    Args:
        auth_data: Datos del usuario de Google (id, email, name, picture)
    
    Returns:
        GoogleAuthResponse: Usuario con su rol y mensaje de éxito
    """
    auth_service = AuthService()
    
    try:
        # Convertir a diccionario para el servicio
        google_user_data = {
            "id": auth_data.id,
            "email": auth_data.email,
            "name": auth_data.name,
            "picture": auth_data.picture
        }
        
        # Autenticar/Crear usuario
        user = await auth_service.authenticate_with_google(google_user_data)
        
        return GoogleAuthResponse(
            user=user,
            message="Autenticación exitosa"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error en autenticación: {str(e)}"
        )


@router.get("/me", response_model=UserResponse)
async def get_current_user(user_id: str):
    """
    Obtiene los datos del usuario actual
    
    Args:
        user_id: ID del usuario (query parameter)
    
    Returns:
        UserResponse: Datos del usuario con su rol
    """
    auth_service = AuthService()
    
    try:
        user = await auth_service.get_user_by_id(user_id)
        
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )
        
        return user
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener usuario: {str(e)}"
        )


class UserUpdateRequest(BaseModel):
    """Request body para actualizar datos del usuario"""
    nombre: str
    apellido: str
    sexo: str  # "M", "F", "O"
    fecha_nacimiento: str  # formato: "YYYY-MM-DD"
    celular: int


@router.put("/{user_id}/profile", response_model=UserResponse)
async def update_user_profile(user_id: str, profile_data: UserUpdateRequest):
    """
    Actualiza los datos personales del usuario
    
    Args:
        user_id: ID del usuario
        profile_data: Datos personales a actualizar
    
    Returns:
        UserResponse: Usuario actualizado con sus datos
    """
    auth_service = AuthService()
    
    try:
        # Preparar datos para actualizar
        update_data = {
            "nombre": profile_data.nombre,
            "apellido": profile_data.apellido,
            "sexo": profile_data.sexo,
            "fecha_nacimiento": profile_data.fecha_nacimiento,
            "celular": profile_data.celular
        }
        
        # Actualizar usuario
        updated_user = await auth_service.update_user_profile(user_id, update_data)
        
        if updated_user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )
        
        return updated_user
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar perfil: {str(e)}"
        )


@router.get("/users", response_model=list[UserResponse])
async def get_all_users(admin_id: Optional[str] = Query(None)):
    """
    Obtiene la lista de usuarios del sistema (o los de la organización del admin)
    
    Returns:
        list[UserResponse]: Lista de usuarios con sus datos y roles
    """
    auth_service = AuthService()
    
    try:
        users = await auth_service.get_all_users(admin_id=admin_id)
        return users
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al obtener usuarios: {str(e)}"
        )


@router.patch("/{user_id}/disable", response_model=UserResponse)
async def disable_user(user_id: str):
    """
    Deshabilita un usuario cambiando su estado a False
    
    Args:
        user_id: ID del usuario a deshabilitar
    
    Returns:
        UserResponse: Usuario actualizado
    """
    auth_service = AuthService()
    
    try:
        disabled_user = await auth_service.disable_user(user_id)
        
        if disabled_user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )
        
        return disabled_user
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al deshabilitar usuario: {str(e)}"
        )


class UpdateRolePermissionsRequest(BaseModel):
    """Request body para actualizar rol y permisos"""
    id_rol: int
    habilitado_diag: bool
    estado: bool


@router.patch("/{user_id}/role-permissions", response_model=UserResponse)
async def update_user_role_permissions(user_id: str, update_data: UpdateRolePermissionsRequest):
    """
    Actualiza el rol, permisos de diagnóstico y estado de un usuario
    
    Args:
        user_id: ID del usuario
        update_data: Nuevo rol, habilitado_diag y estado
    
    Returns:
        UserResponse: Usuario actualizado
    """
    auth_service = AuthService()
    
    try:
        updated_user = await auth_service.update_user_role_permissions(
            user_id,
            update_data.id_rol,
            update_data.habilitado_diag,
            update_data.estado
        )
        
        if updated_user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado"
            )
        
        return updated_user
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al actualizar rol y permisos: {str(e)}"
        )


@router.patch("/{user_id}/toggle-status")
async def toggle_user_status(user_id: str):
    """
    Alterna el estado activo/inactivo de un usuario (para control switch en panel)
    
    Args:
        user_id: ID del usuario
        
    Returns:
        dict: { id_usuario, estado }
    """
    auth_service = AuthService()
    return await auth_service.toggle_user_status(user_id)
