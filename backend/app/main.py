"""
Aplicación principal FastAPI
Punto de entrada del backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import (
    auth_router, 
    emprendimiento_router, 
    asignaciones_router, 
    diagnostico_router,
    preguntas_router,
    mentor_router,
    admin_router,
    tarea_router,
    reporte_router,
    seguimiento_router,
)


# Crear aplicación FastAPI
app = FastAPI(
    title="Incubadora JCI - API",
    description="Backend para el sistema de Incubadora de Emprendimientos de la JCI Empresarios La Paz",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Registrar routers
app.include_router(auth_router)
app.include_router(emprendimiento_router)
app.include_router(asignaciones_router)
app.include_router(diagnostico_router)
app.include_router(preguntas_router)
app.include_router(mentor_router)
app.include_router(admin_router)
app.include_router(tarea_router)
app.include_router(reporte_router)
app.include_router(seguimiento_router)


@app.get("/")
async def root():
    """
    Endpoint raíz - Health check
    """
    return {
        "message": "Incubadora JCI API",
        "version": "1.0.0",
        "status": "running",
        "environment": settings.ENVIRONMENT
    }


@app.get("/health")
async def health_check():
    """
    Endpoint de health check para monitoreo
    """
    return {
        "status": "healthy",
        "service": "backend",
        "environment": settings.ENVIRONMENT
    }
