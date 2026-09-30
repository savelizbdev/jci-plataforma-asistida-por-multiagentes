from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.models.admin import AdminDashboardResponse
from app.services.admin_service import admin_service

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/dashboard", response_model=AdminDashboardResponse)
async def get_admin_dashboard(admin_id: Optional[str] = Query(None, description="ID del administrador para filtrar por su organización")):
    """
    Obtiene las estadísticas del dashboard del administrador filtradas por su organización
    """
    return await admin_service.get_dashboard_stats(admin_id=admin_id)
