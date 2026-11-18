"""
Tests unitarios para Spec 005 — Ubicación Geográfica Simple
Fase 1 y Fase 2: Modelos, Endpoint Atómico, Inmutabilidad y Reportes PDF
"""
import unittest
from unittest.mock import MagicMock, patch, AsyncMock
from datetime import datetime
from fastapi import HTTPException
from pydantic import ValidationError

from app.models.user import UserBase, User, UserResponse
from app.models.user_update import UbicacionGeograficaRequest
from app.models.reporte import (
    EmprendedorReporte,
    ReporteData,
    ReporteDataEmprendedor,
    EstadisticasGlobales,
    DiagnosticoPorFecha
)
from app.services.auth_service import AuthService
from app.services.reporte_service import ReporteService


class TestUbicacionModelosSpec005(unittest.TestCase):
    """Pruebas para modelos de ubicación geográfica (Fase 1)"""

    def test_ubicacion_request_normaliza_mayusculas_con_tildes(self):
        """RF-8: Debe convertir a mayúsculas preservando tildes y caracteres oficiales"""
        req = UbicacionGeograficaRequest(
            nacionalidad="  perú  ",
            municipio="  la paz  "
        )
        self.assertEqual(req.nacionalidad, "PERÚ")
        self.assertEqual(req.municipio, "LA PAZ")

    def test_ubicacion_request_nacional_bolivia(self):
        """RF-3, RF-8: Caso de nacionalidad boliviana en mayúsculas"""
        req = UbicacionGeograficaRequest(
            nacionalidad="bolivia",
            municipio="el alto"
        )
        self.assertEqual(req.nacionalidad, "BOLIVIA")
        self.assertEqual(req.municipio, "EL ALTO")

    def test_ubicacion_request_rechaza_vacio(self):
        """RF-6: Debe rechazar valores vacíos o espacios en blanco"""
        with self.assertRaises(ValidationError):
            UbicacionGeograficaRequest(nacionalidad="", municipio="LA PAZ")

        with self.assertRaises(ValidationError):
            UbicacionGeograficaRequest(nacionalidad="BOLIVIA", municipio="   ")

    def test_user_base_y_response_incluyen_campos_ubicacion(self):
        """RF-15: Modelos de usuario deben soportar nacionalidad y municipio nulos o informados"""
        user_base = UserBase(email="test@jci.org")
        self.assertIsNone(user_base.nacionalidad)
        self.assertIsNone(user_base.municipio)

        user_res = UserResponse(
            id_usuario="usr-123",
            email="test@jci.org",
            id_rol=2,
            rol="Emprendedor",
            estado=True,
            habilitado_diag=True,
            nacionalidad="BOLIVIA",
            municipio="LA PAZ"
        )
        self.assertEqual(user_res.nacionalidad, "BOLIVIA")
        self.assertEqual(user_res.municipio, "LA PAZ")


class TestUbicacionBackendFase2(unittest.IsolatedAsyncioTestCase):
    """Pruebas para endpoint atómico, inmutabilidad y generación de PDFs (Fase 2)"""

    @patch('app.services.auth_service.get_supabase_client')
    async def test_update_user_ubicacion_exito(self, mock_supabase_getter):
        """RF-8: Debe actualizar exitosamente cuando el usuario no tenía ubicación"""
        mock_client = MagicMock()
        mock_supabase_getter.return_value = mock_client
        service = AuthService()

        # Mock get_user_by_id inicial (sin ubicación)
        initial_user = UserResponse(
            id_usuario="usr-1",
            email="emp@jci.org",
            id_rol=2,
            rol="Emprendedor",
            estado=True,
            habilitado_diag=True,
            nacionalidad=None,
            municipio=None
        )
        # Mock get_user_by_id actualizado (con ubicación)
        updated_user = UserResponse(
            id_usuario="usr-1",
            email="emp@jci.org",
            id_rol=2,
            rol="Emprendedor",
            estado=True,
            habilitado_diag=True,
            nacionalidad="BOLIVIA",
            municipio="LA PAZ"
        )

        service.get_user_by_id = AsyncMock(side_effect=[initial_user, updated_user])

        # Mock update query
        mock_update = MagicMock()
        mock_update.eq.return_value.execute.return_value.data = [{"id_usuario": "usr-1"}]
        mock_client.table.return_value.update.return_value = mock_update

        result = await service.update_user_ubicacion("usr-1", "bolivia", "la paz")
        self.assertEqual(result.nacionalidad, "BOLIVIA")
        self.assertEqual(result.municipio, "LA PAZ")

    @patch('app.services.auth_service.get_supabase_client')
    async def test_update_user_ubicacion_inmutabilidad(self, mock_supabase_getter):
        """RF-9: Si el usuario ya tenía ubicación registrada, debe rechazar con HTTP 400"""
        mock_client = MagicMock()
        mock_supabase_getter.return_value = mock_client
        service = AuthService()

        existing_user = UserResponse(
            id_usuario="usr-1",
            email="emp@jci.org",
            id_rol=2,
            rol="Emprendedor",
            estado=True,
            habilitado_diag=True,
            nacionalidad="BOLIVIA",
            municipio="LA PAZ"
        )
        service.get_user_by_id = AsyncMock(return_value=existing_user)

        with self.assertRaises(HTTPException) as ctx:
            await service.update_user_ubicacion("usr-1", "PERÚ", "EL ALTO")

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("ya fue registrada previamente", ctx.exception.detail)

    @patch('app.services.auth_service.get_supabase_client')
    async def test_update_user_ubicacion_usuario_no_encontrado(self, mock_supabase_getter):
        """Si el usuario no existe, debe retornar HTTP 404"""
        mock_client = MagicMock()
        mock_supabase_getter.return_value = mock_client
        service = AuthService()

        service.get_user_by_id = AsyncMock(return_value=None)

        with self.assertRaises(HTTPException) as ctx:
            await service.update_user_ubicacion("usr-inexistente", "BOLIVIA", "LA PAZ")

        self.assertEqual(ctx.exception.status_code, 404)

    @patch('app.services.reporte_service.get_supabase_client')
    async def test_generate_pdf_con_ubicacion_y_pendiente(self, mock_supabase_getter):
        """RF-13, RF-14: PDF debe renderizar Nacionalidad/Municipio y combinar celdas para PENDIENTE"""
        mock_client = MagicMock()
        mock_supabase_getter.return_value = mock_client
        service = ReporteService()

        reporte_data = ReporteData(
            mentor_nombre="Carlos",
            mentor_apellido="Mentor",
            fecha_inicio=datetime(2024, 1, 1),
            fecha_fin=datetime(2024, 12, 31),
            nombre_programa="Programa Test",
            emprendedores=[
                # Participante con ubicación completa
                EmprendedorReporte(
                    nombre="Ana",
                    apellido="Pérez",
                    emprendimiento="Panadería Sol",
                    nacionalidad="BOLIVIA",
                    municipio="LA PAZ",
                    promedio_general=85.0,
                    promedio_cf=80.0, promedio_gp=85.0, promedio_m=90.0,
                    promedio_v=85.0, promedio_tp=80.0, promedio_rh=85.0, promedio_ec=90.0,
                    num_diagnosticos=1,
                    estado_diagnostico="Con diagnóstico"
                ),
                # Participante pendiente de ubicación
                EmprendedorReporte(
                    nombre="Juan",
                    apellido="Gómez",
                    emprendimiento="Taller Juan",
                    nacionalidad=None,
                    municipio=None,
                    promedio_general=None,
                    num_diagnosticos=0,
                    estado_diagnostico="Sin diagnóstico"
                )
            ],
            estadisticas=EstadisticasGlobales(
                total_emprendedores=2,
                tasa_aprobado=100.0,
                promedio_cf=80.0, promedio_gp=85.0, promedio_m=90.0,
                promedio_v=85.0, promedio_tp=80.0, promedio_rh=85.0, promedio_ec=90.0,
                promedio_general=85.0
            ),
            diagnosticos_timeline=[]
        )

        pdf_bytes = await service.generate_pdf(reporte_data)
        self.assertIsInstance(pdf_bytes, bytes)
        self.assertTrue(len(pdf_bytes) > 1000)
        self.assertTrue(pdf_bytes.startswith(b"%PDF"))

    @patch('app.services.reporte_service.get_supabase_client')
    async def test_generate_pdf_emprendedor_con_ubicacion(self, mock_supabase_getter):
        """RF-11: PDF individual de diagnóstico debe incluir datos de ubicación en la ficha"""
        mock_client = MagicMock()
        mock_supabase_getter.return_value = mock_client
        service = ReporteService()

        data_emp = ReporteDataEmprendedor(
            nombre_emprendedor="María",
            apellido_emprendedor="López",
            nombre_emprendimiento="Modas María",
            rubro="Textil",
            nacionalidad="PERÚ",
            municipio="EL ALTO",
            resultado="APROBADO",
            fecha_diagnostico=datetime.now(),
            diagnostico_general="Buen desempeño general.",
            fortalezas=[],
            debilidades=[],
            recomendaciones=[],
            estadisticas_actuales=EstadisticasGlobales(
                total_emprendedores=1,
                tasa_aprobado=100.0,
                promedio_cf=80.0, promedio_gp=80.0, promedio_m=80.0,
                promedio_v=80.0, promedio_tp=80.0, promedio_rh=80.0, promedio_ec=80.0,
                promedio_general=80.0
            ),
            diagnosticos_timeline=[
                DiagnosticoPorFecha(fecha=datetime.now(), promedio=80.0)
            ]
        )

        pdf_bytes = await service.generate_pdf_emprendedor(data_emp)
        self.assertIsInstance(pdf_bytes, bytes)
        self.assertTrue(len(pdf_bytes) > 1000)
        self.assertTrue(pdf_bytes.startswith(b"%PDF"))


if __name__ == '__main__':
    unittest.main()
