"""
Servicio de Autenticación
Maneja la lógica de negocio para autenticación y gestión de usuarios
"""
from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from app.services.supabase_client import get_supabase_client
from app.models.user import UserCreate, UserResponse

ROLES_MAP = {
    1: "Administrador",
    2: "Emprendedor",
    3: "Mentor",
}


class AuthService:
    """Servicio para manejar autenticación y usuarios"""
    
    def __init__(self):
        self.supabase = get_supabase_client()
    
    async def authenticate_with_google(self, google_user_data: Dict[str, Any]) -> UserResponse:
        """
        Autentica un usuario con Google OAuth
        
        IMPORTANTE: El usuario ya fue creado automáticamente por el trigger de Supabase
        cuando se autenticó con Google Auth. Este método solo busca el usuario y 
        actualiza su rol si es necesario.
        
        Args:
            google_user_data: Datos del usuario de Google (debe incluir id, email)
        
        Returns:
            UserResponse: Datos del usuario con su rol
        
        Raises:
            HTTPException: Si hay error en la autenticación
        """
        email = google_user_data.get("email")
        google_id = google_user_data.get("id")
        
        if not email or not google_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Datos de Google incompletos. Se requiere email e id."
            )
        
        # Buscar usuario (ya fue creado por el trigger de Supabase)
        user = await self.get_user_by_email(email)
        
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado. El trigger de Supabase debería haberlo creado automáticamente."
            )
        
        # Si el usuario no tiene rol asignado, asignarle Emprendedor por defecto
        if user.id_rol is None:
            user = await self.assign_default_role(google_id, email)
        
        return user
    
    async def assign_default_role(self, user_id: str, email: str) -> UserResponse:
        """
        Asigna el rol por defecto (Emprendedor, id_rol=2) a un usuario nuevo
        
        Args:
            user_id: ID del usuario
            email: Email del usuario
        
        Returns:
            UserResponse: Usuario con rol asignado
        """
        try:
            # Actualizar el usuario para asignar rol Emprendedor
            update_data = {"id_rol": 2}
            
            response = self.supabase.table("usuario").update(update_data).eq("id_usuario", user_id).execute()
            
            if not response.data or len(response.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Error al asignar rol por defecto"
                )
            
            # Obtener el usuario actualizado
            updated_user = await self.get_user_by_email(email)
            
            if updated_user is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Error al obtener usuario después de asignar rol"
                )
            
            return updated_user
        
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al asignar rol: {str(e)}"
            )
    
    async def get_user_by_email(self, email: str) -> Optional[UserResponse]:
        """
        Busca un usuario por email
        
        Args:
            email: Email del usuario
        
        Returns:
            UserResponse o None si no existe
        """
        try:
            # Consulta para obtener el usuario
            response = self.supabase.table("usuario").select(
                "id_usuario, email, nombre, apellido, id_rol, estado, habilitado_diag"
            ).eq("email", email).execute()
            
            if response.data and len(response.data) > 0:
                user_data = response.data[0]
                
                rol_nombre = ROLES_MAP.get(user_data.get("id_rol"), "Emprendedor")
                
                return UserResponse(
                    id_usuario=user_data["id_usuario"],
                    email=user_data["email"],
                    nombre=user_data.get("nombre"),
                    apellido=user_data.get("apellido"),
                    id_rol=user_data["id_rol"],
                    rol=rol_nombre,
                    estado=user_data.get("estado", True),
                    habilitado_diag=user_data.get("habilitado_diag", False)
                )
            
            return None
        
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al buscar usuario: {str(e)}"
            )
    
    async def get_user_by_id(self, user_id: str) -> Optional[UserResponse]:
        """
        Obtiene un usuario por su ID
        
        Args:
            user_id: ID del usuario
        
        Returns:
            UserResponse o None si no existe
        """
        try:
            response = self.supabase.table("usuario").select(
                "id_usuario, email, nombre, apellido, id_rol, estado, habilitado_diag"
            ).eq("id_usuario", user_id).execute()
            
            if response.data and len(response.data) > 0:
                user_data = response.data[0]
                
                rol_nombre = ROLES_MAP.get(user_data.get("id_rol"), "Emprendedor")
                
                return UserResponse(
                    id_usuario=user_data["id_usuario"],
                    email=user_data["email"],
                    nombre=user_data.get("nombre"),
                    apellido=user_data.get("apellido"),
                    id_rol=user_data["id_rol"],
                    rol=rol_nombre,
                    estado=user_data.get("estado", True),
                    habilitado_diag=user_data.get("habilitado_diag", False)
                )
            
            return None
        
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al obtener usuario: {str(e)}"
            )
    
    async def update_user_profile(self, user_id: str, update_data: Dict[str, Any]) -> Optional[UserResponse]:
        """
        Actualiza los datos personales del usuario
        
        Args:
            user_id: ID del usuario
            update_data: Diccionario con los datos a actualizar
        
        Returns:
            UserResponse con los datos actualizados o None si no existe
        """
        try:
            # Actualizar el usuario en la base de datos
            response = self.supabase.table("usuario").update(update_data).eq("id_usuario", user_id).execute()
            
            if not response.data or len(response.data) == 0:
                return None
            
            # Obtener el usuario actualizado con todos sus datos
            updated_user = await self.get_user_by_id(user_id)
            
            return updated_user
        
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al actualizar perfil: {str(e)}"
            )
    
    async def get_all_users(self) -> list[UserResponse]:
        """
        Obtiene todos los usuarios del sistema con sus roles
        
        Returns:
            list[UserResponse]: Lista de todos los usuarios
        """
        try:
            # Consultar todos los usuarios
            response = self.supabase.table("usuario").select(
                "id_usuario, email, nombre, apellido, id_rol, estado, habilitado_diag, celular"
            ).execute()
            
            users = []
            
            if response.data:
                for user_data in response.data:
                    id_rol = user_data.get("id_rol")
                    rol_nombre = ROLES_MAP.get(id_rol, "Emprendedor")
                    
                    users.append(UserResponse(
                        id_usuario=user_data["id_usuario"],
                        email=user_data["email"],
                        nombre=user_data.get("nombre"),
                        apellido=user_data.get("apellido"),
                        id_rol=id_rol,
                        rol=rol_nombre,
                        estado=user_data.get("estado", True),
                        habilitado_diag=user_data.get("habilitado_diag", False),
                        celular=user_data.get("celular")
                    ))
            
            return users
        
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al obtener usuarios: {str(e)}"
            )
    
    async def disable_user(self, user_id: str) -> Optional[UserResponse]:
        """
        Deshabilita un usuario cambiando su estado a False
        
        Args:
            user_id: ID del usuario a deshabilitar
        
        Returns:
            UserResponse con el usuario actualizado o None si no existe
        """
        try:
            # Actualizar estado a False
            response = self.supabase.table("usuario").update({"estado": False}).eq("id_usuario", user_id).execute()
            
            if not response.data or len(response.data) == 0:
                return None
            
            # Obtener el usuario actualizado
            updated_user = await self.get_user_by_id(user_id)
            
            return updated_user
        
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al deshabilitar usuario: {str(e)}"
            )
    
    async def update_user_role_permissions(self, user_id: str, id_rol: int, habilitado_diag: bool, estado: bool) -> Optional[UserResponse]:
        """
        Actualiza el rol, permisos de diagnóstico y estado de un usuario
        
        Args:
            user_id: ID del usuario
            id_rol: Nuevo ID de rol (1=Admin, 2=Emprendedor, 3=Mentor)
            habilitado_diag: Nuevo estado de habilitado_diag
            estado: Nuevo estado del usuario (True=habilitado, False=deshabilitado)
        
        Returns:
            UserResponse con el usuario actualizado o None si no existe
        """
        try:
            # Actualizar rol, habilitado_diag y estado
            update_data = {
                "id_rol": id_rol,
                "habilitado_diag": habilitado_diag,
                "estado": estado
            }
            
            response = self.supabase.table("usuario").update(update_data).eq("id_usuario", user_id).execute()
            
            if not response.data or len(response.data) == 0:
                return None
            
            # Obtener el usuario actualizado
            updated_user = await self.get_user_by_id(user_id)
            
            return updated_user
        
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error al actualizar rol, permisos y estado: {str(e)}"
            )
