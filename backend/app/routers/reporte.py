from typing import Optional
from fastapi import APIRouter
from fastapi.responses import Response
from app.models.reporte import (
    ReporteRequest, ReporteAdminRequest, ReporteEmprendedorRequest,
    ReporteMentorRequest, ReporteTodosMentoresRequest
)
from app.services.reporte_service import reporte_service

router = APIRouter(prefix="/reporte", tags=["reporte"])


@router.post("/generar")
async def generar_reporte(request: ReporteRequest):
    """Reporte PDF de un mentor (filtrado por fechas)"""
    reporte_data = await reporte_service.get_reporte_data(request)
    pdf_bytes = await reporte_service.generate_pdf(reporte_data)
    filename = f"reporte_{reporte_data.mentor_apellido}_{request.fecha_inicio.strftime('%Y%m%d')}_{request.fecha_fin.strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/generar-admin")
async def generar_reporte_admin(request: ReporteAdminRequest):
    """Reporte PDF con estadísticas de los emprendedores de la organización del admin"""
    reporte_data = await reporte_service.get_reporte_data_admin(request)
    pdf_bytes = await reporte_service.generate_pdf(reporte_data)
    filename = f"reporte_admin_{request.fecha_inicio.strftime('%Y%m%d')}_{request.fecha_fin.strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/generar-emprendedor")
async def generar_reporte_emprendedor(request: ReporteEmprendedorRequest):
    """Reporte PDF con la evolución de un emprendedor específico"""
    reporte_data = await reporte_service.get_reporte_data_emprendedor(request)
    pdf_bytes = await reporte_service.generate_pdf_emprendedor(reporte_data)
    filename = f"reporte_evolucion_{reporte_data.nombre_emprendedor}_{reporte_data.apellido_emprendedor}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/generar-mentor")
async def generar_reporte_mentor(request: ReporteMentorRequest):
    """Reporte PDF de un mentor específico: historial de sus emprendedores"""
    reporte_data = await reporte_service.get_reporte_data_mentor(request.id_mentor)
    pdf_bytes = await reporte_service.generate_pdf_mentor(reporte_data)
    filename = f"reporte_mentor_{reporte_data.mentor_apellido}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/generar-todos-mentores")
async def generar_reporte_todos_mentores(request: Optional[ReporteTodosMentoresRequest] = None):
    """Reporte PDF comparativo de todos los mentores de la organización del admin"""
    admin_id = request.admin_id if request else None
    reporte_data = await reporte_service.get_reporte_data_todos_mentores(admin_id=admin_id)
    pdf_bytes = await reporte_service.generate_pdf_todos_mentores(reporte_data)
    filename = "reporte_comparativo_mentores.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

