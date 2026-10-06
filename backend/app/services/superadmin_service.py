"""
Servicio para operaciones exclusivas del Super Administrador (Spec 004)
Implementa paginación en backend y filtrado jerárquico por organización y programa.
"""
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
from supabase import Client
from app.services.supabase_client import get_supabase_client
from app.models.superadmin import (
    PaginatedResponse,
    OrganizacionSimple,
    ProgramaSimple,
    UsuarioSuperAdminItem,
    DiagnosticoSupervisionItem,
    EmprendedorConMentorItem,
    AsignacionesResponse,
)

ROLES_MAP = {
    1: "Administrador",
    2: "Emprendedor",
    3: "Mentor",
    4: "Super Administrador",
}


class SuperAdminService:
    @property
    def supabase(self) -> Client:
        return get_supabase_client()

    async def listar_organizaciones_activas(self) -> List[OrganizacionSimple]:
        """
        RF-02.3, RF-02.4: Lista únicamente organizaciones activas (estado = true)
        ordenadas alfabéticamente por su nombre.
        """
        try:
            res = self.supabase.table("organizacion")\
                .select("id_organizacion, nombre, descripcion, estado")\
                .eq("estado", True)\
                .order("nombre", desc=False)\
                .execute()
            data = res.data or []
            return [OrganizacionSimple(**item) for item in data]
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al listar organizaciones activas: {str(e)}")

    async def listar_programas_activos(self, id_organizacion: int) -> List[ProgramaSimple]:
        """
        RF-02.3, RF-02.4: Lista únicamente programas activos (estado = true) de una organización
        ordenados alfabéticamente por su nombre.
        """
        try:
            res = self.supabase.table("programa")\
                .select("id_programa, nombre, id_organizacion, codigo, estado")\
                .eq("id_organizacion", id_organizacion)\
                .eq("estado", True)\
                .order("nombre", desc=False)\
                .execute()
            data = res.data or []
            return [
                ProgramaSimple(
                    id_programa=item["id_programa"],
                    nombre_programa=item.get("nombre", ""),
                    id_organizacion=item["id_organizacion"],
                    codigo=item.get("codigo"),
                    estado=item.get("estado", True),
                )
                for item in data
            ]
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al listar programas activos: {str(e)}")

    async def cambiar_rol_usuario(self, id_usuario: str, nuevo_rol: int) -> bool:
        """
        RF-04.2: Cambia el rol de un usuario (1, 2, 3 o 4).
        """
        try:
            res = self.supabase.table("usuario")\
                .update({"id_rol": nuevo_rol})\
                .eq("id_usuario", id_usuario)\
                .execute()
            if not res.data:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            return True
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al cambiar rol del usuario: {str(e)}")

    async def cambiar_estado_usuario(self, id_usuario: str, activo: bool) -> bool:
        """
        RF-04.1: Activa o desactiva la cuenta de un usuario.
        """
        try:
            res = self.supabase.table("usuario")\
                .update({"estado": activo})\
                .eq("id_usuario", id_usuario)\
                .execute()
            if not res.data:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
            return True
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al cambiar estado del usuario: {str(e)}")

    async def matricular_usuario(self, id_usuario: str, id_programa: int) -> bool:
        """
        RF-04.5: Matricula a un usuario en un programa activo de la organización.
        """
        try:
            # Validar si ya está matriculado
            existe = self.supabase.table("usuario_programa")\
                .select("id_usuario")\
                .eq("id_usuario", id_usuario)\
                .eq("id_programa", id_programa)\
                .execute()
            if existe.data:
                return True

            res = self.supabase.table("usuario_programa")\
                .insert({"id_usuario": id_usuario, "id_programa": id_programa})\
                .execute()
            return bool(res.data)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al matricular usuario en programa: {str(e)}")

    async def obtener_usuarios_paginados(
        self,
        id_organizacion: int,
        id_programa: Optional[int] = None,
        page: int = 1,
        limit: int = 15,
        q: Optional[str] = None,
    ) -> PaginatedResponse[UsuarioSuperAdminItem]:
        """
        RF-04.3, RF-04.6, RF-04.7: Retorna usuarios matriculados paginados en backend (15 por página),
        con soporte opcional de búsqueda por nombre, apellido o correo.
        """
        try:
            # 1. Obtener programas activos de la organización
            progs_res = self.supabase.table("programa")\
                .select("id_programa, nombre")\
                .eq("id_organizacion", id_organizacion)\
                .eq("estado", True)\
                .execute()
            org_progs = progs_res.data or []
            if not org_progs:
                return PaginatedResponse(items=[], total=0, page=page, limit=limit)

            progs_map = {p["id_programa"]: p.get("nombre", "") for p in org_progs}

            if id_programa is not None and id_programa in progs_map:
                target_prog_ids = [id_programa]
            else:
                target_prog_ids = list(progs_map.keys())

            # 2. Consultar usuario_programa para los programas objetivo
            up_res = self.supabase.table("usuario_programa")\
                .select("id_usuario, id_programa")\
                .in_("id_programa", target_prog_ids)\
                .execute()
            
            up_data = up_res.data or []
            user_progs_map: Dict[str, List[int]] = {}
            for row in up_data:
                uid = str(row["id_usuario"])
                user_progs_map.setdefault(uid, []).append(row["id_programa"])

            unique_user_ids = sorted(list(user_progs_map.keys()))
            if not unique_user_ids:
                return PaginatedResponse(items=[], total=0, page=page, limit=limit)

            # 3. Obtener datos de los usuarios
            users_res = self.supabase.table("usuario")\
                .select("id_usuario, nombre, apellido, email, id_rol, estado")\
                .in_("id_usuario", unique_user_ids)\
                .execute()

            users_list = users_res.data or []

            # 4. Si hay término de búsqueda, filtrar por nombre, apellido o correo
            if q and q.strip():
                term = q.strip().lower()
                filtered = []
                for u in users_list:
                    nom = (u.get("nombre") or "").lower()
                    ape = (u.get("apellido") or "").lower()
                    full = f"{nom} {ape}".strip()
                    mail = (u.get("email") or "").lower()
                    if term in mail or term in full or term in nom or term in ape:
                        filtered.append(u)
                users_list = filtered

            total = len(users_list)
            if total == 0:
                return PaginatedResponse(items=[], total=0, page=page, limit=limit)

            # 5. Aplicar paginación
            offset = (page - 1) * limit
            paged_users = users_list[offset : offset + limit]

            items: List[UsuarioSuperAdminItem] = []
            for u in paged_users:
                uid = str(u["id_usuario"])
                p_ids = user_progs_map.get(uid, [])
                p_names = [progs_map[pid] for pid in p_ids if pid in progs_map]
                rol_id = u.get("id_rol", 2)
                items.append(
                    UsuarioSuperAdminItem(
                        id_usuario=uid,
                        nombre=u.get("nombre") or "",
                        apellido=u.get("apellido") or "",
                        correo=u.get("email") or "",
                        id_rol=rol_id,
                        nombre_rol=ROLES_MAP.get(rol_id, "Emprendedor"),
                        estado=u.get("estado", True),
                        programas_ids=p_ids,
                        programas_nombres=p_names,
                    )
                )

            return PaginatedResponse(items=items, total=total, page=page, limit=limit)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al obtener usuarios paginados: {str(e)}")

    async def obtener_usuarios_sin_programa(
        self,
        id_organizacion: int,
        page: int = 1,
        limit: int = 15,
        q: Optional[str] = None,
    ) -> PaginatedResponse[UsuarioSuperAdminItem]:
        """
        RF-04.4, RF-04.7: Retorna usuarios del sistema que no están inscritos en ningún programa,
        con soporte opcional de búsqueda por nombre, apellido o correo.
        """
        try:
            # 1. Obtener todos los IDs de usuario que están inscritos en algún programa
            up_res = self.supabase.table("usuario_programa")\
                .select("id_usuario")\
                .execute()
            enrolled_ids = {str(r["id_usuario"]) for r in (up_res.data or [])}

            # 2. Obtener usuarios en general
            users_res = self.supabase.table("usuario")\
                .select("id_usuario, nombre, apellido, email, id_rol, estado")\
                .execute()
            
            all_users = users_res.data or []
            sin_programa = [u for u in all_users if str(u["id_usuario"]) not in enrolled_ids]

            # 3. Si hay término de búsqueda, filtrar
            if q and q.strip():
                term = q.strip().lower()
                filtered = []
                for u in sin_programa:
                    nom = (u.get("nombre") or "").lower()
                    ape = (u.get("apellido") or "").lower()
                    full = f"{nom} {ape}".strip()
                    mail = (u.get("email") or "").lower()
                    if term in mail or term in full or term in nom or term in ape:
                        filtered.append(u)
                sin_programa = filtered
            
            total = len(sin_programa)
            offset = (page - 1) * limit
            paged = sin_programa[offset : offset + limit]

            items = [
                UsuarioSuperAdminItem(
                    id_usuario=str(u["id_usuario"]),
                    nombre=u.get("nombre") or "",
                    apellido=u.get("apellido") or "",
                    correo=u.get("email") or "",
                    id_rol=u.get("id_rol", 2),
                    nombre_rol=ROLES_MAP.get(u.get("id_rol", 2), "Emprendedor"),
                    estado=u.get("estado", True),
                    programas_ids=[],
                    programas_nombres=[],
                )
                for u in paged
            ]

            return PaginatedResponse(items=items, total=total, page=page, limit=limit)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al obtener usuarios sin programa: {str(e)}")

    async def obtener_asignaciones_mentores(
        self,
        id_organizacion: int,
        id_programa: Optional[int] = None,
        page_mentores: int = 1,
        page_sin_mentor: int = 1,
        page_con_mentor: int = 1,
        limit: int = 15,
    ) -> AsignacionesResponse:
        """
        RF-05.1, RF-05.2, RF-05.4: Retorna listas de asignación con paginación independiente de 15 registros.
        """
        try:
            # 1. Obtener programas activos
            progs_res = self.supabase.table("programa")\
                .select("id_programa, nombre")\
                .eq("id_organizacion", id_organizacion)\
                .eq("estado", True)\
                .execute()
            org_progs = progs_res.data or []
            progs_map = {p["id_programa"]: p.get("nombre", "") for p in org_progs}
            target_prog_ids = [id_programa] if id_programa and id_programa in progs_map else list(progs_map.keys())

            if not target_prog_ids:
                vacia = PaginatedResponse(items=[], total=0, page=1, limit=limit)
                return AsignacionesResponse(
                    mentores=vacia,
                    emprendedores_sin_mentor=vacia,
                    emprendedores_con_mentor=vacia,
                )

            # 2. Usuarios matriculados
            up_res = self.supabase.table("usuario_programa")\
                .select("id_usuario, id_programa")\
                .in_("id_programa", target_prog_ids)\
                .execute()
            user_ids = list({str(r["id_usuario"]) for r in (up_res.data or [])})

            if not user_ids:
                vacia = PaginatedResponse(items=[], total=0, page=1, limit=limit)
                return AsignacionesResponse(
                    mentores=vacia,
                    emprendedores_sin_mentor=vacia,
                    emprendedores_con_mentor=vacia,
                )

            # 3. Datos de usuarios (mentores id_rol=3, emprendedores id_rol=2)
            users_res = self.supabase.table("usuario")\
                .select("id_usuario, nombre, apellido, email, id_rol, estado")\
                .in_("id_usuario", user_ids)\
                .execute()
            
            all_users = users_res.data or []
            mentores_raw = [u for u in all_users if u.get("id_rol") == 3]
            emprendedores_raw = [u for u in all_users if u.get("id_rol") == 2]

            # 4. Asignaciones existentes
            asig_res = self.supabase.table("asignacion_mentor")\
                .select("id_asignacion, id_mentor, id_emprendedor")\
                .execute()
            asig_data = asig_res.data or []
            asig_map = {str(a["id_emprendedor"]): a for a in asig_data}

            sin_mentor_raw = [e for e in emprendedores_raw if str(e["id_usuario"]) not in asig_map]
            con_mentor_raw = [e for e in emprendedores_raw if str(e["id_usuario"]) in asig_map]

            # 5. Paginación independiente
            # Mentores
            tot_m = len(mentores_raw)
            off_m = (page_mentores - 1) * limit
            p_mentores = mentores_raw[off_m : off_m + limit]
            items_mentores = [
                UsuarioSuperAdminItem(
                    id_usuario=str(m["id_usuario"]),
                    nombre=m.get("nombre") or "",
                    apellido=m.get("apellido") or "",
                    correo=m.get("email") or "",
                    id_rol=3,
                    nombre_rol="Mentor",
                    estado=m.get("estado", True),
                )
                for m in p_mentores
            ]

            # Emprendedores sin mentor
            tot_sm = len(sin_mentor_raw)
            off_sm = (page_sin_mentor - 1) * limit
            p_sin_mentor = sin_mentor_raw[off_sm : off_sm + limit]
            items_sin_mentor = [
                UsuarioSuperAdminItem(
                    id_usuario=str(e["id_usuario"]),
                    nombre=e.get("nombre") or "",
                    apellido=e.get("apellido") or "",
                    correo=e.get("email") or "",
                    id_rol=2,
                    nombre_rol="Emprendedor",
                    estado=e.get("estado", True),
                )
                for e in p_sin_mentor
            ]

            # Emprendedores con mentor
            tot_cm = len(con_mentor_raw)
            off_cm = (page_con_mentor - 1) * limit
            p_con_mentor = con_mentor_raw[off_cm : off_cm + limit]

            mentores_map = {str(m["id_usuario"]): m for m in mentores_raw}
            items_con_mentor: List[EmprendedorConMentorItem] = []
            for e in p_con_mentor:
                uid = str(e["id_usuario"])
                asig = asig_map.get(uid, {})
                id_m = str(asig.get("id_mentor", ""))
                m_obj = mentores_map.get(id_m, {})
                items_con_mentor.append(
                    EmprendedorConMentorItem(
                        id_asignacion=str(asig.get("id_asignacion", "")),
                        id_emprendedor=uid,
                        nombre=e.get("nombre") or "",
                        apellido=e.get("apellido") or "",
                        correo=e.get("email") or "",
                        id_mentor=id_m,
                        mentor_nombre=m_obj.get("nombre") or "",
                        mentor_apellido=m_obj.get("apellido") or "",
                        id_programa=id_programa,
                        nombre_programa=progs_map.get(id_programa, "") if id_programa else None,
                    )
                )

            return AsignacionesResponse(
                mentores=PaginatedResponse(items=items_mentores, total=tot_m, page=page_mentores, limit=limit),
                emprendedores_sin_mentor=PaginatedResponse(items=items_sin_mentor, total=tot_sm, page=page_sin_mentor, limit=limit),
                emprendedores_con_mentor=PaginatedResponse(items=items_con_mentor, total=tot_cm, page=page_con_mentor, limit=limit),
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al obtener asignaciones: {str(e)}")

    async def asignar_mentor(self, id_mentor: str, id_emprendedores: List[str]) -> bool:
        """
        RF-05.2: Asigna múltiples emprendedores a un mentor.
        """
        try:
            for id_emp in id_emprendedores:
                # Si ya tiene asignación, removerla primero para reasignar limpiamente
                self.supabase.table("asignacion_mentor")\
                    .delete()\
                    .eq("id_emprendedor", id_emp)\
                    .execute()

                self.supabase.table("asignacion_mentor")\
                    .insert({"id_mentor": id_mentor, "id_emprendedor": id_emp})\
                    .execute()
            return True
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al realizar asignación: {str(e)}")

    async def desasignar_mentor(self, id_emprendedor: str) -> bool:
        """
        RF-05.2: Revoca la asignación de un emprendedor.
        """
        try:
            self.supabase.table("asignacion_mentor")\
                .delete()\
                .eq("id_emprendedor", id_emprendedor)\
                .execute()
            return True
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al revocar asignación: {str(e)}")

    async def obtener_diagnosticos_supervision(
        self,
        id_organizacion: int,
        id_programa: Optional[int] = None,
        page: int = 1,
        limit: int = 15,
    ) -> PaginatedResponse[DiagnosticoSupervisionItem]:
        """
        RF-07.1, RF-07.2, RF-07.3, RF-07.5, RF-07.6:
        Retorna diagnósticos en solo lectura, desglosando filas por programa con paginación de 15 en backend.
        """
        try:
            # 1. Obtener programas activos
            progs_res = self.supabase.table("programa")\
                .select("id_programa, nombre")\
                .eq("id_organizacion", id_organizacion)\
                .eq("estado", True)\
                .execute()
            org_progs = progs_res.data or []
            progs_map = {p["id_programa"]: p.get("nombre", "") for p in org_progs}
            target_prog_ids = [id_programa] if id_programa and id_programa in progs_map else list(progs_map.keys())

            if not target_prog_ids:
                return PaginatedResponse(items=[], total=0, page=page, limit=limit)

            # 2. Obtener inscripciones de emprendedores (id_rol = 2) en esos programas
            up_res = self.supabase.table("usuario_programa")\
                .select("id_usuario, id_programa")\
                .in_("id_programa", target_prog_ids)\
                .execute()
            
            up_rows = up_res.data or []
            if not up_rows:
                return PaginatedResponse(items=[], total=0, page=page, limit=limit)

            uids = list({str(r["id_usuario"]) for r in up_rows})
            users_res = self.supabase.table("usuario")\
                .select("id_usuario, nombre, apellido, id_rol")\
                .in_("id_usuario", uids)\
                .eq("id_rol", 2)\
                .execute()
            
            emps_map = {str(u["id_usuario"]): u for u in (users_res.data or [])}

            # 3. Crear pares (emprendedor, programa)
            emp_prog_pairs = []
            for r in up_rows:
                uid = str(r["id_usuario"])
                if uid in emps_map:
                    emp_prog_pairs.append({
                        "usuario": emps_map[uid],
                        "id_programa": r["id_programa"],
                        "nombre_programa": progs_map.get(r["id_programa"], ""),
                    })

            total = len(emp_prog_pairs)
            if total == 0:
                return PaginatedResponse(items=[], total=0, page=page, limit=limit)

            # 4. Paginación de pares
            offset = (page - 1) * limit
            paged_pairs = emp_prog_pairs[offset : offset + limit]

            # 5. Obtener diagnósticos y emprendimientos para los usuarios de la página
            paged_uids = list({p["usuario"]["id_usuario"] for p in paged_pairs})
            
            # Obtener nombres de emprendimiento
            emp_nombres = {}
            if paged_uids:
                emps_res = self.supabase.table("emprendimiento")\
                    .select("id_usuario, nombre")\
                    .in_("id_usuario", paged_uids)\
                    .execute()
                emp_nombres = {str(e["id_usuario"]): e.get("nombre") for e in (emps_res.data or []) if e.get("nombre")}

            diag_res = self.supabase.table("diagnostico")\
                .select("*")\
                .in_("id_usuario", paged_uids)\
                .execute()
            
            # Mapear diagnóstico más reciente por usuario, priorizando aquellos con resultado completado
            user_diag_map: Dict[str, dict] = {}
            for d in (diag_res.data or []):
                uid = str(d.get("id_usuario") or "")
                if not uid:
                    continue
                tiene_res = bool(d.get("resultado") and str(d.get("resultado")).strip())
                if uid not in user_diag_map:
                    user_diag_map[uid] = d
                else:
                    prev = user_diag_map[uid]
                    prev_tiene_res = bool(prev.get("resultado") and str(prev.get("resultado")).strip())
                    if tiene_res and not prev_tiene_res:
                        user_diag_map[uid] = d
                    elif tiene_res == prev_tiene_res:
                        f_actual = str(d.get("fecha_inicio") or "")
                        f_prev = str(prev.get("fecha_inicio") or "")
                        if f_actual > f_prev:
                            user_diag_map[uid] = d

            # 6. Construir items
            items: List[DiagnosticoSupervisionItem] = []
            for pair in paged_pairs:
                u = pair["usuario"]
                uid = str(u["id_usuario"])
                diag = user_diag_map.get(uid)
                nombre_emp = emp_nombres.get(uid)

                # Se considera con diagnóstico si tiene diagnóstico con resultado o puntaje
                tiene_diag = diag is not None and (
                    bool(diag.get("resultado")) or (diag.get("puntaje_total") is not None and float(diag.get("puntaje_total") or 0) > 0)
                )

                if tiene_diag and diag:
                    pts_total = diag.get("puntaje_total")
                    cf = diag.get("puntaje_cf")
                    gp = diag.get("puntaje_gp")
                    m = diag.get("puntaje_m")
                    v = diag.get("puntaje_v")
                    tp = diag.get("puntaje_tp")
                    rh = diag.get("puntaje_rh")
                    ec = diag.get("puntaje_ec")

                    # Si puntaje_total no vino calculado pero sí las áreas
                    if pts_total is None and any(x is not None for x in [cf, gp, m, v, tp, rh, ec]):
                        areas_vals = [float(x) for x in [cf, gp, m, v, tp, rh, ec] if x is not None]
                        pts_total = sum(areas_vals) / len(areas_vals) if areas_vals else 0.0

                    items.append(
                        DiagnosticoSupervisionItem(
                            id_diagnostico=str(diag.get("id_diagnostico") or ""),
                            id_emprendedor=uid,
                            nombre=u.get("nombre") or "",
                            apellido=u.get("apellido") or "",
                            emprendimiento=nombre_emp,
                            id_programa=pair["id_programa"],
                            nombre_programa=pair["nombre_programa"],
                            estado_diagnostico="Con diagnóstico",
                            resultado=diag.get("resultado") or "EVALUADO",
                            promedio_general=round(float(pts_total), 1) if pts_total is not None else None,
                            promedio_cf=round(float(cf), 1) if cf is not None else None,
                            promedio_gp=round(float(gp), 1) if gp is not None else None,
                            promedio_m=round(float(m), 1) if m is not None else None,
                            promedio_v=round(float(v), 1) if v is not None else None,
                            promedio_tp=round(float(tp), 1) if tp is not None else None,
                            promedio_rh=round(float(rh), 1) if rh is not None else None,
                            promedio_ec=round(float(ec), 1) if ec is not None else None,
                            conclusion=diag.get("conclusion"),
                            recomendaciones=diag.get("recomendaciones"),
                            inconsistencias=diag.get("inconsistencias"),
                            fecha_inicio=str(diag.get("fecha_inicio") or ""),
                        )
                    )
                else:
                    items.append(
                        DiagnosticoSupervisionItem(
                            id_emprendedor=uid,
                            nombre=u.get("nombre") or "",
                            apellido=u.get("apellido") or "",
                            emprendimiento=nombre_emp,
                            id_programa=pair["id_programa"],
                            nombre_programa=pair["nombre_programa"],
                            estado_diagnostico="Sin diagnóstico",
                        )
                    )

            return PaginatedResponse(items=items, total=total, page=page, limit=limit)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error al obtener diagnósticos de supervisión: {str(e)}")


superadmin_service = SuperAdminService()
