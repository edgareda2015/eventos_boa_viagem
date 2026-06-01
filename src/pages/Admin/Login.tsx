import React, { useState } from 'react';
import { useSignIn } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/img/logo.png';

const AdminLogin: React.FC = () => {
  const { isLoaded, signIn, setActive } = useSignIn();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'login' | 'forgot-password' | 'reset-password'>('login');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setError('');
    setLoading(true);

    try {
      // 1. Inicia o processo de login
      const result = await signIn.create({
        identifier: email,
        password,
      });

      // 2. Se completar direto, entra
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        navigate('/admin');
        return;
      }

      // 3. Se necessitar do primeiro fator (senha) de forma explícita por segurança
      if (result.status === 'needs_first_factor') {
        const firstFactorResult = await signIn.attemptFirstFactor({
          strategy: 'password',
          password: password,
        });
        if (firstFactorResult.status === 'complete') {
          await setActive({ session: firstFactorResult.createdSessionId });
          navigate('/admin');
          return;
        }
      }

      // Caso caia em outro status não mapeado (como validações pendentes)
      setError('Acesso requer confirmação adicional. Verifique as configurações de segurança ou use a redefinição de senha.');
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Erro ao realizar login. Verifique seu e-mail e senha.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setError('');
    setLoading(true);

    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email,
      });
      setView('reset-password');
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Erro ao enviar código.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setError('');
    setLoading(true);

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        navigate('/admin');
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || 'Código ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 mt-20 px-4">
      <div className="bg-white p-10 rounded-[40px] shadow-2xl shadow-blue-100 border border-gray-100">
        <div className="text-center mb-10">
          <img src={logo} alt="UNINASSAU" className="h-16 w-auto mx-auto mb-6 object-contain" />
          <h2 className="text-[28px] font-black text-[#0f172a] leading-tight mb-2">
            {view === 'login' && 'Acesso Administrativo'}
            {view === 'forgot-password' && 'Recuperar Senha'}
            {view === 'reset-password' && 'Nova Senha'}
          </h2>
          <p className="text-sm font-medium text-gray-400">
            {view === 'login' && 'Uso restrito para colaboradores UNINASSAU'}
            {view === 'forgot-password' && 'Enviaremos um código para seu e-mail'}
            {view === 'reset-password' && 'Digite o código enviado e sua nova senha'}
          </p>
        </div>

        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-8">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 ml-1">E-mail Institucional</label>
              <input
                type="email"
                required
                placeholder="seu@email.com"
                className="w-full bg-[#E8F0FE] border-none rounded-2xl p-5 text-[15px] font-medium text-gray-700 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest ml-1">Senha de Acesso</label>
                <button
                  type="button"
                  onClick={() => setView('forgot-password')}
                  className="text-[10px] font-black text-blue-600 uppercase tracking-wider hover:underline"
                >
                  Esqueci a senha
                </button>
              </div>
              <input
                type="password"
                required
                placeholder="••••••"
                className="w-full bg-[#E8F0FE] border-none rounded-2xl p-5 text-[15px] font-medium text-gray-700 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl">
                  <p className="text-red-600 text-xs font-bold text-center">{error}</p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !isLoaded}
              className="w-full bg-[#1d7df0] text-white py-5 rounded-2xl font-bold text-[17px] hover:bg-[#1565c0] transition-all shadow-xl shadow-blue-100 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Entrando...' : 'Entrar no Sistema'}
            </button>
          </form>
        )}

        {view === 'forgot-password' && (
          <form onSubmit={handleForgotPassword} className="space-y-6">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 ml-1">E-mail para Recuperação</label>
              <input
                type="email"
                required
                placeholder="seu@email.com"
                className="w-full bg-[#E8F0FE] border-none rounded-2xl p-5 text-[15px] font-medium text-gray-700 outline-none"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              {error && <p className="text-red-500 text-xs mt-3 font-bold text-center">{error}</p>}
            </div>

            <div className="flex flex-col gap-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#1d7df0] text-white py-5 rounded-2xl font-bold hover:bg-[#1565c0] shadow-lg transition-all"
              >
                {loading ? 'Enviando...' : 'Enviar Código'}
              </button>
              <button
                type="button"
                onClick={() => setView('login')}
                className="text-xs font-bold text-gray-400 uppercase tracking-wide hover:text-gray-600"
              >
                Voltar para o Login
              </button>
            </div>
          </form>
        )}

        {view === 'reset-password' && (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 ml-1">Código Enviado</label>
              <input
                type="text"
                required
                placeholder="000000"
                className="w-full bg-[#E8F0FE] border-none rounded-2xl p-5 text-center font-black tracking-widest text-lg outline-none"
                value={code}
                onChange={e => setCode(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 ml-1">Nova Senha</label>
              <input
                type="password"
                required
                placeholder="Digite a nova senha"
                className="w-full bg-[#E8F0FE] border-none rounded-2xl p-5 outline-none"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              {error && <p className="text-red-500 text-xs mt-3 font-bold text-center">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-5 rounded-2xl font-bold shadow-lg transition-all"
            >
              {loading ? 'Redefinindo...' : 'Alterar Senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminLogin;
