import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Global flag to prevent auth state changes during admin user creation
let isCreatingUserAdmin = false;
if (typeof window !== 'undefined') {
    (window as any).isCreatingUserAdmin = false;
}

interface Profile {
    id: string;
    full_name: string | null;
    email: string | null;
    role: string;
    avatar_url: string | null;
    created_at: string;
}

const AdminUsuarios: React.FC = () => {
    const [usuarios, setUsuarios] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Profile | null>(null);
    const [newUser, setNewUser] = useState({
        full_name: '',
        email: '',
        password: '',
        role: 'SUPERVISOR',
        avatar_url: ''
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            console.log('[AdminUsuarios] Fetching profiles...');
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[AdminUsuarios] Error fetching profiles:', error);
                alert('Erro ao carregar usuários: ' + error.message + '. Verifique se as políticas RLS permitem leitura.');
            } else {
                console.log('[AdminUsuarios] Profiles loaded:', data?.length || 0);
                setUsuarios(data || []);
            }
        } catch (err: any) {
            console.error('[AdminUsuarios] Exception:', err);
            alert('Erro inesperado ao carregar usuários: ' + err.message);
        }
        setLoading(false);
    };

    // Function to sync missing profiles for authenticated users
    const syncMissingProfiles = async () => {
        try {
            console.log('[AdminUsuarios] Checking for missing profiles...');
            // This will only work if user has admin privileges
            // The check is done on the frontend by comparing profiles count
            const { data: profiles } = await supabase.from('profiles').select('id');
            const profileIds = new Set(profiles?.map(p => p.id) || []);

            console.log('[AdminUsuarios] Found', profileIds.size, 'profiles in database');

            // Note: We can't access auth.users from client-side
            // If there's a mismatch, the admin should manually create profiles or use Supabase Dashboard
        } catch (err) {
            console.error('[AdminUsuarios] Sync check failed:', err);
        }
    };

    useEffect(() => {
        fetchData();
        syncMissingProfiles(); // Check for sync issues on mount
    }, []);

    const handleAddUser = async () => {
        if (!newUser.email || !newUser.password || !newUser.full_name) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        try {
            // Set flag to prevent onAuthStateChange from reacting
            if (typeof window !== 'undefined') {
                (window as any).isCreatingUserAdmin = true;
            }

            // Criar um cliente temporário COM TOTAL ISOLAMENTO de storage e sessão
            const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false,
                    storage: {
                        getItem: () => null,
                        setItem: () => { },
                        removeItem: () => { }
                    }
                }
            });

            // 1. Create Auth User
            const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                email: newUser.email,
                password: newUser.password,
                options: {
                    data: {
                        full_name: newUser.full_name,
                        role: newUser.role
                    },
                    emailRedirectTo: undefined // Prevent any redirects
                }
            });

            if (authError) {
                alert('Erro ao criar usuário: ' + authError.message);
                isCreatingUserAdmin = false;
                return;
            }

            if (authData.user) {
                console.log('[AdminUsuarios] Auth user created:', authData.user.id, authData.user.email);

                // 2. Create Profile row (since there's no trigger)
                const profileData = {
                    id: authData.user.id,
                    full_name: newUser.full_name,
                    role: newUser.role,
                    email: newUser.email,
                    avatar_url: newUser.avatar_url || null,
                    created_at: new Date().toISOString()
                };

                console.log('[AdminUsuarios] Creating profile with data:', profileData);

                const { error: profileError, data: insertedProfile } = await supabase
                    .from('profiles')
                    .insert(profileData)
                    .select()
                    .single();

                if (profileError) {
                    console.error('[AdminUsuarios] Error creating profile:', profileError);

                    // Try upsert if insert failed (maybe trigger exists or profile already created)
                    const { error: upsertError } = await supabase
                        .from('profiles')
                        .upsert(profileData, { onConflict: 'id' });

                    if (upsertError) {
                        console.error('[AdminUsuarios] Upsert also failed:', upsertError);
                        alert(`Usuário de autenticação criado (${authData.user.email}), mas houve erro ao criar o perfil: ${profileError.message}. O usuário pode precisar ser configurado manualmente.`);
                    } else {
                        console.log('[AdminUsuarios] Profile created via upsert');
                        alert('Usuário criado com sucesso!');
                    }
                } else {
                    console.log('[AdminUsuarios] Profile created successfully:', insertedProfile);
                    alert('Usuário criado com sucesso! O novo usuário deve confirmar o e-mail se a confirmação estiver ativa no Supabase.');
                }

                // 3. CRITICAL: Sign out the temporary client to prevent session conflicts
                await tempSupabase.auth.signOut();

                // Clear flag after a delay to ensure temp client cleanup is complete
                setTimeout(() => {
                    if (typeof window !== 'undefined') {
                        (window as any).isCreatingUserAdmin = false;
                    }
                }, 500);
            } else {
                console.warn('[AdminUsuarios] Auth user creation returned no user object');
                if (typeof window !== 'undefined') {
                    (window as any).isCreatingUserAdmin = false;
                }
                alert('Usuário não foi criado. Verifique se o e-mail é válido e tente novamente.');
            }

            setIsAddModalOpen(false);
            setNewUser({ full_name: '', email: '', password: '', role: 'SUPERVISOR', avatar_url: '' });

            // Wait a bit and then refresh the list
            setTimeout(() => fetchData(), 500);
        } catch (err: any) {
            console.error('[AdminUsuarios] Unexpected error:', err);
            if (typeof window !== 'undefined') {
                (window as any).isCreatingUserAdmin = false;
            }
            alert('Erro inesperado: ' + err.message);
        }
    };

    const handleEditUser = async () => {
        if (!editingUser || !editingUser.full_name) return;

        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: editingUser.full_name,
                role: editingUser.role,
                avatar_url: editingUser.avatar_url || null
            })
            .eq('id', editingUser.id);

        if (error) {
            alert('Erro ao atualizar usuário: ' + error.message);
            return;
        }

        setEditingUser(null);
        setIsEditModalOpen(false);
        fetchData();
    };

    const handleDeleteUser = async (id: string, name: string) => {
        if (confirm(`Deseja realmente excluir o acesso de "${name}"? Isso removerá o perfil, mas o usuário de autenticação deve ser removido manualmente no console do Supabase por segurança.`)) {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', id);

            if (error) {
                alert('Erro ao excluir perfil: ' + error.message);
                return;
            }
            fetchData();
        }
    };

    const filteredUsers = usuarios.filter(u => {
        const matchesSearch = (u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesRole = !roleFilter || u.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    return (
        <div className="p-8 flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <div className="flex items-center gap-3">
                        <h2 className="text-3xl font-bold text-white tracking-tight font-display uppercase">Usuários do Sistema</h2>
                        <span className="px-3 py-1 bg-primary/20 border border-primary/30 text-primary text-xs font-bold rounded-full">
                            {usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Gerencie administradores e supervisores com acesso ao painel administrativo.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => fetchData()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1c23] hover:bg-[#252831] border border-border-dark text-white text-sm font-bold rounded-lg transition-all"
                        title="Recarregar lista"
                    >
                        <span className={`material-icons-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-lg shadow-glow transition-all"
                    >
                        <span className="material-icons-outlined text-lg">person_add</span>
                        Novo Usuário
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-[#15181e] p-4 rounded-xl border border-border-dark flex gap-4 mb-6">
                <div className="relative flex-1">
                    <span className="material-icons-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">search</span>
                    <input
                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:ring-1 focus:ring-primary"
                        placeholder="Filtrar por nome ou e-mail..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-64">
                    <select
                        className="w-full bg-[#0b0c10] border border-border-dark rounded-lg py-2.5 px-3 text-sm text-white focus:ring-1 focus:ring-primary"
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                    >
                        <option value="">Todos os Perfis</option>
                        <option value="ADMIN">Administrador</option>
                        <option value="SUPERVISOR">Supervisor</option>
                    </select>
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-[#15181e]/50 border border-border-dark rounded-xl flex-1 flex flex-col overflow-hidden">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-[#1a1c23]/30 text-[10px] uppercase font-bold text-gray-500 border-b border-border-dark tracking-[0.1em]">
                                <th className="px-8 py-5">Usuário</th>
                                <th className="px-6 py-5">Perfil</th>
                                <th className="px-6 py-5">Criado em</th>
                                <th className="px-8 py-5 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark text-sm">
                            {loading ? (
                                <tr><td colSpan={4} className="px-8 py-10 text-center text-gray-500 italic">Carregando usuários...</td></tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr><td colSpan={4} className="px-8 py-10 text-center text-gray-500">Nenhum usuário encontrado.</td></tr>
                            ) : filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            {user.avatar_url ? (
                                                <img
                                                    src={user.avatar_url}
                                                    alt={user.full_name || 'Avatar'}
                                                    className="w-10 h-10 rounded-full object-cover border border-primary/30"
                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/20 text-primary text-xs font-bold border border-primary/30">
                                                    {user.full_name?.charAt(0) || 'U'}
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-bold text-white text-base">{user.full_name || 'Sem Nome'}</p>
                                                <p className="text-xs text-gray-500">{user.email || 'E-mail não informado'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full border ${user.role === 'ADMIN'
                                            ? 'bg-primary/10 border-primary/30 text-primary'
                                            : 'bg-secondary/10 border-secondary/30 text-secondary'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-6 text-gray-400">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setEditingUser(user); setIsEditModalOpen(true); }}
                                                className="text-gray-500 hover:text-primary p-1 rounded hover:bg-primary/10"
                                            >
                                                <span className="material-icons-outlined text-lg">edit</span>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user.id, user.full_name || 'Usuário')}
                                                className="text-gray-500 hover:text-danger p-1 rounded hover:bg-danger/10"
                                            >
                                                <span className="material-icons-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add User Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-[#0b0c10] rounded-xl border border-border-dark p-8 animate-fade-in shadow-2xl">
                        <h3 className="text-white text-xl font-bold mb-6">Novo Usuário Admin/Supervisor</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Nome Completo</label>
                                <input
                                    className="w-full bg-[#15181e] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary outline-none"
                                    value={newUser.full_name}
                                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">E-mail</label>
                                <input
                                    type="email"
                                    className="w-full bg-[#15181e] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary outline-none"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Senha Provisória</label>
                                <input
                                    type="password"
                                    className="w-full bg-[#15181e] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary outline-none"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Perfil de Acesso</label>
                                <select
                                    className="w-full bg-[#15181e] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary outline-none"
                                    value={newUser.role}
                                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                >
                                    <option value="SUPERVISOR">Supervisor</option>
                                    <option value="ADMIN">Administrador</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">URL da Foto de Perfil (opcional)</label>
                                <input
                                    type="url"
                                    className="w-full bg-[#15181e] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary outline-none"
                                    value={newUser.avatar_url}
                                    onChange={(e) => setNewUser({ ...newUser, avatar_url: e.target.value })}
                                    placeholder="https://exemplo.com/sua-foto.jpg"
                                />
                                <p className="text-[10px] text-gray-600 mt-1">Use uma URL de imagem pública (Gravatar, LinkedIn, etc.)</p>
                            </div>
                        </div>
                        <div className="mt-8 flex gap-3">
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="flex-1 px-5 py-2.5 bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleAddUser}
                                className="flex-1 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow transition-all"
                            >
                                Criar Acesso
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {isEditModalOpen && editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-[#0b0c10] rounded-xl border border-border-dark p-8 animate-fade-in shadow-2xl">
                        <h3 className="text-white text-xl font-bold mb-6">Editar Usuário</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Nome Completo</label>
                                <input
                                    className="w-full bg-[#15181e] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary outline-none"
                                    value={editingUser.full_name || ''}
                                    onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Perfil de Acesso</label>
                                <select
                                    className="w-full bg-[#15181e] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary outline-none"
                                    value={editingUser.role}
                                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                                >
                                    <option value="SUPERVISOR">Supervisor</option>
                                    <option value="ADMIN">Administrador</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-2">URL da Foto de Perfil</label>
                                <div className="flex gap-3 items-center">
                                    {editingUser.avatar_url && (
                                        <img
                                            src={editingUser.avatar_url}
                                            alt="Preview"
                                            className="w-12 h-12 rounded-full object-cover border border-border-dark"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                    )}
                                    <input
                                        type="url"
                                        className="flex-1 bg-[#15181e] border border-border-dark rounded-lg py-2.5 px-4 text-sm text-white focus:ring-1 focus:ring-primary outline-none"
                                        value={editingUser.avatar_url || ''}
                                        onChange={(e) => setEditingUser({ ...editingUser, avatar_url: e.target.value })}
                                        placeholder="https://exemplo.com/sua-foto.jpg"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 flex gap-3">
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="flex-1 px-5 py-2.5 bg-[#1a1c23] border border-border-dark text-white text-sm font-bold rounded-lg transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleEditUser}
                                className="flex-1 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-lg shadow-glow transition-all"
                            >
                                Salvar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminUsuarios;
