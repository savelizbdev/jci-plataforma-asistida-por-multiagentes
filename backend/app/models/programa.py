"""
Modelos Pydantic para Organizaciones y Programas
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class UnirseProgramaRequest(BaseModel):
    id_usuario: str
    codigo: str = Field(..., min_length=8, max_length=8)


class CrearOrganizacionRequest(BaseModel):
    nombre: str
    descripcion: Optional[str] = None


class CrearProgramaRequest(BaseModel):
    id_organizacion: int
    nombre: str
    codigo: str = Field(..., min_length=8, max_length=8)


class ProgramaItem(BaseModel):
    id_programa: int
    nombre_programa: str
    codigo: str
    id_organizacion: int
    nombre_organizacion: str
    fecha_union: Optional[datetime] = None


class OrganizacionItem(BaseModel):
    id_organizacion: int
    nombre: str
    descripcion: Optional[str] = None
    estado: bool
    created_at: Optional[datetime] = None
