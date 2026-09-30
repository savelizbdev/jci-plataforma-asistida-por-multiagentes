from typing import Optional, List
from supabase import Client
from app.services.supabase_client import get_supabase_client


def get_admin_org_user_ids(admin_id: Optional[str], supabase: Optional[Client] = None) -> Optional[List[str]]:
    """
    Deduce la organización a la que pertenece el administrador a través de
    los programas a los que está vinculado en 'usuario_programa'.
    
    Retorna:
    - None si no se proveyó admin_id (indicando sin filtro / superadmin)
    - Lista de UUIDs de usuarios que pertenecen a los programas de esa organización.
    - Si el admin no pertenece a ninguna organización o no hay usuarios, retorna [].
    """
    if not admin_id:
        return None
    
    if supabase is None:
        supabase = get_supabase_client()
        
    try:
        # 1. Obtener programas a los que está unido el administrador
        up_res = supabase.table("usuario_programa")\
            .select("id_programa")\
            .eq("id_usuario", admin_id)\
            .execute()
        
        if not up_res.data:
            return []
        
        admin_prog_ids = [r["id_programa"] for r in up_res.data]
        if not admin_prog_ids:
            return []
        
        # 2. Obtener la organización del programa del admin
        prog_res = supabase.table("programa")\
            .select("id_organizacion")\
            .in_("id_programa", admin_prog_ids)\
            .limit(1)\
            .execute()
        
        if not prog_res.data:
            return []
        
        id_organizacion = prog_res.data[0]["id_organizacion"]
        if not id_organizacion:
            return []
        
        # 3. Obtener todos los programas de esa organización
        all_progs_res = supabase.table("programa")\
            .select("id_programa")\
            .eq("id_organizacion", id_organizacion)\
            .execute()
        
        org_prog_ids = [p["id_programa"] for p in (all_progs_res.data or [])]
        if not org_prog_ids:
            return []
        
        # 4. Obtener todos los usuarios enrolados en esos programas
        users_res = supabase.table("usuario_programa")\
            .select("id_usuario")\
            .in_("id_programa", org_prog_ids)\
            .execute()
        
        if not users_res.data:
            return []
            
        return list({u["id_usuario"] for u in users_res.data})
    except Exception as e:
        print(f"Error deduciendo organización del administrador {admin_id}: {e}")
        return []
