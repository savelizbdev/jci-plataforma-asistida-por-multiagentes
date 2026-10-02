"""
Pruebas unitarias para la Fase 1 de la Spec 0002:
Servicio determinista de seguimiento de tareas (seguimiento_service.py)

T-1.1: Consulta y aislamiento de tareas pendientes por organización (RF-1, RF-2)
T-1.2: Agrupación por emprendedor y vinculación de programas (RF-3)
T-1.3: Formateo de fechas a hora de Bolivia (America/La_Paz) y validación de correos (RF-4, RF-5)
T-1.4: Construcción de plantilla HTML y asunto dinámico (RF-8)
T-1.5: Despacho persistente Gmail SMTP SSL y manejo de errores por lote (RF-6, RF-7, RF-9, RF-10, RF-11, RF-12)
"""
import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone, timedelta
import smtplib


class TestSeguimientoService(unittest.TestCase):

    # -----------------------------------------------------------------------
    # T-1.1: Consulta y aislamiento por organización (RF-1, RF-2)
    # -----------------------------------------------------------------------
    @patch("app.services.seguimiento_service.get_admin_org_user_ids")
    def test_t1_1_obtener_tareas_pendientes_con_resultados(self, mock_get_org_users):
        """RF-1: Debe consultar y retornar tareas de usuarios de la organización en ventana de 2 días"""
        from app.services.seguimiento_service import obtener_tareas_pendientes_org

        mock_get_org_users.return_value = ["emp-uuid-1", "emp-uuid-2"]
        mock_supabase = MagicMock()

        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.neq.return_value = mock_query
        mock_query.lte.return_value = mock_query
        mock_query.gte.return_value = mock_query
        mock_query.in_.return_value = mock_query

        ahora = datetime.now(timezone.utc)
        fecha_venc = (ahora + timedelta(days=1)).isoformat()

        mock_query.execute.return_value = MagicMock(data=[
            {
                "id_tarea": 101,
                "id_usuario": "emp-uuid-1",
                "titulo": "Preparar pitch",
                "descripcion": "Revisar slides",
                "fecha_expiracion": fecha_venc,
                "estado": "Pendiente"
            }
        ])
        mock_supabase.table.return_value = mock_query

        tareas = obtener_tareas_pendientes_org(admin_id="admin-uuid-1", supabase=mock_supabase)
        self.assertEqual(len(tareas), 1)
        self.assertEqual(tareas[0]["id_tarea"], 101)
        self.assertEqual(tareas[0]["titulo"], "Preparar pitch")

    @patch("app.services.seguimiento_service.get_admin_org_user_ids")
    def test_t1_1_sin_organizacion_o_sin_usuarios(self, mock_get_org_users):
        """RF-2: Si el admin no tiene organización o usuarios, retorna lista vacía sin consultar tareas"""
        from app.services.seguimiento_service import obtener_tareas_pendientes_org

        mock_get_org_users.return_value = []
        mock_supabase = MagicMock()

        tareas = obtener_tareas_pendientes_org(admin_id="admin-sin-org", supabase=mock_supabase)
        self.assertEqual(tareas, [])
        mock_supabase.table.assert_not_called()

    # -----------------------------------------------------------------------
    # T-1.2: Agrupación por emprendedor y vinculación de programa (RF-3)
    # -----------------------------------------------------------------------
    def test_t1_2_agrupar_tareas_por_emprendedor(self):
        """RF-3: Agrupa múltiples tareas de un mismo emprendedor con sus datos y programas"""
        from app.services.seguimiento_service import agrupar_tareas_por_emprendedor

        mock_supabase = MagicMock()
        tareas = [
            {
                "id_tarea": 1,
                "id_usuario": "emp-1",
                "titulo": "Tarea 1",
                "descripcion": "Desc 1",
                "fecha_expiracion": "2026-10-04T16:00:00Z",
                "estado": "Pendiente"
            },
            {
                "id_tarea": 2,
                "id_usuario": "emp-1",
                "titulo": "Tarea 2",
                "descripcion": "Desc 2",
                "fecha_expiracion": "2026-10-04T18:00:00Z",
                "estado": "En progreso"
            }
        ]

        # Mock para usuarios
        mock_query_users = MagicMock()
        mock_query_users.select.return_value = mock_query_users
        mock_query_users.in_.return_value = mock_query_users
        mock_query_users.execute.return_value = MagicMock(data=[
            {"id_usuario": "emp-1", "nombre": "María", "apellido": "Pérez", "email": "maria@test.com"}
        ])

        # Mock para usuario_programa
        mock_query_up = MagicMock()
        mock_query_up.select.return_value = mock_query_up
        mock_query_up.in_.return_value = mock_query_up
        mock_query_up.execute.return_value = MagicMock(data=[
            {"id_usuario": "emp-1", "id_programa": 5, "programa": {"nombre": "Activa Mujer 2026"}}
        ])

        def table_side_effect(table_name):
            if table_name == "usuario":
                return mock_query_users
            elif table_name == "usuario_programa":
                return mock_query_up
            return MagicMock()

        mock_supabase.table.side_effect = table_side_effect

        agrupados = agrupar_tareas_por_emprendedor(tareas, supabase=mock_supabase)
        self.assertEqual(len(agrupados), 1)
        emp = agrupados[0]
        self.assertEqual(emp["id_usuario"], "emp-1")
        self.assertEqual(emp["nombre_completo"], "María Pérez")
        self.assertEqual(emp["email"], "maria@test.com")
        self.assertEqual(len(emp["tareas"]), 2)
        self.assertEqual(emp["tareas"][0]["nombre_programa"], "Activa Mujer 2026")

    # -----------------------------------------------------------------------
    # T-1.3: Formateo de fechas a hora Bolivia y validación de correos (RF-4, RF-5)
    # -----------------------------------------------------------------------
    def test_t1_3_formatear_fecha_bolivia(self):
        """RF-4: Convierte timestamp UTC a hora de Bolivia America/La_Paz (UTC-4)"""
        from app.services.seguimiento_service import formatear_fecha_bolivia

        # 16:00 UTC en Bolivia (UTC-4) son las 12:00
        fecha_utc = "2026-10-04T16:00:00+00:00"
        resultado = formatear_fecha_bolivia(fecha_utc)
        self.assertEqual(resultado, "04/10/2026 a las 12:00")

    def test_t1_3_validar_email(self):
        """RF-5: Valida sintaxis básica de correo electrónico"""
        from app.services.seguimiento_service import es_email_valido

        self.assertTrue(es_email_valido("usuario@empresa.com"))
        self.assertTrue(es_email_valido("juan.perez+test@jci.org.bo"))
        self.assertFalse(es_email_valido(""))
        self.assertFalse(es_email_valido(None))
        self.assertFalse(es_email_valido("invalido@"))
        self.assertFalse(es_email_valido("sin-arroba.com"))

    # -----------------------------------------------------------------------
    # T-1.4: Plantilla HTML y asunto dinámico (RF-8)
    # -----------------------------------------------------------------------
    def test_t1_4_generar_correo_una_tarea(self):
        """RF-8: Una tarea genera asunto singular y tarjeta destacada con nombre de programa"""
        from app.services.seguimiento_service import generar_correo_emprendedor

        tareas = [{
            "id_tarea": 1,
            "titulo": "Completar canvas",
            "descripcion": "Llenar módulo financiero",
            "fecha_legible": "04/10/2026 a las 18:00",
            "nombre_programa": "Programa Incubadora"
        }]

        asunto, html = generar_correo_emprendedor("Laura Gómez", tareas)
        self.assertIn("1 tarea próxima a vencer - Completar canvas", asunto)
        self.assertIn("Programa Incubadora", html)
        self.assertIn("Completar canvas", html)
        self.assertIn("Llenar módulo financiero", html)

    def test_t1_4_generar_correo_multiples_tareas(self):
        """RF-8: Múltiples tareas generan asunto plural y lista detallada rotulando programas"""
        from app.services.seguimiento_service import generar_correo_emprendedor

        tareas = [
            {
                "id_tarea": 1,
                "titulo": "Tarea A",
                "descripcion": "",
                "fecha_legible": "04/10/2026 a las 10:00",
                "nombre_programa": "Programa Alpha"
            },
            {
                "id_tarea": 2,
                "titulo": "Tarea B",
                "descripcion": "Desc B",
                "fecha_legible": "05/10/2026 a las 15:00",
                "nombre_programa": "Programa Beta"
            }
        ]

        asunto, html = generar_correo_emprendedor("Carlos Rojas", tareas)
        self.assertEqual(asunto, "⏰ Recordatorio: Tienes 2 tareas próximas a vencer")
        self.assertIn("Programa Alpha", html)
        self.assertIn("Programa Beta", html)
        self.assertIn("Tarea A", html)
        self.assertIn("Tarea B", html)

    # -----------------------------------------------------------------------
    # T-1.5: Despacho persistente Gmail SMTP SSL y manejo de errores (RF-6 a RF-12)
    # -----------------------------------------------------------------------
    @patch.dict("os.environ", {"EMAIL_SENDER": "notificaciones@jci.org", "EMAIL_PASSWORD": "app-password-123"})
    @patch("smtplib.SMTP_SSL")
    def test_t1_5_despacho_smtp_exito(self, mock_smtp_cls):
        """RF-6, RF-10, RF-11: Una única sesión SMTP despacha el lote y finaliza con server.quit()"""
        from app.services.seguimiento_service import despachar_lote_correos

        mock_server = MagicMock()
        mock_smtp_cls.return_value = mock_server

        emprendedores = [
            {
                "id_usuario": "emp-1",
                "nombre_completo": "Ana Torres",
                "email": "ana@test.com",
                "tareas": [{
                    "id_tarea": 1,
                    "titulo": "Tarea 1",
                    "descripcion": "Desc",
                    "fecha_legible": "04/10/2026 a las 14:00",
                    "nombre_programa": "Prog 1"
                }]
            }
        ]

        resultado = despachar_lote_correos(emprendedores, total_tareas_detectadas=1)
        self.assertEqual(resultado["enviados_exitosos"], 1)
        self.assertEqual(resultado["fallidos"], 0)
        self.assertEqual(len(resultado["errores_detalle"]), 0)
        self.assertIn("1 correo(s) enviado(s)", resultado["resumen_agente"])
        mock_server.login.assert_called_once_with("notificaciones@jci.org", "app-password-123")
        self.assertEqual(mock_server.sendmail.call_count, 1)

    @patch.dict("os.environ", {"EMAIL_SENDER": "notificaciones@jci.org", "EMAIL_PASSWORD": "app-password-123"})
    @patch("smtplib.SMTP_SSL")
    def test_t1_5_despacho_smtp_tolerancia_fallos(self, mock_smtp_cls):
        """RF-7, RF-9: Si falla un envío por SMTP, continúa con los demás y registra el error"""
        from app.services.seguimiento_service import despachar_lote_correos

        mock_server = MagicMock()
        # Primer envío falla con excepción SMTP, segundo envío tiene éxito
        mock_server.sendmail.side_effect = [
            smtplib.SMTPRecipientsRefused({"fallo@test.com": (550, b"User not found")}),
            None
        ]
        mock_smtp_cls.return_value = mock_server

        emprendedores = [
            {
                "id_usuario": "emp-fallo",
                "nombre_completo": "Usuario Fallo",
                "email": "fallo@test.com",
                "tareas": [{"id_tarea": 1, "titulo": "T1", "descripcion": "", "fecha_legible": "04/10", "nombre_programa": "P1"}]
            },
            {
                "id_usuario": "emp-exito",
                "nombre_completo": "Usuario Exito",
                "email": "exito@test.com",
                "tareas": [{"id_tarea": 2, "titulo": "T2", "descripcion": "", "fecha_legible": "04/10", "nombre_programa": "P1"}]
            }
        ]

        resultado = despachar_lote_correos(emprendedores, total_tareas_detectadas=2)
        self.assertEqual(resultado["enviados_exitosos"], 1)
        self.assertEqual(resultado["fallidos"], 1)
        self.assertEqual(len(resultado["errores_detalle"]), 1)
        self.assertEqual(resultado["errores_detalle"][0]["id_usuario"], "emp-fallo")

    # -----------------------------------------------------------------------
    # Fase 2: Router de Seguimiento (RF-11, RF-12, RF-17)
    # -----------------------------------------------------------------------
    def test_t2_1_endpoint_tareas_proximas_eliminado(self):
        """RF-17: GET /seguimiento/tareas-proximas debe responder 404 Not Found al haber sido retirado"""
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)
        response = client.get("/seguimiento/tareas-proximas")
        self.assertEqual(response.status_code, 404)

    @patch("app.routers.seguimiento.ejecutar_proceso_seguimiento")
    def test_t2_2_endpoint_ejecutar_exito(self, mock_ejecutar):
        """RF-11: POST /seguimiento/ejecutar debe invocar el servicio y retornar estructura completa"""
        from fastapi.testclient import TestClient
        from app.main import app

        mock_ejecutar.return_value = {
            "mensaje": "Proceso de seguimiento ejecutado correctamente.",
            "total_tareas": 3,
            "total_emprendedores": 2,
            "enviados_exitosos": 2,
            "fallidos": 0,
            "errores_detalle": [],
            "resumen_agente": "Se procesaron 2 emprendedor(es) con un total de 3 tarea(s)."
        }

        client = TestClient(app)
        response = client.post("/seguimiento/ejecutar", json={"admin_id": "admin-uuid-1"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["total_tareas"], 3)
        self.assertEqual(data["enviados_exitosos"], 2)
        mock_ejecutar.assert_called_once_with(admin_id="admin-uuid-1")

    @patch("app.routers.seguimiento.ejecutar_proceso_seguimiento")
    def test_t2_2_endpoint_ejecutar_error_credenciales(self, mock_ejecutar):
        """RF-12: POST /seguimiento/ejecutar debe retornar 500 ante error de credenciales o ejecución"""
        from fastapi.testclient import TestClient
        from app.main import app

        mock_ejecutar.side_effect = ValueError("Credenciales de correo no configuradas.")

        client = TestClient(app)
        response = client.post("/seguimiento/ejecutar", json={"admin_id": "admin-uuid-1"})
        self.assertEqual(response.status_code, 500)
        self.assertIn("Credenciales de correo no configuradas", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
