"""
Routers package
Exporta todos los routers de la aplicación
"""
from app.routers.auth import router as auth_router
from app.routers.emprendimiento import router as emprendimiento_router
from app.routers.asignaciones import router as asignaciones_router
from app.routers.diagnostico import router as diagnostico_router
from app.routers.preguntas import router as preguntas_router
from app.routers.mentor import router as mentor_router
from app.routers.admin import router as admin_router
from app.routers.tarea import router as tarea_router
from app.routers.reporte import router as reporte_router
from app.routers.seguimiento import router as seguimiento_router
from app.routers.programas import router as programas_router
from app.routers.superadmin import router as superadmin_router

__all__ = [
    "auth_router",
    "emprendimiento_router",
    "asignaciones_router",
    "diagnostico_router",
    "preguntas_router",
    "mentor_router",
    "admin_router",
    "tarea_router",
    "reporte_router",
    "seguimiento_router",
    "programas_router",
    "superadmin_router",
]
