"""
Modelos para Mentor
"""
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime


class AreaPromedios(BaseModel):
    """
    Promedios por área de negocio
    """
    cf: float  # Costos y Finanzas
    gp: float  # Gestión de Procesos
    m: float   # Marketing
    v: float   # Ventas
    tp: float  # Tecnologías y Procesos
    rh: float  # Recursos Humanos
    ec: float  # Economía del Cuidado


class MentorDashboardResponse(BaseModel):
    """
    Respuesta del dashboard del mentor con estadísticas clave
    """
    total_emprendedores: int
    tasa_exito: float  # Porcentaje de diagnósticos ACEPTADOS (0-100)
    promedio_general: float  # Promedio de puntaje_total de todos los emprendedores
    emprendedores_habilitados: int  # Cuántos tienen habilitado_diag = true
    promedios_por_area: AreaPromedios
    
    class Config:
        from_attributes = True


# ==================== MODELOS PARA RESULTADOS DE DIAGNÓSTICO ====================

class EmprendedorAsignado(BaseModel):
    """
    Emprendedor asignado al mentor
    """
    id_usuario: str
    nombre: str
    apellido: str
    habilitado_diag: bool = False
    celular: Optional[int] = None
    nombre_emprendimiento: Optional[str] = None
    rubro_emprendimiento: Optional[str] = None
    nacionalidad: Optional[str] = None
    municipio: Optional[str] = None
    
    class Config:
        from_attributes = True


class DiagnosticoResumen(BaseModel):
    """
    Resumen de un diagnóstico individual
    """
    id_diagnostico: int
    numero: int  # Número del diagnóstico (1, 2, 3...)
    fecha_inicio: datetime
    resultado: str  # ACEPTADO, RECHAZADO, PENDIENTE
    puntaje_total: int
    puntaje_cf: int
    puntaje_gp: int
    puntaje_m: int
    puntaje_v: int
    puntaje_tp: int
    puntaje_rh: int
    puntaje_ec: int
    
    class Config:
        from_attributes = True


class PreguntaRespuesta(BaseModel):
    """
    Una pregunta con su respuesta y calificación
    """
    id_detalle: int
    id_pregunta: int
    pregunta: str
    respuesta: str
    puntaje: float
    
    class Config:
        from_attributes = True


class AreaConversacion(BaseModel):
    """
    Conversación agrupada por área
    """
    id_area: int
    area_nombre: str
    preguntas: List[PreguntaRespuesta]
    
    class Config:
        from_attributes = True


class AreaDetalle(BaseModel):
    """
    Detalle de un área con nombre y puntaje
    """
    nombre: str
    puntaje: int
    
    class Config:
        from_attributes = True


class ConversacionDiagnostico(BaseModel):
    """
    Conversación completa de un diagnóstico con detalles
    """
    id_diagnostico: int
    fecha: datetime
    resultado: str
    puntaje_total: int
    conclusion: Optional[str] = None
    recomendaciones: Optional[str] = None
    inconsistencias: Optional[str] = None
    areas: Dict[str, AreaDetalle]  # "cf": {"nombre": "...", "puntaje": 75}
    conversacion: List[AreaConversacion]
    
    class Config:
        from_attributes = True


class UpdateCalificacionRequest(BaseModel):
    """
    Request para actualizar la calificación de una respuesta
    """
    puntaje: float  # Valor entre 0 y 100


class UpdateCalificacionResponse(BaseModel):
    """
    Response con los valores recalculados tras cambiar una calificación
    """
    puntaje_area: float
    area_key: str  # "cf", "gp", "m", "v", "tp", "rh", "ec"
    puntaje_total: float
    resultado: str  # "RECHAZADO", "ACEPTADO", "EXIMIDO"
