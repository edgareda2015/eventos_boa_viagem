import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AdminUser } from '../../types';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/manage-clerk-user`;

interface AccessControlProps {
  getAdminUsers: () => Promise<AdminUser[]>;
  createAdminUser: (user: Omit<AdminUser, 'createdAt'>) => Promise<AdminUser>;
  updateAdminUser: (user: AdminUser) => Promise<AdminUser>;
  deleteAdminUser: (id: string) => Promise<void>;
}

const AccessControl: React.FC<AccessControlProps> = ({
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
}) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [profileFilter, setProfileFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [currentUser, setCurrentUser] = useState<Partial<AdminUser>>({});
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Reset Password Modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  
  // Dialog State
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);

  // Success / Error Feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await getAdminUsers();
      setUsers(data);
    } catch (err) {
      showToast('Erro ao carregar usuários', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleOpenCreateModal = () => {
    setCurrentUser({
      id: '',
      nome: '',
      email: '',
      perfil: 'COMERCIAL',
      status: 'ativo',
    });
    setPassword('');
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: AdminUser) => {
    setCurrentUser(user);
    setPassword('');
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser.nome || !currentUser.email) {
      showToast('Por favor, preencha todos os campos.', 'error');
      return;
    }
    if (modalMode === 'create' && !password) {
      showToast('Defina uma senha para o novo colaborador.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      if (modalMode === 'create') {
        // 1. Criar no Clerk via Edge Function
        const edgeRes = await fetch(EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            email: currentUser.email!.toLowerCase(),
            firstName: currentUser.nome,
            password,
          }),
        });

        const edgeData = await edgeRes.json();

        if (!edgeRes.ok) {
          throw new Error(edgeData.error || 'Erro ao criar usuário no Clerk');
        }

        const clerkId = edgeData.clerkId;

        // 2. Salvar no banco Supabase com o ID real do Clerk
        await createAdminUser({
          id: clerkId,
          nome: currentUser.nome!,
          email: currentUser.email!.toLowerCase(),
          perfil: currentUser.perfil || 'COMERCIAL',
          status: currentUser.status || 'ativo',
        });
        showToast('Colaborador criado com sucesso! Ele já pode fazer login.', 'success');
      } else {
        await updateAdminUser(currentUser as AdminUser);
        showToast('Usuário atualizado com sucesso!', 'success');
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar usuário.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = (user: AdminUser) => {
    setUserToDelete(user);
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (userToDelete) {
      try {
        // Deletar no Clerk também
        await fetch(EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', clerkUserId: userToDelete.id }),
        });
        await deleteAdminUser(userToDelete.id);
        showToast('Usuário excluído com sucesso!', 'success');
        fetchUsers();
      } catch (err) {
        showToast('Erro ao excluir usuário.', 'error');
      }
    }
  };

  const handleOpenResetPassword = (user: AdminUser) => {
    setResetTargetUser(user);
    setResetPassword('');
    setIsResetModalOpen(true);
  };

  const handleConfirmResetPassword = async () => {
    if (!resetTargetUser || !resetPassword) {
      showToast('Defina uma nova senha.', 'error');
      return;
    }
    if (resetPassword.length < 8) {
      showToast('A senha deve ter pelo menos 8 caracteres.', 'error');
      return;
    }
    setIsResetting(true);
    try {
      const res = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_password',
          clerkUserId: resetTargetUser.id,
          password: resetPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao redefinir senha');
      showToast(`Senha de ${resetTargetUser.nome} redefinida com sucesso!`, 'success');
      setIsResetModalOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Erro ao redefinir senha.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const handleToggleStatus = async (user: AdminUser) => {
    const updatedStatus = user.status === 'ativo' ? 'inativo' : 'ativo';
    try {
      await updateAdminUser({
        ...user,
        status: updatedStatus,
      });
      showToast(`Usuário ${updatedStatus === 'ativo' ? 'ativado' : 'desativado'} com sucesso!`, 'success');
      fetchUsers();
    } catch (err) {
      showToast('Erro ao alterar status do usuário.', 'error');
    }
  };

  // Filters logic
  const filteredUsers = users.filter(u => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      u.nome.toLowerCase().includes(searchLower) ||
      u.email.toLowerCase().includes(searchLower);

    const matchesProfile = profileFilter === 'all' || u.perfil === profileFilter;
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;

    return matchesSearch && matchesProfile && matchesStatus;
  });

  const stats = {
    total: users.length,
    admins: users.filter(u => u.perfil === 'ADMIN').length,
    comercial: users.filter(u => u.perfil === 'COMERCIAL').length,
    inativos: users.filter(u => u.status === 'inativo').length,
  };

  return (
    <div className="container mx-auto px-4 py-8 animate-in">
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl transition-all animate-bounce ${
          toastMessage.type === 'success' ? 'bg-green-600 text-white shadow-green-200' : 'bg-red-600 text-white shadow-red-200'
        }`}>
          <span className="material-symbols-outlined font-bold">
            {toastMessage.type === 'success' ? 'check_circle' : 'error'}
          </span>
          <p className="text-sm font-bold">{toastMessage.text}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 px-4 md:px-0">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link to="/admin" className="text-gray-400 hover:text-primary transition-colors flex items-center gap-1 text-[10px] md:text-xs font-black uppercase tracking-widest">
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Voltar ao Painel
            </Link>
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl md:text-4xl text-gray-400">admin_panel_settings</span>
            Controle de Acesso
          </h2>
          <p className="text-gray-500 mt-1 text-sm md:text-base">Gerencie os colaboradores da plataforma e suas permissões.</p>
        </div>
        <div className="px-4 md:px-0">
          <button
            onClick={handleOpenCreateModal}
            className="w-full sm:w-auto bg-primary text-white px-8 py-3.5 md:py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary-dark hover:-translate-y-0.5 transition-all active:scale-95 text-sm md:text-base"
          >
            <span className="material-symbols-outlined font-bold">person_add</span>
            Adicionar Usuário
          </button>
        </div>
      </div>

      {/* Indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-12 px-4 md:px-0">
        <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 size-20 md:size-24 bg-gray-50 rounded-full group-hover:scale-110 transition-transform"></div>
          <p className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-widest mb-1 relative z-10">Total Colaboradores</p>
          <p className="text-4xl font-black text-gray-900 relative z-10">{stats.total}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 size-20 md:size-24 bg-blue-50 rounded-full group-hover:scale-110 transition-transform"></div>
          <p className="text-[10px] md:text-xs font-black text-primary uppercase tracking-widest mb-1 relative z-10">Administradores</p>
          <p className="text-4xl font-black text-primary relative z-10">{stats.admins}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 size-20 md:size-24 bg-purple-50 rounded-full group-hover:scale-110 transition-transform"></div>
          <p className="text-[10px] md:text-xs font-black text-purple-600 uppercase tracking-widest mb-1 relative z-10">Comerciais</p>
          <p className="text-4xl font-black text-purple-700 relative z-10">{stats.comercial}</p>
        </div>
        <div className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute right-0 top-0 translate-x-1/3 -translate-y-1/3 size-20 md:size-24 bg-red-50 rounded-full group-hover:scale-110 transition-transform"></div>
          <p className="text-[10px] md:text-xs font-black text-red-500 uppercase tracking-widest mb-1 relative z-10">Inativos</p>
          <p className="text-4xl font-black text-red-600 relative z-10">{stats.inativos}</p>
        </div>
      </div>

      {/* Table & Filters Card */}
      <div className="bg-white md:rounded-[2.5rem] shadow-sm border-y md:border border-gray-100 overflow-hidden">
        {/* Filters bar */}
        <div className="p-5 md:p-8 border-b flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          <div className="relative flex-grow">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
            <input
              type="text"
              placeholder="Pesquisar por nome ou e-mail..."
              className="pl-10 pr-4 py-3 bg-gray-50 border-gray-200 rounded-xl text-sm focus:ring-primary focus:border-primary w-full"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap sm:flex-nowrap gap-3">
            {/* Profile Filter */}
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 flex-grow sm:flex-grow-0">
              <span className="material-symbols-outlined text-gray-400 text-lg">badge</span>
              <select
                className="bg-transparent border-none text-xs font-bold text-gray-600 focus:ring-0 pr-8 cursor-pointer w-full"
                value={profileFilter}
                onChange={e => setProfileFilter(e.target.value)}
              >
                <option value="all">Todos os Perfis</option>
                <option value="ADMIN">ADMIN</option>
                <option value="COMERCIAL">COMERCIAL</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200 flex-grow sm:flex-grow-0">
              <span className="material-symbols-outlined text-gray-400 text-lg">toggle_on</span>
              <select
                className="bg-transparent border-none text-xs font-bold text-gray-600 focus:ring-0 pr-8 cursor-pointer w-full"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">Todos os Status</option>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center animate-pulse">
              <div className="size-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Carregando Usuários...</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-gray-50/50 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                <tr>
                  <th className="px-8 py-5">Colaborador</th>
                  <th className="px-8 py-5">Perfil</th>
                  <th className="px-8 py-5">Data de Criação</th>
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="flex flex-col gap-0.5">
                        <p className="font-bold text-gray-900">{u.nome}</p>
                        <p className="text-xs text-gray-400 font-medium">{u.email}</p>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      {u.perfil === 'ADMIN' ? (
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-widest rounded-md border border-blue-100">
                          ADMIN
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-purple-50 text-purple-600 text-[9px] font-black uppercase tracking-widest rounded-md border border-purple-100">
                          COMERCIAL
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-xs text-gray-500 font-semibold">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                      </p>
                    </td>
                    <td className="px-8 py-5">
                      <button
                        onClick={() => handleToggleStatus(u)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all hover:scale-95 ${
                          u.status === 'ativo'
                            ? 'bg-green-50 text-green-600 border border-green-100'
                            : 'bg-red-50 text-red-600 border border-red-100'
                        }`}
                        title="Clique para alternar status"
                      >
                        <span className={`size-1.5 rounded-full ${u.status === 'ativo' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        {u.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        <button
                          onClick={() => handleOpenResetPassword(u)}
                          className="bg-gray-50 hover:bg-amber-500 hover:text-white p-2 rounded-xl text-gray-500 hover:shadow-lg transition-all"
                          title="Redefinir Senha"
                        >
                          <span className="material-symbols-outlined text-lg flex">key</span>
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          className="bg-gray-50 hover:bg-primary hover:text-white p-2 rounded-xl text-gray-500 hover:shadow-lg transition-all"
                          title="Editar Colaborador"
                        >
                          <span className="material-symbols-outlined text-lg flex">edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(u)}
                          className="bg-gray-50 hover:bg-red-600 hover:text-white p-2 rounded-xl text-gray-500 hover:shadow-lg transition-all"
                          title="Excluir Colaborador"
                        >
                          <span className="material-symbols-outlined text-lg flex">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-2 grayscale opacity-40">
                        <span className="material-symbols-outlined text-5xl">person_search</span>
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Nenhum colaborador encontrado</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Save User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100">
            <div className="bg-primary p-6 md:p-8 text-center relative">
              <h3 className="text-white text-2xl font-black tracking-tight">
                {modalMode === 'create' ? 'Cadastrar Colaborador' : 'Editar Colaborador'}
              </h3>
              <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-1">Dados de Permissão</p>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="absolute right-6 top-6 text-white/70 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 md:p-8 space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Nome do Colaborador</label>
                <input
                  type="text"
                  required
                  placeholder="Nome Completo"
                  className="w-full bg-[#E8F0FE] border-none rounded-xl p-4 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                  value={currentUser.nome || ''}
                  onChange={e => setCurrentUser({ ...currentUser, nome: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">E-mail de Acesso</label>
                <input
                  type="email"
                  required
                  disabled={modalMode === 'edit'}
                  placeholder="seu.nome@institucional.com"
                  className="w-full bg-[#E8F0FE] border-none rounded-xl p-4 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none disabled:opacity-60"
                  value={currentUser.email || ''}
                  onChange={e => setCurrentUser({ ...currentUser, email: e.target.value })}
                />
              </div>

              {modalMode === 'create' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Senha de Acesso</label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 8 caracteres"
                    minLength={8}
                    className="w-full bg-[#E8F0FE] border-none rounded-xl p-4 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <p className="text-[10px] text-gray-400 font-bold mt-1.5 ml-1">Esta senha será usada pelo colaborador para fazer login no sistema.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Perfil de Permissão</label>
                  <div className="relative bg-[#E8F0FE] rounded-xl overflow-hidden">
                    <select
                      className="w-full bg-transparent border-none p-4 text-sm font-bold text-gray-700 outline-none pr-8 cursor-pointer focus:ring-2 focus:ring-blue-500/20"
                      value={currentUser.perfil || 'COMERCIAL'}
                      onChange={e => setCurrentUser({ ...currentUser, perfil: e.target.value as any })}
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="COMERCIAL">COMERCIAL</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Status da Conta</label>
                  <div className="relative bg-[#E8F0FE] rounded-xl overflow-hidden">
                    <select
                      className="w-full bg-transparent border-none p-4 text-sm font-bold text-gray-700 outline-none pr-8 cursor-pointer focus:ring-2 focus:ring-blue-500/20"
                      value={currentUser.status || 'ativo'}
                      onChange={e => setCurrentUser({ ...currentUser, status: e.target.value as any })}
                    >
                      <option value="ativo">Ativo</option>
                      <option value="inativo">Inativo</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-primary hover:bg-primary-dark text-white py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-primary/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <><div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Salvando...</>
                  ) : (
                    modalMode === 'create' ? 'Cadastrar e Sincronizar' : 'Salvar'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Redefinição de Senha */}
      {isResetModalOpen && resetTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm animate-in">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100">
            <div className="bg-amber-500 p-6 md:p-8 text-center relative">
              <h3 className="text-white text-2xl font-black tracking-tight">Redefinir Senha</h3>
              <p className="text-white/80 text-xs font-bold uppercase tracking-widest mt-1">{resetTargetUser.nome}</p>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="absolute right-6 top-6 text-white/70 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              <p className="text-sm text-gray-500 font-medium">
                Digite a nova senha para <strong>{resetTargetUser.nome}</strong>. Ela será atualizada imediatamente no sistema de login.
              </p>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Nova Senha</label>
                <input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  minLength={8}
                  className="w-full bg-[#FFF8E1] border-none rounded-xl p-4 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-amber-400/30 transition-all outline-none"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={() => setIsResetModalOpen(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isResetting || resetPassword.length < 8}
                  onClick={handleConfirmResetPassword}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-white py-4 rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isResetting ? (
                    <><div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Salvando...</>
                  ) : (
                    'Redefinir Senha'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Excluir Colaborador"
        message={`Deseja realmente excluir permanentemente o colaborador "${userToDelete?.nome}"? Ele perderá todo o acesso administrativo.`}
        confirmText="Excluir"
        cancelText="Cancelar"
      />
    </div>
  );
};

export default AccessControl;

