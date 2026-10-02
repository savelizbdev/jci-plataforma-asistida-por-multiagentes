"""
Pruebas unitarias para la Spec 003:
Generación y Filtrado de Reportes por Programa y Asignación

T-1.1: Modelos Pydantic con id_programa y estado_diagnostico (RF-01, RF-04)
T-2.1: Corrección de NameError 'n' y división por cero en get_reporte_data_todos_mentores
T-2.2: Filtrado por programa y diagnóstico más reciente para Mentor (RF-02.1, RF-02.3, RF-04.1)
T-2.3: Filtrado y duplicación en consolidado de Administrador (RF-03.1, RF-03.2, RF-03.3)
T-2.4: Soporte unívoco 'Sin diagnóstico' sin alterar promedios globales (RF-04.2, RF-04.3, RF-04.4)
T-3.1, T-3.2: Generación segura de PDF con programa y filas 'Sin diagnóstico' (RF-05.1, RF-05.2, RF-05.3)
"""
import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone, timedelta
from app.models.reporte import (
    ReporteRequest,
    ReporteAdminRequest,
    ReporteTodosMentoresRequest,
    ReporteMentorRequest,
    EmprendedorReporte,
    ReporteData,
    EstadisticasGlobales,
    DiagnosticoPorFecha,
    ReporteDataTodosMentores,
    MentorResumenReporte,
)


class TestReportesSpec003(unittest.IsolatedAsyncioTestCase):

    # -----------------------------------------------------------------------
    # Fase 1: Modelos Pydantic (T-1.1)
    # -----------------------------------------------------------------------
    def test_t1_1_modelos_pydantic_id_programa(self):
        """RF-01: Los modelos de solicitud deben aceptar id_programa opcional"""
        req_mentor = ReporteRequest(
            id_mentor="mentor-uuid-1",
            fecha_inicio=datetime(2026, 1, 1),
            fecha_fin=datetime(2026, 12, 31),
            id_programa=10
        )
        self.assertEqual(req_mentor.id_programa, 10)

        req_admin = ReporteAdminRequest(
            fecha_inicio=datetime(2026, 1, 1),
            fecha_fin=datetime(2026, 12, 31),
            admin_id="admin-uuid-1",
            id_programa=20
        )
        self.assertEqual(req_admin.id_programa, 20)

        req_todos = ReporteTodosMentoresRequest(
            admin_id="admin-uuid-1",
            id_programa=30
        )
        self.assertEqual(req_todos.id_programa, 30)

    def test_t1_1_emprendedor_reporte_soporte_sin_diagnostico(self):
        """RF-04.2: EmprendedorReporte debe permitir promedio_general None y estado_diagnostico 'Sin diagnóstico'"""
        emp_con_diag = EmprendedorReporte(
            nombre="Ana",
            apellido="Perez",
            emprendimiento="EcoModa",
            promedio_general=85.5,
            promedio_cf=80.0,
            promedio_gp=90.0,
            promedio_m=85.0,
            promedio_v=85.0,
            promedio_tp=85.0,
            promedio_rh=85.0,
            promedio_ec=85.0,
            num_diagnosticos=1,
            estado_diagnostico="Con diagnóstico"
        )
        self.assertEqual(emp_con_diag.estado_diagnostico, "Con diagnóstico")
        self.assertEqual(emp_con_diag.promedio_general, 85.5)

        emp_sin_diag = EmprendedorReporte(
            nombre="Carlos",
            apellido="Gomez",
            emprendimiento="TechSol",
            promedio_general=None,
            promedio_cf=None,
            promedio_gp=None,
            promedio_m=None,
            promedio_v=None,
            promedio_tp=None,
            promedio_rh=None,
            promedio_ec=None,
            num_diagnosticos=0,
            estado_diagnostico="Sin diagnóstico"
        )
        self.assertEqual(emp_sin_diag.estado_diagnostico, "Sin diagnóstico")
        self.assertIsNone(emp_sin_diag.promedio_general)

    # -----------------------------------------------------------------------
    # Fase 2: Corrección Bug 'n' en Todos los Mentores (T-2.1)
    # -----------------------------------------------------------------------
    @patch("app.services.reporte_service.get_supabase_client")
    async def test_t2_1_bugfix_n_get_reporte_data_todos_mentores(self, mock_get_client):
        """T-2.1: get_reporte_data_todos_mentores no debe fallar con NameError 'n' y calcular correctamente"""
        from app.services.reporte_service import ReporteService

        service = ReporteService()
        mock_supabase = MagicMock()
        service.supabase = mock_supabase

        # Mock mentores
        mock_u_query = MagicMock()
        mock_u_query.select.return_value = mock_u_query
        mock_u_query.eq.return_value = mock_u_query
        mock_u_query.in_.return_value = mock_u_query
        mock_u_query.execute.return_value = MagicMock(data=[
            {"id_usuario": "m-1", "nombre": "Juan", "apellido": "Mentor"}
        ])

        # Mock asignaciones
        mock_a_query = MagicMock()
        mock_a_query.select.return_value = mock_a_query
        mock_a_query.in_.return_value = mock_a_query
        mock_a_query.execute.return_value = MagicMock(data=[
            {"id_mentor": "m-1", "id_emprendedor": "e-1"}
        ])

        # Mock diagnosticos con resultado aprobado
        mock_d_query = MagicMock()
        mock_d_query.select.return_value = mock_d_query
        mock_d_query.in_.return_value = mock_d_query
        mock_d_query.not_.is_.return_value = mock_d_query
        mock_d_query.execute.return_value = MagicMock(data=[
            {
                "id_usuario": "e-1",
                "id_diagnostico": 1,
                "resultado": "APROBADO",
                "fecha_inicio": "2026-03-01T10:00:00Z",
                "puntaje_cf": 70, "puntaje_gp": 70, "puntaje_m": 70,
                "puntaje_v": 70, "puntaje_tp": 70, "puntaje_rh": 70, "puntaje_ec": 70
            }
        ])

        def table_side_effect(table_name):
            if table_name == "usuario":
                return mock_u_query
            elif table_name == "asignacion_mentor":
                return mock_a_query
            elif table_name == "diagnostico":
                return mock_d_query
            return MagicMock()

        mock_supabase.table.side_effect = table_side_effect

        reporte_data = await service.get_reporte_data_todos_mentores()
        self.assertIsInstance(reporte_data, ReporteDataTodosMentores)
        self.assertEqual(len(reporte_data.mentores), 1)
        resumen_m = reporte_data.mentores[0]
        self.assertEqual(resumen_m.promedio_general, 70.0)
        self.assertEqual(resumen_m.tasa_aprobado, 100.0)

    # -----------------------------------------------------------------------
    # Fase 2: Filtrado por Programa y Diagnóstico Más Reciente para Mentor (T-2.2)
    # -----------------------------------------------------------------------
    @patch("app.services.reporte_service.get_supabase_client")
    async def test_t2_2_mentor_filtrado_por_programa_y_mas_reciente(self, mock_get_client):
        """RF-02.1, RF-02.3, RF-04.1: Mentor solo ve asignados en el programa y su diagnóstico más reciente"""
        from app.services.reporte_service import ReporteService

        service = ReporteService()
        mock_supabase = MagicMock()
        service.supabase = mock_supabase

        # Mentor data
        mock_u = MagicMock()
        mock_u.select.return_value = mock_u
        mock_u.eq.return_value = mock_u
        mock_u.execute.return_value = MagicMock(data=[{"nombre": "Laura", "apellido": "Paz"}])

        # Asignaciones (e-1 y e-2 asignados al mentor)
        mock_asig = MagicMock()
        mock_asig.select.return_value = mock_asig
        mock_asig.eq.return_value = mock_asig
        mock_asig.execute.return_value = MagicMock(data=[
            {"id_emprendedor": "e-1"},
            {"id_emprendedor": "e-2"}
        ])

        # Enrolamiento en programa: Solo e-1 está en el programa 101. e-2 está en otro programa
        mock_up = MagicMock()
        mock_up.select.return_value = mock_up
        mock_up.eq.return_value = mock_up
        mock_up.in_.return_value = mock_up
        mock_up.execute.return_value = MagicMock(data=[
            {"id_usuario": "e-1"}
        ])

        # Diagnósticos de e-1: Tiene 2 diagnósticos (uno viejo con 40 y uno reciente con 90)
        mock_diag = MagicMock()
        mock_diag.select.return_value = mock_diag
        mock_diag.in_.return_value = mock_diag
        mock_diag.gte.return_value = mock_diag
        mock_diag.lte.return_value = mock_diag
        mock_diag.execute.return_value = MagicMock(data=[
            {
                "id_usuario": "e-1",
                "id_diagnostico": 1,
                "fecha_inicio": "2026-01-10T10:00:00Z",
                "puntaje_total": 40.0,
                "puntaje_cf": 40, "puntaje_gp": 40, "puntaje_m": 40, "puntaje_v": 40, "puntaje_tp": 40, "puntaje_rh": 40, "puntaje_ec": 40,
                "resultado": "RECHAZADO"
            },
            {
                "id_usuario": "e-1",
                "id_diagnostico": 2,
                "fecha_inicio": "2026-03-15T12:00:00Z",  # Más reciente
                "puntaje_total": 90.0,
                "puntaje_cf": 90, "puntaje_gp": 90, "puntaje_m": 90, "puntaje_v": 90, "puntaje_tp": 90, "puntaje_rh": 90, "puntaje_ec": 90,
                "resultado": "APROBADO"
            }
        ])

        # mock programa nombre
        mock_prog = MagicMock()
        mock_prog.select.return_value = mock_prog
        mock_prog.eq.return_value = mock_prog
        mock_prog.execute.return_value = MagicMock(data=[{"nombre": "Incubación 2026"}])

        def table_routing(tname):
            if tname == "usuario":
                return mock_u
            elif tname == "asignacion_mentor":
                return mock_asig
            elif tname == "usuario_programa":
                return mock_up
            elif tname == "diagnostico":
                return mock_diag
            elif tname == "programa":
                return mock_prog
            return MagicMock()

        mock_supabase.table.side_effect = table_routing

        req = ReporteRequest(
            id_mentor="m-uuid",
            fecha_inicio=datetime(2026, 1, 1),
            fecha_fin=datetime(2026, 12, 31),
            id_programa=101
        )
        reporte = await service.get_reporte_data(req)
        # Debe haber únicamente 1 emprendedor (e-1)
        self.assertEqual(len(reporte.emprendedores), 1)
        emp = reporte.emprendedores[0]
        # Debe haber tomado el diagnóstico más reciente (puntaje 90, no 40 ni el promedio 65)
        self.assertEqual(emp.promedio_general, 90.0)
        self.assertEqual(emp.promedio_cf, 90.0)

    # -----------------------------------------------------------------------
    # Fase 2: Filtrado y Duplicación en Consolidado de Admin (T-2.3)
    # -----------------------------------------------------------------------
    @patch("app.services.reporte_service.get_supabase_client")
    @patch("app.services.org_filter.get_admin_org_user_ids")
    async def test_t2_3_admin_duplicacion_consolidada_multiprograma(self, mock_org_ids, mock_client):
        """RF-03.3: En consolidado (id_programa=None), emprendedor con múltiples programas se computa por cada uno"""
        from app.services.reporte_service import ReporteService

        service = ReporteService()
        mock_supabase = MagicMock()
        service.supabase = mock_supabase
        mock_org_ids.return_value = ["e-multi"]

        # usuario_programa: e-multi está en Programa 1 y Programa 2
        mock_up = MagicMock()
        mock_up.select.return_value = mock_up
        mock_up.in_.return_value = mock_up
        mock_up.execute.return_value = MagicMock(data=[
            {"id_usuario": "e-multi", "id_programa": 1, "programa": {"nombre": "Prog Alfa"}},
            {"id_usuario": "e-multi", "id_programa": 2, "programa": {"nombre": "Prog Beta"}}
        ])

        mock_u = MagicMock()
        mock_u.select.return_value = mock_u
        mock_u.eq.return_value = mock_u
        mock_u.in_.return_value = mock_u
        mock_u.execute.return_value = MagicMock(data=[
            {"id_usuario": "e-multi", "nombre": "Maria", "apellido": "Lopez"}
        ])

        mock_diag = MagicMock()
        mock_diag.select.return_value = mock_diag
        mock_diag.in_.return_value = mock_diag
        mock_diag.gte.return_value = mock_diag
        mock_diag.lte.return_value = mock_diag
        mock_diag.execute.return_value = MagicMock(data=[
            {
                "id_usuario": "e-multi",
                "id_diagnostico": 5,
                "fecha_inicio": "2026-02-01T10:00:00Z",
                "puntaje_total": 80.0,
                "puntaje_cf": 80, "puntaje_gp": 80, "puntaje_m": 80, "puntaje_v": 80, "puntaje_tp": 80, "puntaje_rh": 80, "puntaje_ec": 80,
                "resultado": "APROBADO"
            }
        ])

        def table_side(name):
            if name == "usuario_programa":
                return mock_up
            elif name == "usuario":
                return mock_u
            elif name == "diagnostico":
                return mock_diag
            return MagicMock()

        mock_supabase.table.side_effect = table_side

        req = ReporteAdminRequest(
            fecha_inicio=datetime(2026, 1, 1),
            fecha_fin=datetime(2026, 12, 31),
            admin_id="adm-1",
            id_programa=None  # Consolidado
        )
        reporte = await service.get_reporte_data_admin(req)
        # RF-03.3: Debe duplicarse en el listado, una entrada por cada programa
        self.assertEqual(len(reporte.emprendedores), 2)
        programas_nombres = {e.emprendimiento for e in reporte.emprendedores}
        self.assertEqual(reporte.estadisticas.promedio_general, 80.0)

    # -----------------------------------------------------------------------
    # Fase 2: Soporte para 'Sin diagnóstico' (T-2.4)
    # -----------------------------------------------------------------------
    @patch("app.services.reporte_service.get_supabase_client")
    async def test_t2_4_emprendedor_sin_diagnostico_no_altera_promedios(self, mock_client):
        """RF-04.2, RF-04.3: Emprendedor sin diagnóstico se lista como 'Sin diagnóstico' y no altera promedios"""
        from app.services.reporte_service import ReporteService

        service = ReporteService()
        mock_supabase = MagicMock()
        service.supabase = mock_supabase

        mock_u = MagicMock()
        mock_u.select.return_value = mock_u
        mock_u.eq.return_value = mock_u
        mock_u.execute.return_value = MagicMock(data=[
            {"id_usuario": "e-eval", "nombre": "Eva", "apellido": "Duarte"},
            {"id_usuario": "e-nuevo", "nombre": "Noe", "apellido": "Nuevo"}
        ])

        mock_asig = MagicMock()
        mock_asig.select.return_value = mock_asig
        mock_asig.eq.return_value = mock_asig
        mock_asig.execute.return_value = MagicMock(data=[
            {"id_emprendedor": "e-eval"},
            {"id_emprendedor": "e-nuevo"}
        ])

        mock_up = MagicMock()
        mock_up.select.return_value = mock_up
        mock_up.eq.return_value = mock_up
        mock_up.in_.return_value = mock_up
        mock_up.execute.return_value = MagicMock(data=[
            {"id_usuario": "e-eval"},
            {"id_usuario": "e-nuevo"}
        ])

        # Solo e-eval tiene diagnóstico de 100 puntos. e-nuevo no tiene diagnósticos.
        mock_diag = MagicMock()
        mock_diag.select.return_value = mock_diag
        mock_diag.in_.return_value = mock_diag
        mock_diag.gte.return_value = mock_diag
        mock_diag.lte.return_value = mock_diag
        mock_diag.execute.return_value = MagicMock(data=[
            {
                "id_usuario": "e-eval",
                "id_diagnostico": 9,
                "fecha_inicio": "2026-02-10T10:00:00Z",
                "puntaje_total": 100.0,
                "puntaje_cf": 100, "puntaje_gp": 100, "puntaje_m": 100, "puntaje_v": 100, "puntaje_tp": 100, "puntaje_rh": 100, "puntaje_ec": 100,
                "resultado": "APROBADO"
            }
        ])

        def table_call(t):
            if t == "usuario":
                return mock_u
            elif t == "asignacion_mentor":
                return mock_asig
            elif t == "usuario_programa":
                return mock_up
            elif t == "diagnostico":
                return mock_diag
            return MagicMock()

        mock_supabase.table.side_effect = table_call

        req = ReporteRequest(
            id_mentor="m-1",
            fecha_inicio=datetime(2026, 1, 1),
            fecha_fin=datetime(2026, 12, 31),
            id_programa=10
        )
        reporte = await service.get_reporte_data(req)
        self.assertEqual(len(reporte.emprendedores), 2)

        sin_diag = [e for e in reporte.emprendedores if e.estado_diagnostico == "Sin diagnóstico"]
        con_diag = [e for e in reporte.emprendedores if e.estado_diagnostico == "Con diagnóstico"]
        self.assertEqual(len(sin_diag), 1)
        self.assertEqual(len(con_diag), 1)
        self.assertIsNone(sin_diag[0].promedio_general)

        # El promedio global no debe dividirse entre 2 (dando 50), debe ser 100.0 porque solo cuenta evaluados
        self.assertEqual(reporte.estadisticas.promedio_general, 100.0)

    # -----------------------------------------------------------------------
    # Fase 3: Generación de PDF (T-3.1, T-3.2)
    # -----------------------------------------------------------------------
    async def test_t3_2_generate_pdf_con_participantes_sin_diagnostico(self):
        """RF-05.2: generate_pdf debe renderizar 'Sin diagnóstico' sin errores"""
        from app.services.reporte_service import ReporteService

        service = ReporteService()

        emp1 = EmprendedorReporte(
            nombre="Ana",
            apellido="Valle",
            emprendimiento="Tejidos",
            promedio_general=80.0,
            promedio_cf=80.0, promedio_gp=80.0, promedio_m=80.0,
            promedio_v=80.0, promedio_tp=80.0, promedio_rh=80.0, promedio_ec=80.0,
            num_diagnosticos=1,
            estado_diagnostico="Con diagnóstico"
        )
        emp2 = EmprendedorReporte(
            nombre="Pedro",
            apellido="Rios",
            emprendimiento="Cerámica",
            promedio_general=None,
            promedio_cf=None, promedio_gp=None, promedio_m=None,
            promedio_v=None, promedio_tp=None, promedio_rh=None, promedio_ec=None,
            num_diagnosticos=0,
            estado_diagnostico="Sin diagnóstico"
        )

        data = ReporteData(
            mentor_nombre="Marcos",
            mentor_apellido="Suarez",
            fecha_inicio=datetime(2026, 1, 1),
            fecha_fin=datetime(2026, 12, 31),
            nombre_programa="Programa Semilla 2026",
            emprendedores=[emp1, emp2],
            estadisticas=EstadisticasGlobales(
                total_emprendedores=2,
                tasa_aprobado=100.0,
                promedio_cf=80.0, promedio_gp=80.0, promedio_m=80.0,
                promedio_v=80.0, promedio_tp=80.0, promedio_rh=80.0, promedio_ec=80.0,
                promedio_general=80.0
            ),
            diagnosticos_timeline=[]
        )

        pdf_bytes = await service.generate_pdf(data)
        self.assertIsInstance(pdf_bytes, bytes)
        self.assertTrue(len(pdf_bytes) > 1000)
        self.assertTrue(pdf_bytes.startswith(b"%PDF"))

    @patch("app.services.reporte_service.get_supabase_client")
    async def test_admin_reporte_filtra_exclusivamente_rol_emprendedor(self, mock_client):
        """El reporte de todos los emprendedores debe excluir mentores y administradores inscritos en el programa"""
        from app.services.reporte_service import ReporteService

        service = ReporteService()
        mock_supabase = MagicMock()
        service.supabase = mock_supabase

        # usuario_programa tiene 3 usuarios asignados: admin, mentor y emprendedor
        mock_up = MagicMock()
        mock_up.select.return_value = mock_up
        mock_up.eq.return_value = mock_up
        mock_up.in_.return_value = mock_up
        mock_up.execute.return_value = MagicMock(data=[
            {"id_usuario": "admin-1", "id_programa": 10, "programa": {"nombre": "Prog 10"}},
            {"id_usuario": "mentor-1", "id_programa": 10, "programa": {"nombre": "Prog 10"}},
            {"id_usuario": "emprendedor-1", "id_programa": 10, "programa": {"nombre": "Prog 10"}},
        ])

        # usuario con id_rol = 2 retorna unicamente al emprendedor
        mock_u = MagicMock()
        mock_u.select.return_value = mock_u
        mock_u.in_.return_value = mock_u
        mock_u.eq.return_value = mock_u
        # Cuando filtra por id_rol == 2, solo devuelve al usuario emprendedor
        mock_u.execute.return_value = MagicMock(data=[
            {"id_usuario": "emprendedor-1", "nombre": "Juan", "apellido": "Emprendedor", "id_rol": 2}
        ])

        mock_prog = MagicMock()
        mock_prog.select.return_value = mock_prog
        mock_prog.eq.return_value = mock_prog
        mock_prog.execute.return_value = MagicMock(data=[{"nombre": "Prog 10"}])

        mock_diag = MagicMock()
        mock_diag.select.return_value = mock_diag
        mock_diag.in_.return_value = mock_diag
        mock_diag.gte.return_value = mock_diag
        mock_diag.lte.return_value = mock_diag
        mock_diag.execute.return_value = MagicMock(data=[])

        def table_routing(name):
            if name == "usuario_programa":
                return mock_up
            elif name == "usuario":
                return mock_u
            elif name == "programa":
                return mock_prog
            elif name == "diagnostico":
                return mock_diag
            return MagicMock()

        mock_supabase.table.side_effect = table_routing

        # 1. Prueba con programa específico
        req_prog = ReporteAdminRequest(
            fecha_inicio=datetime(2026, 1, 1),
            fecha_fin=datetime(2026, 12, 31),
            admin_id="adm-uuid",
            id_programa=10
        )
        reporte_prog = await service.get_reporte_data_admin(req_prog)
        self.assertEqual(len(reporte_prog.emprendedores), 1)
        self.assertEqual(reporte_prog.emprendedores[0].nombre, "Juan")
        self.assertEqual(reporte_prog.emprendedores[0].apellido, "Emprendedor")

        # 2. Prueba con consolidado (id_programa = None)
        req_cons = ReporteAdminRequest(
            fecha_inicio=datetime(2026, 1, 1),
            fecha_fin=datetime(2026, 12, 31),
            admin_id="adm-uuid",
            id_programa=None
        )
        reporte_cons = await service.get_reporte_data_admin(req_cons)
        self.assertEqual(len(reporte_cons.emprendedores), 1)
        self.assertEqual(reporte_cons.emprendedores[0].nombre, "Juan")


if __name__ == "__main__":
    unittest.main()
