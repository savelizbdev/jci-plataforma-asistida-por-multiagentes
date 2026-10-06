"""
Modelos Pydantic para el módulo de Super Administrador (Spec 004)
"""
from typing import Generic, TypeVar, List, Optional
import math
from pydantic import BaseModel, Field, field_validator

T = TypeVar("T")


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1, description="Número de página (1-indexed)")
    limit: int = Field(default=15, ge=1, le=100, description="Cantidad de registros por página")


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    limit: int
    total_pages: int = 1

    def __init__(self, **data):
        super().__init__(**data)
        if self.limit > 0:
            self.total_pages = max(1, math.ceil(self.total / self.limit))


class CambiarRolRequest(BaseModel):
    id_usuario: str
    nuevo_rol: int = Field(..., description="ID del nuevo rol (1=Admin, 2=Emprendedor, 3=Mentor, 4=Super_admin)")

    @field_validator("nuevo_rol")
    @classmethod
    def validar_rol(cls, v: int) -> int:
        if v not in [1, 2, 3, 4]:
            raise ValueError("El rol debe ser 1 (Admin), 2 (Emprendedor), 3 (Mentor) o 4 (Super_admin)")
        return v


class CambiarEstadoUsuarioRequest(BaseModel):
    id_usuario: str
    activo: bool


class MatricularUsuarioRequest(BaseModel):
    id_usuario: str
    id_programa: int


class OrganizacionSimple(BaseModel):
    id_organizacion: int
    nombre: str
    descripcion: Optional[str] = None
    estado: bool = True


class ProgramaSimple(BaseModel):
    id_programa: int
    nombre_programa: str
    id_organizacion: int
    codigo: Optional[str] = None
    estado: bool = True


class UsuarioSuperAdminItem(BaseModel):
    id_usuario: str
    nombre: str
    apellido: str
    correo: str
    id_rol: int
    nombre_rol: Optional[str] = None
    estado: bool = True
    programas_ids: List[int] = Field(default_factory=list)
    programas_nombres: List[str] = Field(default_factory=list)


class DiagnosticoSupervisionItem(BaseModel):
    id_diagnostico: Optional[str] = None
    id_emprendedor: str
    nombre: str
    apellido: str
    emprendimiento: Optional[str] = None
    id_programa: int
    nombre_programa: str
    estado_diagnostico: str = "Sin diagnóstico"
    resultado: Optional[str] = None
    promedio_general: Optional[float] = None
    promedio_cf: Optional[float] = None
    promedio_gp: Optional[float] = None
    promedio_m: Optional[float] = None
    promedio_v: Optional[float] = None
    promedio_tp: Optional[float] = None
    promedio_rh: Optional[float] = None
    promedio_ec: Optional[float] = None
    conclusion: Optional[str] = None
    recomendaciones: Optional[str] = None
    inconsistencias: Optional[str] = None
    fecha_inicio: Optional[str] = None


class EmprendedorConMentorItem(BaseModel):
    id_asignacion: Optional[str] = None
    id_emprendedor: str
    nombre: str
    apellido: str
    correo: str
    emprendimiento: Optional[str] = None
    id_mentor: str
    mentor_nombre: str
    mentor_apellido: str
    id_programa: Optional[int] = None
    nombre_programa: Optional[str] = None


class AsignacionesResponse(BaseModel):
    mentores: PaginatedResponse[UsuarioSuperAdminItem]
    emprendedores_sin_mentor: PaginatedResponse[UsuarioSuperAdminItem]
    emprendedores_con_mentor: PaginatedResponse[EmprendedorConMentorItem]
