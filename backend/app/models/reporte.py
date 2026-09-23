"""
Modelos Pydantic para el módulo de Reportes
"""
from pydantic import BaseModel, validator
from datetime import datetime
from typing import List, Optional


class ReporteRequest(BaseModel):
    id_mentor: str
    fecha_inicio: datetime
    fecha_fin: datetime

    @validator('fecha_fin')
    def validate_dates(cls, v, values):
        if 'fecha_inicio' in values and v <= values['fecha_inicio']:
            raise ValueError('La fecha fin debe ser posterior a la fecha inicio')
        return v

    class Config:
        json_schema_extra = {
            "example": {
                "id_mentor": "550e8400-e29b-41d4-a716-446655440000",
                "fecha_inicio": "2024-01-01T00:00:00",
                "fecha_fin": "2024-12-31T23:59:59"
            }
        }


class ReporteAdminRequest(BaseModel):
    fecha_inicio: datetime
    fecha_fin: datetime

    @validator('fecha_fin')
    def validate_dates(cls, v, values):
        if 'fecha_inicio' in values and v <= values['fecha_inicio']:
            raise ValueError('La fecha fin debe ser posterior a la fecha inicio')
        return v


class ReporteMentorRequest(BaseModel):
    """Reporte de un mentor específico (todo el historial, sin filtro de fechas)"""
    id_mentor: str


class EmprendedorReporte(BaseModel):
    nombre: str
    apellido: str
    emprendimiento: Optional[str]
    promedio_general: float
    promedio_cf: float
    promedio_gp: float
    promedio_m: float
    promedio_v: float
    promedio_tp: float
    promedio_rh: float
    promedio_ec: float
    num_diagnosticos: int


class EstadisticasGlobales(BaseModel):
    total_emprendedores: int
    tasa_aprobado: float
    promedio_cf: float
    promedio_gp: float
    promedio_m: float
    promedio_v: float
    promedio_tp: float
    promedio_rh: float
    promedio_ec: float
    promedio_general: float


class DiagnosticoPorFecha(BaseModel):
    fecha: datetime
    promedio: float


class ReporteData(BaseModel):
    mentor_nombre: str
    mentor_apellido: str
    fecha_inicio: datetime
    fecha_fin: datetime
    emprendedores: List[EmprendedorReporte]
    estadisticas: EstadisticasGlobales
    diagnosticos_timeline: List[DiagnosticoPorFecha]


class ReporteEmprendedorRequest(BaseModel):
    id_emprendedor: str


class SeccionItem(BaseModel):
    area: str = ""
    texto: str = ""


class RecomendacionItem(BaseModel):
    titulo: str = ""
    objetivo: str = ""
    acciones: List[str] = []
    impacto: str = ""


class ReporteDataEmprendedor(BaseModel):
    nombre_emprendedor: str
    apellido_emprendedor: str
    nombre_emprendimiento: str
    rubro: str
    resultado: str = "APROBADO"
    fecha_diagnostico: Optional[datetime] = None
    diagnostico_general: str = ""
    fortalezas: List[SeccionItem] = []
    debilidades: List[SeccionItem] = []
    recomendaciones: List[RecomendacionItem] = []
    estadisticas_actuales: EstadisticasGlobales
    diagnosticos_timeline: List[DiagnosticoPorFecha]


# ── Nuevos modelos para reportes avanzados ────────────────────────────

class MentorResumenReporte(BaseModel):
    """Estadísticas resumidas de un mentor para el comparativo"""
    nombre: str
    apellido: str
    total_emprendedores: int
    promedio_general: float
    promedio_cf: float
    promedio_gp: float
    promedio_m: float
    promedio_v: float
    promedio_tp: float
    promedio_rh: float
    promedio_ec: float
    tasa_aprobado: float


class ReporteDataMentor(BaseModel):
    """Datos para reporte de un mentor específico"""
    mentor_nombre: str
    mentor_apellido: str
    fecha_generacion: datetime
    emprendedores: List[EmprendedorReporte]
    estadisticas: EstadisticasGlobales
    diagnosticos_timeline: List[DiagnosticoPorFecha]


class ReporteDataTodosMentores(BaseModel):
    """Datos para reporte comparativo de todos los mentores"""
    fecha_generacion: datetime
    mentores: List[MentorResumenReporte]
