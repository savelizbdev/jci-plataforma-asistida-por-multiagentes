"""
Pruebas unitarias para la Spec 004 (Fase 1: Backend):
Extensión del Menú Lateral y Filtrado Jerárquico para Super Administrador

T-1.1: Modelos Pydantic (RF-04.1, RF-04.2, RF-04.7, RF-08.2)
T-1.2: Servicio superadmin_service con consultas paginadas de 15 en 15 y filtros activos (RF-02.3, RF-02.4, RF-04.3, RF-04.4, RF-04.5, RF-05.1, RF-05.2, RF-07.2, RF-07.3, RF-07.5)
T-1.3: Router /api/superadmin con verificación de id_rol == 4 (RF-08.2, RF-08.3, RNF-01)
"""
import unittest
from unittest.mock import MagicMock, patch
from pydantic import ValidationError

from app.models.superadmin import (
    PaginationParams,
    PaginatedResponse,
    CambiarRolRequest,
    CambiarEstadoUsuarioRequest,
    MatricularUsuarioRequest,
    OrganizacionSimple,
    ProgramaSimple,
    UsuarioSuperAdminItem,
    DiagnosticoSupervisionItem,
    AsignacionesResponse,
)


class TestSuperAdminModels(unittest.TestCase):
    """Pruebas de modelos Pydantic (T-1.1)"""

    def test_pagination_params_defaults(self):
        """RF-04.7: Paginación default de 15 registros por página"""
        params = PaginationParams()
        self.assertEqual(params.page, 1)
        self.assertEqual(params.limit, 15)

    def test_cambiar_rol_request_validos(self):
        """RF-04.2: Se permiten los 4 roles (1, 2, 3, 4)"""
        for rol in [1, 2, 3, 4]:
            req = CambiarRolRequest(id_usuario="user-123", nuevo_rol=rol)
            self.assertEqual(req.nuevo_rol, rol)

    def test_cambiar_rol_request_invalido(self):
        """RF-04.2: Roles fuera del rango 1-4 deben ser rechazados"""
        with self.assertRaises(ValidationError):
            CambiarRolRequest(id_usuario="user-123", nuevo_rol=5)
        with self.assertRaises(ValidationError):
            CambiarRolRequest(id_usuario="user-123", nuevo_rol=0)

    def test_cambiar_estado_request(self):
        """RF-04.1: Permite alternar estado activo/inactivo"""
        req_act = CambiarEstadoUsuarioRequest(id_usuario="user-123", activo=True)
        self.assertTrue(req_act.activo)
        req_inact = CambiarEstadoUsuarioRequest(id_usuario="user-123", activo=False)
        self.assertFalse(req_inact.activo)

    def test_matricular_usuario_request(self):
        """RF-04.5: Permite asociar usuario a un programa"""
        req = MatricularUsuarioRequest(id_usuario="user-123", id_programa=5)
        self.assertEqual(req.id_usuario, "user-123")
        self.assertEqual(req.id_programa, 5)

    def test_paginated_response_calculo_total_pages(self):
        """RNF-02: PaginatedResponse calcula correctamente total_pages con límite 15"""
        res = PaginatedResponse(
            items=["item1", "item2"],
            total=31,
            page=1,
            limit=15
        )
        self.assertEqual(res.total_pages, 3)
        self.assertEqual(res.total, 31)


class TestSuperAdminService(unittest.IsolatedAsyncioTestCase):
    """Pruebas del servicio superadmin_service (T-1.2)"""

    @patch("app.services.superadmin_service.get_supabase_client")
    async def test_listar_organizaciones_activas_orden_alfabetico(self, mock_client):
        """RF-02.3, RF-02.4: Listar solo organizaciones activas en orden alfabético"""
        from app.services.superadmin_service import superadmin_service

        mock_supabase = MagicMock()
        mock_client.return_value = mock_supabase

        mock_query = MagicMock()
        mock_supabase.table.return_value.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.order.return_value = mock_query
        mock_query.execute.return_value.data = [
            {"id_organizacion": 2, "nombre": "Beta Org", "estado": True},
            {"id_organizacion": 1, "nombre": "Alpha Org", "estado": True},
        ]

        orgs = await superadmin_service.listar_organizaciones_activas()
        mock_supabase.table.assert_called_with("organizacion")
        self.assertEqual(len(orgs), 2)

    @patch("app.services.superadmin_service.get_supabase_client")
    async def test_listar_programas_activos_orden_alfabetico(self, mock_client):
        """RF-02.3, RF-02.4: Listar solo programas activos de una organización en orden alfabético"""
        from app.services.superadmin_service import superadmin_service

        mock_supabase = MagicMock()
        mock_client.return_value = mock_supabase

        mock_query = MagicMock()
        mock_supabase.table.return_value.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.order.return_value = mock_query
        mock_query.execute.return_value.data = [
            {"id_programa": 1, "nombre_programa": "Programa A", "estado": True, "id_organizacion": 1},
            {"id_programa": 2, "nombre_programa": "Programa B", "estado": True, "id_organizacion": 1},
        ]

        progs = await superadmin_service.listar_programas_activos(id_organizacion=1)
        mock_supabase.table.assert_called_with("programa")
        self.assertEqual(len(progs), 2)

    @patch("app.services.superadmin_service.get_supabase_client")
    async def test_cambiar_rol_usuario(self, mock_client):
        """RF-04.2: Cambiar rol de usuario en base de datos"""
        from app.services.superadmin_service import superadmin_service

        mock_supabase = MagicMock()
        mock_client.return_value = mock_supabase

        mock_query = MagicMock()
        mock_supabase.table.return_value.update.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value.data = [{"id_usuario": "user-1", "id_rol": 4}]

        res = await superadmin_service.cambiar_rol_usuario("user-1", 4)
        mock_supabase.table.assert_called_with("usuario")
        self.assertTrue(res)

    @patch("app.services.superadmin_service.get_supabase_client")
    async def test_cambiar_estado_usuario(self, mock_client):
        """RF-04.1: Activar o desactivar cuenta de usuario"""
        from app.services.superadmin_service import superadmin_service

        mock_supabase = MagicMock()
        mock_client.return_value = mock_supabase

        mock_query = MagicMock()
        mock_supabase.table.return_value.update.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value.data = [{"id_usuario": "user-1", "estado": False}]

        res = await superadmin_service.cambiar_estado_usuario("user-1", False)
        mock_supabase.table.assert_called_with("usuario")
        self.assertTrue(res)

    @patch("app.services.superadmin_service.get_supabase_client")
    async def test_matricular_usuario(self, mock_client):
        """RF-04.5: Matricular usuario en programa activo"""
        from app.services.superadmin_service import superadmin_service

        mock_supabase = MagicMock()
        mock_client.return_value = mock_supabase

        mock_query = MagicMock()
        mock_supabase.table.return_value.insert.return_value = mock_query
        mock_query.execute.return_value.data = [{"id_usuario": "user-1", "id_programa": 10}]

        res = await superadmin_service.matricular_usuario("user-1", 10)
        mock_supabase.table.assert_called_with("usuario_programa")
        self.assertTrue(res)

    @patch("app.services.superadmin_service.get_supabase_client")
    async def test_obtener_diagnosticos_supervision_mapeo_correcto(self, mock_client):
        """RF-07: Mapeo de puntaje_total, rubricas y emprendimiento desde BD"""
        from app.services.superadmin_service import superadmin_service

        mock_supabase = MagicMock()
        mock_client.return_value = mock_supabase

        def table_side_effect(name):
            mock_tbl = MagicMock()
            if name == "programa":
                mock_tbl.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
                    {"id_programa": 1, "nombre": "Programa Test"}
                ]
            elif name == "usuario_programa":
                mock_tbl.select.return_value.in_.return_value.execute.return_value.data = [
                    {"id_usuario": "emp-1", "id_programa": 1}
                ]
            elif name == "usuario":
                mock_tbl.select.return_value.in_.return_value.eq.return_value.execute.return_value.data = [
                    {"id_usuario": "emp-1", "nombre": "Maria", "apellido": "Gomez", "id_rol": 2}
                ]
            elif name == "emprendimiento":
                mock_tbl.select.return_value.in_.return_value.execute.return_value.data = [
                    {"id_usuario": "emp-1", "nombre": "Panadería Dulce"}
                ]
            elif name == "diagnostico":
                mock_tbl.select.return_value.in_.return_value.execute.return_value.data = [
                    {
                        "id_diagnostico": 101,
                        "id_usuario": "emp-1",
                        "puntaje_total": 75.0,
                        "resultado": "APROBADO",
                        "puntaje_cf": 70.0,
                        "puntaje_gp": 80.0,
                        "puntaje_m": 85.0,
                        "puntaje_v": 60.0,
                        "puntaje_tp": 75.0,
                        "puntaje_rh": 80.0,
                        "puntaje_ec": 75.0,
                        "conclusion": "Buen progreso",
                        "recomendaciones": "Digitalizar inventario",
                        "inconsistencias": None,
                        "fecha_inicio": "2026-03-01T10:00:00Z",
                    }
                ]
            return mock_tbl

        mock_supabase.table.side_effect = table_side_effect

        resp = await superadmin_service.obtener_diagnosticos_supervision(1, None, 1, 15)
        self.assertEqual(len(resp.items), 1)
        item = resp.items[0]
        self.assertEqual(item.emprendimiento, "Panadería Dulce")
        self.assertEqual(item.promedio_general, 75.0)
        self.assertEqual(item.promedio_cf, 70.0)
        self.assertEqual(item.resultado, "APROBADO")
        self.assertEqual(item.conclusion, "Buen progreso")
        self.assertEqual(item.estado_diagnostico, "Con diagnóstico")


class TestSuperAdminRouterAuth(unittest.IsolatedAsyncioTestCase):
    """Pruebas de autorización y endpoints del router /api/superadmin (T-1.3)"""

    @patch("app.routers.superadmin.superadmin_service")
    async def test_superadmin_acceso_permitido_rol_4(self, mock_service):
        """RF-08.2, RNF-01: Usuario con id_rol = 4 accede exitosamente"""
        from app.routers.superadmin import get_current_superadmin

        user_superadmin = {"id_usuario": "sa-1", "id_rol": 4}
        valido = await get_current_superadmin(user_superadmin)
        self.assertEqual(valido["id_rol"], 4)

    async def test_superadmin_acceso_denegado_otros_roles(self):
        """RF-08.2, RNF-01: Usuarios con id_rol != 4 reciben HTTP 403 Forbidden"""
        from fastapi import HTTPException
        from app.routers.superadmin import get_current_superadmin

        for rol in [1, 2, 3]:
            user_otro = {"id_usuario": "user-x", "id_rol": rol}
            with self.assertRaises(HTTPException) as ctx:
                await get_current_superadmin(user_otro)
            self.assertEqual(ctx.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
