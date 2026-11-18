"""
Modelo para Usuario
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date


class UserBase(BaseModel):
    """Campos base del usuario"""
    email: EmailStr
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    sexo: Optional[str] = None
    fecha_nacimiento: Optional[date] = None
    celular: Optional[int] = None
    estado: Optional[bool] = None
    habilitado_diag: Optional[bool] = True
    nacionalidad: Optional[str] = None
    municipio: Optional[str] = None


class UserCreate(UserBase):
    """
    Modelo para crear un usuario nuevo
    Usado cuando se autentica por primera vez con Google
    """
    id_usuario: str  # ID de Google
    id_rol: int = 2  # Por defecto: Emprendedor


class User(UserBase):
    """
    Modelo completo de Usuario
    Corresponde a la tabla 'usuario' en Supabase
    """
    id_usuario: str
    id_rol: int
    
    class Config:
        from_attributes = True


class UserResponse(BaseModel):
    """
    Respuesta de autenticación con datos del usuario y rol
    """
    id_usuario: str
    email: str
    nombre: Optional[str] = None
    apellido: Optional[str] = None
    id_rol: int
    rol: str  # Nombre del rol: "Administrador", "Emprendedor", "Mentor"
    estado: bool
    habilitado_diag: bool
    celular: Optional[int] = None
    nacionalidad: Optional[str] = None
    municipio: Optional[str] = None
    
    class Config:
        from_attributes = True
