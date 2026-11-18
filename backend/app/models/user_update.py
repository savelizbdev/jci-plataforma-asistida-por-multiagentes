"""
Modelo para actualización de datos de usuario
"""
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date


class UserUpdateRequest(BaseModel):
    """
    Modelo para actualizar datos personales del usuario
    """
    nombre: str
    apellido: str
    sexo: str  # "M", "F", "O"
    fecha_nacimiento: date
    celular: int


class UbicacionGeograficaRequest(BaseModel):
    """
    Modelo para registrar la ubicación geográfica del emprendedor (Spec 005)
    """
    nacionalidad: str
    municipio: str

    @field_validator('nacionalidad', 'municipio')
    @classmethod
    def validar_y_normalizar(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('El campo no puede estar vacío.')
        return v.strip().upper()

