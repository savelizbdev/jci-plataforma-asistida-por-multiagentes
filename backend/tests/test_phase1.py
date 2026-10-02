"""
Pruebas unitarias para la Fase 1 de la Spec 001:
T-1.1: Endpoint /asignaciones/mentores enriquecido con programas_ids
T-1.2: Endpoint /asignaciones/emprendedores-sin-mentor enriquecido con programas_ids
T-1.3: Endpoint PATCH /auth/{user_id}/toggle-status
T-1.4: Endpoint /asignaciones/tareas/mis-tareas con nombre_programa
"""
import unittest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app


class TestFase1Backend(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)

    @patch("app.routers.asignaciones.get_supabase_client")
    @patch("app.routers.asignaciones._get_org_user_ids")
    def test_t1_1_obtener_mentores_con_programas_ids(self, mock_get_org_users, mock_get_supabase):
        """T-1.1: Debe retornar mentores incluyendo la lista de programas_ids a los que pertenece cada uno"""
        mock_get_org_users.return_value = ["mentor-uuid-1", "mentor-uuid-2"]
        mock_supabase = MagicMock()
        mock_get_supabase.return_value = mock_supabase

        # Simular usuarios mentores
        mock_query_users = MagicMock()
        mock_query_users.select.return_value = mock_query_users
        mock_query_users.eq.return_value = mock_query_users
        mock_query_users.in_.return_value = mock_query_users
        mock_query_users.execute.return_value = MagicMock(data=[
            {"id_usuario": "mentor-uuid-1", "nombre": "Carlos", "apellido": "Mentor", "email": "carlos@test.com"},
            {"id_usuario": "mentor-uuid-2", "nombre": "Ana", "apellido": "Guia", "email": "ana@test.com"}
        ])

        # Simular usuario_programa
        mock_query_up = MagicMock()
        mock_query_up.select.return_value = mock_query_up
        mock_query_up.in_.return_value = mock_query_up
        mock_query_up.execute.return_value = MagicMock(data=[
            {"id_usuario": "mentor-uuid-1", "id_programa": 10},
            {"id_usuario": "mentor-uuid-1", "id_programa": 20},
            {"id_usuario": "mentor-uuid-2", "id_programa": 20}
        ])

        def table_side_effect(table_name):
            if table_name == "usuario":
                return mock_query_users
            elif table_name == "usuario_programa":
                return mock_query_up
            return MagicMock()

        mock_supabase.table.side_effect = table_side_effect

        response = self.client.get("/asignaciones/mentores?admin_id=admin-uuid-1")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 2)
        
        # Verificar que contiene programas_ids
        mentor_1 = next(m for m in data if m["id_usuario"] == "mentor-uuid-1")
        self.assertIn("programas_ids", mentor_1)
        self.assertEqual(sorted(mentor_1["programas_ids"]), [10, 20])

        mentor_2 = next(m for m in data if m["id_usuario"] == "mentor-uuid-2")
        self.assertIn("programas_ids", mentor_2)
        self.assertEqual(mentor_2["programas_ids"], [20])

    @patch("app.routers.asignaciones.get_supabase_client")
    @patch("app.routers.asignaciones._get_org_user_ids")
    def test_t1_2_obtener_emprendedores_sin_mentor_con_programas_ids(self, mock_get_org_users, mock_get_supabase):
        """T-1.2: Debe retornar emprendedores sin mentor con sus programas_ids"""
        mock_get_org_users.return_value = None  # sin filtro org
        mock_supabase = MagicMock()
        mock_get_supabase.return_value = mock_supabase

        # Emprendedores
        mock_query_users = MagicMock()
        mock_query_users.select.return_value = mock_query_users
        mock_query_users.eq.return_value = mock_query_users
        mock_query_users.execute.return_value = MagicMock(data=[
            {"id_usuario": "emp-uuid-1", "nombre": "Juan", "apellido": "Perez", "email": "juan@test.com"},
            {"id_usuario": "emp-uuid-2", "nombre": "Maria", "apellido": "Lopez", "email": "maria@test.com"}
        ])

        # Asignaciones existentes (ninguno tiene mentor asignado)
        mock_query_asig = MagicMock()
        mock_query_asig.select.return_value = mock_query_asig
        mock_query_asig.execute.return_value = MagicMock(data=[])

        # usuario_programa
        mock_query_up = MagicMock()
        mock_query_up.select.return_value = mock_query_up
        mock_query_up.in_.return_value = mock_query_up
        mock_query_up.execute.return_value = MagicMock(data=[
            {"id_usuario": "emp-uuid-1", "id_programa": 10},
            {"id_usuario": "emp-uuid-2", "id_programa": 30}
        ])

        def table_side_effect(table_name):
            if table_name == "usuario":
                return mock_query_users
            elif table_name == "asignacion_mentor":
                return mock_query_asig
            elif table_name == "usuario_programa":
                return mock_query_up
            return MagicMock()

        mock_supabase.table.side_effect = table_side_effect

        response = self.client.get("/asignaciones/emprendedores-sin-mentor")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 2)

        emp_1 = next(e for e in data if e["id_usuario"] == "emp-uuid-1")
        self.assertIn("programas_ids", emp_1)
        self.assertEqual(emp_1["programas_ids"], [10])

        emp_2 = next(e for e in data if e["id_usuario"] == "emp-uuid-2")
        self.assertIn("programas_ids", emp_2)
        self.assertEqual(emp_2["programas_ids"], [30])

    @patch("app.services.auth_service.get_supabase_client")
    def test_t1_3_toggle_user_status(self, mock_get_supabase):
        """T-1.3: PATCH /auth/{user_id}/toggle-status debe invertir el booleano estado"""
        mock_supabase = MagicMock()
        mock_get_supabase.return_value = mock_supabase

        # Select estado actual (True)
        mock_query = MagicMock()
        mock_query.select.return_value = mock_query
        mock_query.eq.return_value = mock_query
        mock_query.execute.return_value = MagicMock(data=[{"estado": True}])

        # Update a False
        mock_update = MagicMock()
        mock_update.update.return_value = mock_update
        mock_update.eq.return_value = mock_update
        mock_update.execute.return_value = MagicMock(data=[{"estado": False}])

        def table_side_effect(table_name):
            if table_name == "usuario":
                mock_table = MagicMock()
                mock_table.select.return_value = mock_query
                mock_table.update.return_value = mock_update
                return mock_table
            return MagicMock()

        mock_supabase.table.side_effect = table_side_effect

        response = self.client.patch("/auth/user-uuid-1/toggle-status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["id_usuario"], "user-uuid-1")
        self.assertEqual(data["estado"], False)

    @patch("app.routers.asignaciones.get_supabase_client")
    def test_t1_4_mis_tareas_con_nombre_programa(self, mock_get_supabase):
        """T-1.4: GET /asignaciones/tareas/mis-tareas debe incluir nombre_programa en cada tarea"""
        mock_supabase = MagicMock()
        mock_get_supabase.return_value = mock_supabase

        # Tareas del usuario
        mock_query_tarea = MagicMock()
        mock_query_tarea.select.return_value = mock_query_tarea
        mock_query_tarea.eq.return_value = mock_query_tarea
        mock_query_tarea.order.return_value = mock_query_tarea
        mock_query_tarea.execute.return_value = MagicMock(data=[
            {
                "id_tarea": 1,
                "id_usuario": "user-uuid-1",
                "titulo": "Definir propuesta de valor",
                "descripcion": "Completar canvas",
                "estado": "Pendiente",
                "fecha_expiracion": "2026-10-15T00:00:00Z"
            }
        ])

        # Programas del usuario
        mock_query_up = MagicMock()
        mock_query_up.select.return_value = mock_query_up
        mock_query_up.eq.return_value = mock_query_up
        mock_query_up.execute.return_value = MagicMock(data=[
            {"id_programa": 10, "programa": {"nombre": "Incubadora 2026"}}
        ])

        def table_side_effect(table_name):
            if table_name == "tarea":
                return mock_query_tarea
            elif table_name == "usuario_programa":
                return mock_query_up
            return MagicMock()

        mock_supabase.table.side_effect = table_side_effect

        response = self.client.get("/asignaciones/tareas/mis-tareas?user_id=user-uuid-1")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(len(data), 1)
        self.assertIn("nombre_programa", data[0])
        self.assertEqual(data[0]["nombre_programa"], "Incubadora 2026")


if __name__ == "__main__":
    unittest.main()
