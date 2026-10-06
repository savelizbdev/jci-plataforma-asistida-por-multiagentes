/**
 * Página de Gestión de Usuarios para Administrador
 * Permite ver, buscar y gestionar usuarios (emprendedores y mentores)
 */
import { useState, useEffect } from 'react';
import { Layout } from '../components/common/Layout';
import { useAuth } from '../hooks/useAuth';
import { userService } from '../services/userService';
import { User } from '../types/user';
import { EditUserModal } from '../components/admin/EditUserModal';
import { ADMIN_MENU_ITEMS } from '../constants/adminMenu';
import toast from 'react-hot-toast';


export const GestionUsuarios = () => {
    const { user, logout } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);

    // Filter states
    const [showFilters, setShowFilters] = useState(false);
    const [filterRole, setFilterRole] = useState<string>('Todos');
    const [filterStatus, setFilterStatus] = useState<string>('Todos');

    // Fetch users on component mount and when user session is available
    useEffect(() => {
        if (!user?.id_usuario) return;
        fetchUsers();
    }, [user?.id_usuario]);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            setError(null);
            const fetchedUsers = await userService.getAllUsers(user?.id_usuario);
            setUsers(fetchedUsers);
        } catch (err: any) {
            setError(err.message || 'Error al cargar usuarios');
            console.error('Error fetching users:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filter users by search term (name, apellido, email), role, and status
    const filteredUsers = users.filter(user => {
        const term = searchTerm.toLowerCase().trim();
        const fullName = `${user.nombre || ''} ${user.apellido || ''}`.toLowerCase();
        const matchesSearch = !term ||
            user.email.toLowerCase().includes(term) ||
            fullName.includes(term) ||
            (user.nombre && user.nombre.toLowerCase().includes(term)) ||
            (user.apellido && user.apellido.toLowerCase().includes(term));

        const matchesRole = filterRole === 'Todos' || user.rol === filterRole;
        const matchesStatus = filterStatus === 'Todos' ||
            (filterStatus === 'Activo' && user.estado) ||
            (filterStatus === 'Inactivo' && !user.estado);

        return matchesSearch && matchesRole && matchesStatus;
    });

    // Clear all filters
    const clearFilters = () => {
        setFilterRole('Todos');
        setFilterStatus('Todos');
    };

    // Check if any filter is active
    const hasActiveFilters = filterRole !== 'Todos' || filterStatus !== 'Todos';

    // Handle edit user
    const handleEditUser = (user: User) => {
        setEditingUser(user);
    };

    // Conmutar estado de activación con actualización optimista (RF-11, RF-16)
    const handleToggleStatus = async (targetUser: User) => {
        const previousState = targetUser.estado;
        const newState = !previousState;

        // Actualización optimista inmediata
        setUsers(prevUsers =>
            prevUsers.map(u =>
                u.id_usuario === targetUser.id_usuario ? { ...u, estado: newState } : u
            )
        );
        setTogglingId(targetUser.id_usuario);

        try {
            const res = await userService.toggleUserStatus(targetUser.id_usuario);
            const confirmedState = res.estado;
            // Sincronizar con la respuesta del servidor
            setUsers(prevUsers =>
                prevUsers.map(u =>
                    u.id_usuario === targetUser.id_usuario ? { ...u, estado: confirmedState } : u
                )
            );
            toast.success(confirmedState ? 'Usuario activado' : 'Usuario desactivado');
        } catch (err: any) {
            // Revertir estado previo si la llamada falla
            setUsers(prevUsers =>
                prevUsers.map(u =>
                    u.id_usuario === targetUser.id_usuario ? { ...u, estado: previousState } : u
                )
            );
            toast.error(err.message || 'Error al cambiar el estado del usuario');
        } finally {
            setTogglingId(null);
        }
    };

    // Handle update user role, permissions and status
    const handleUpdateUser = async (idRol: number, habilitadoDiag: boolean, estado: boolean) => {
        if (!editingUser) return;

        try {
            await userService.updateUserRolePermissions(editingUser.id_usuario, idRol, habilitadoDiag, estado);
            setEditingUser(null);
            toast.success('Usuario actualizado correctamente');
            await fetchUsers(); // Refresh list
        } catch (error: any) {
            toast.error(error.message || 'Error al actualizar usuario');
        }
    };

    // Función para obtener el color del badge según el rol
    const getRoleBadgeColor = (rol: string) => {
        switch (rol) {
            case 'Emprendedor':
                return 'bg-blue-500/20 text-primary-500 border border-primary-200';
            case 'Mentor':
                return 'bg-purple-500/20 text-purple-400 border border-purple-200';
            case 'Administrador':
                return 'bg-red-500/20 text-red-400 border border-red-500/30';
            default:
                return 'bg-gray-500/20 text-neutral-600 border border-gray-500/30';
        }
    };

    return (
        <Layout menuItems={ADMIN_MENU_ITEMS} onLogout={logout}>
            <div>
                {/* Header */}
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-800 tracking-tight mb-1">
                            Gestión de Usuarios
                        </h1>
                        <p className="text-sm text-neutral-500 font-medium">
                            Edita o deshabilita cuentas de la plataforma.
                        </p>
                    </div>
                </div>

                {/* Search and Actions Bar */}
                <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                    {/* Search Input */}
                    <div className="relative flex-1 w-full md:max-w-md">
                        <svg
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-neutral-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar por nombre o email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-activa-teal/50 focus:border-activa-teal transition-colors shadow-sm"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 w-full md:w-auto relative">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-semibold transition-colors ${
                                hasActiveFilters
                                    ? 'bg-activa-teal hover:bg-activa-dark-teal text-white'
                                    : 'bg-white hover:bg-slate-50 text-neutral-700 border border-slate-200'
                            }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                            Filtros
                            {hasActiveFilters && (
                                <span className="ml-1 bg-white text-activa-teal text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                    {(filterRole !== 'Todos' ? 1 : 0) + (filterStatus !== 'Todos' ? 1 : 0)}
                                </span>
                            )}
                        </button>

                        {/* Filters Dropdown */}
                        {showFilters && (
                            <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-light-border rounded-lg shadow-xl z-10 p-4">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-neutral-800 font-semibold">Filtrar por</h3>
                                    {hasActiveFilters && (
                                        <button
                                            onClick={clearFilters}
                                            className="text-activa-teal hover:text-activa-dark-teal text-sm font-medium"
                                        >
                                            Limpiar
                                        </button>
                                    )}
                                </div>

                                {/* Role Filter */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                                        Rol
                                    </label>
                                    <select
                                        value={filterRole}
                                        onChange={(e) => setFilterRole(e.target.value)}
                                        className="w-full bg-white border border-slate-200 text-neutral-900 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-activa-teal/50 focus:border-activa-teal"
                                    >
                                        <option value="Todos">Todos los roles</option>
                                        <option value="Administrador">Administrador</option>
                                        <option value="Emprendedor">Emprendedor</option>
                                        <option value="Mentor">Mentor</option>
                                    </select>
                                </div>

                                {/* Status Filter */}
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                                        Estado
                                    </label>
                                    <select
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                        className="w-full bg-white border border-slate-200 text-neutral-900 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-activa-teal/50 focus:border-activa-teal"
                                    >
                                        <option value="Todos">Todos los estados</option>
                                        <option value="Activo">Activo</option>
                                        <option value="Inactivo">Inactivo</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Users Table */}
                <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <svg className="animate-spin h-8 w-8 text-activa-teal mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <p className="text-neutral-600">Cargando usuarios...</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-red-400 font-semibold mb-2">Error al cargar usuarios</p>
                                <p className="text-neutral-600 text-sm">{error}</p>
                            </div>
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <svg className="w-12 h-12 text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                </svg>
                                <p className="text-neutral-600">
                                    {searchTerm ? 'No se encontraron usuarios que coincidan con la búsqueda' : 'No hay usuarios registrados'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-activa-teal/5 border-b border-activa-teal/10">
                                        <th className="px-6 py-3.5 text-left text-xs font-bold text-activa-dark-teal uppercase tracking-wider">Nombre y Apellido</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-bold text-activa-dark-teal uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-bold text-activa-dark-teal uppercase tracking-wider">Celular</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-bold text-activa-dark-teal uppercase tracking-wider">Rol</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-bold text-activa-dark-teal uppercase tracking-wider">Estado</th>
                                        <th className="px-6 py-3.5 text-left text-xs font-bold text-activa-dark-teal uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-light-border">
                                    {filteredUsers.map((user) => (
                                        <tr key={user.id_usuario} className="hover:bg-neutral-50/50 transition-colors">
                                            <td className="px-6 py-4 text-neutral-900 font-medium">
                                                {user.nombre && user.apellido
                                                    ? `${user.nombre} ${user.apellido}`
                                                    : user.nombre || user.apellido || 'Sin nombre'}
                                            </td>
                                            <td className="px-6 py-4 text-neutral-600">{user.email}</td>
                                            <td className="px-6 py-4 text-neutral-600">{user.celular || '—'}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-block px-3 py-1 rounded-md text-xs font-semibold ${getRoleBadgeColor(user.rol)}`}>
                                                    {user.rol}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2.5">
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-checked={user.estado}
                                                        aria-label={user.estado ? 'Desactivar usuario' : 'Activar usuario'}
                                                        disabled={togglingId === user.id_usuario}
                                                        onClick={() => handleToggleStatus(user)}
                                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-activa-teal/50 focus:ring-offset-2 ${
                                                            user.estado ? 'bg-activa-teal' : 'bg-slate-300'
                                                        } ${togglingId === user.id_usuario ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        <span className="sr-only">
                                                            {user.estado ? 'Usuario activo' : 'Usuario inactivo'}
                                                        </span>
                                                        <span
                                                            aria-hidden="true"
                                                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                                                user.estado ? 'translate-x-5' : 'translate-x-0'
                                                            }`}
                                                        />
                                                    </button>
                                                    <span className={`text-xs font-semibold ${user.estado ? 'text-activa-teal' : 'text-neutral-400'}`}>
                                                        {user.estado ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {/* Edit Button */}
                                                    <button onClick={() => handleEditUser(user)} className="p-2 text-neutral-400 hover:text-activa-teal hover:bg-activa-teal/10 rounded-lg transition-colors" title="Editar">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit User Modal */}
            {editingUser && (
                <EditUserModal
                    user={editingUser}
                    onSubmit={handleUpdateUser}
                    onClose={() => setEditingUser(null)}
                />
            )}
        </Layout>
    );
};
