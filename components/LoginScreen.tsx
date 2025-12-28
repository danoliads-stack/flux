
import React, { useState } from 'react';
import { useAuth } from '../AuthContext';

const LoginScreen: React.FC = () => {
  const { loginAsAdmin, loginAsOperator } = useAuth();
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [matricula, setMatricula] = useState('');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOperatorLogin = async () => {
    if (!matricula || !pin) {
      setError('Informe matrícula e PIN');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await loginAsOperator(matricula, pin);
    if (result.error) setError(result.error);
    setLoading(false);
  };

  const handleAdminLogin = async () => {
    if (!email || !password) {
      setError('Informe e-mail e senha');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await loginAsAdmin(email, password);
    if (result.error) setError('E-mail ou senha inválidos');
    setLoading(false);
  };

  return (
    <div className="h-screen w-full flex items-center justify-center relative bg-background-dark overflow-hidden font-body">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-drift animate-blob"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] animate-drift-reverse animate-blob"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] bg-secondary/5 rounded-full blur-[100px] animate-pulse"></div>
      </div>

      <div className="w-full max-w-md p-6 relative z-10 animate-fade-in">
        {/* Branding Header */}
        <div className="flex flex-col items-center mb-10 transition-all duration-700 transform">
          <div className="mb-6 drop-shadow-[0_0_20px_rgba(14,165,233,0.3)] hover:scale-105 transition-transform duration-500">
            <img
              src="/assets/logo-horizontal.png"
              alt="FLUX Logo"
              className="h-20 w-auto object-contain"
            />
          </div>
          <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-surface-dark/40 border border-border-dark/50 backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-secondary animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <p className="text-[10px] text-secondary font-bold uppercase tracking-[0.2em]">System Status • Ready</p>
          </div>
        </div>

        {/* Login Card with Glassmorphism */}
        <div className="relative group perspective-1000">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-blue-600/30 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>

          <div className="relative bg-surface-dark/60 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-8 md:p-10 space-y-8">
              {/* Mode Toggle Header */}
              <div className="flex justify-between items-center mb-2">
                <div className="overflow-hidden">
                  <h2 className="text-xl font-display font-medium text-white uppercase tracking-wider transition-all duration-500">
                    {isAdminMode ? 'Administração' : 'Identificação'}
                  </h2>
                </div>
                <button
                  onClick={() => { setIsAdminMode(!isAdminMode); setError(null); }}
                  className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-widest flex items-center gap-1 group/btn"
                >
                  <span className="material-icons-outlined text-xs group-hover/btn:rotate-180 transition-transform duration-500">
                    {isAdminMode ? 'person' : 'admin_panel_settings'}
                  </span>
                  {isAdminMode ? 'Operador' : 'Acesso Admin'}
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-danger/10 border border-danger/20 p-4 rounded-xl text-danger text-xs font-bold text-center animate-bounce-short">
                  <span className="material-icons-outlined text-sm align-middle mr-2">error_outline</span>
                  {error}
                </div>
              )}

              {/* Input Forms */}
              <div className="space-y-6">
                <div className={`transition-all duration-500 transform ${isAdminMode ? 'translate-x-10 opacity-0 hidden' : 'translate-x-0 opacity-100'}`}>
                  {!isAdminMode && (
                    <div className="space-y-4">
                      <div className="relative group/input">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-sub-dark group-focus-within/input:text-primary transition-colors">
                          <span className="material-icons-outlined text-xl">badge</span>
                        </div>
                        <input
                          className="block w-full pl-12 pr-4 py-4 bg-background-dark/50 border border-border-dark/50 rounded-xl text-white placeholder-text-sub-dark/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all shadow-inner"
                          placeholder="Matrícula (ex: OP-492)"
                          value={matricula}
                          onChange={(e) => setMatricula(e.target.value)}
                        />
                      </div>
                      <div className="relative group/input">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-sub-dark group-focus-within/input:text-primary transition-colors">
                          <span className="material-icons-outlined text-xl">key</span>
                        </div>
                        <input
                          type="password"
                          className="block w-full pl-12 pr-4 py-4 bg-background-dark/50 border border-border-dark/50 rounded-xl text-white placeholder-text-sub-dark/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all shadow-inner"
                          placeholder="PIN (ex: 1234)"
                          value={pin}
                          onChange={(e) => setPin(e.target.value)}
                        />
                      </div>
                      <button
                        onClick={handleOperatorLogin}
                        disabled={loading}
                        className="w-full relative py-4 px-6 rounded-xl font-display font-bold text-white bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 transition-all active:scale-[0.98] disabled:opacity-50 overflow-hidden group/submit"
                      >
                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/submit:translate-y-0 transition-transform"></div>
                        <span className="relative flex justify-center items-center gap-3">
                          {loading ? 'Processando...' : 'Acessar Painel'}
                          {!loading && <span className="material-icons-outlined text-xl group-hover/submit:translate-x-1 transition-transform">arrow_right_alt</span>}
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                <div className={`transition-all duration-500 transform ${isAdminMode ? 'translate-x-0 opacity-100' : 'translate-x-[-10px] opacity-0 hidden'}`}>
                  {isAdminMode && (
                    <div className="space-y-4">
                      <div className="relative group/input">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-sub-dark group-focus-within/input:text-primary transition-colors">
                          <span className="material-icons-outlined text-xl">alternate_email</span>
                        </div>
                        <input
                          className="block w-full pl-12 pr-4 py-4 bg-background-dark/50 border border-border-dark/50 rounded-xl text-white placeholder-text-sub-dark/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all shadow-inner"
                          placeholder="E-mail Administrativo"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      <div className="relative group/input">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-text-sub-dark group-focus-within/input:text-primary transition-colors">
                          <span className="material-icons-outlined text-xl">lock_open</span>
                        </div>
                        <input
                          type="password"
                          className="block w-full pl-12 pr-4 py-4 bg-background-dark/50 border border-border-dark/50 rounded-xl text-white placeholder-text-sub-dark/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all shadow-inner"
                          placeholder="Senha Secreta"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                      <button
                        onClick={handleAdminLogin}
                        disabled={loading}
                        className="w-full relative py-4 px-6 rounded-xl font-display font-bold text-white bg-gradient-to-r from-blue-600 to-primary hover:from-blue-600/90 hover:to-primary/90 transition-all active:scale-[0.98] disabled:opacity-50 overflow-hidden group/submit"
                      >
                        <div className="absolute inset-0 bg-white/10 translate-y-full group-hover/submit:translate-y-0 transition-transform"></div>
                        <span className="relative">
                          {loading ? 'Autenticando...' : 'Entrar na Administração'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Information */}
            <div className="bg-white/[0.02] px-8 py-5 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-3">
              <span className="text-[10px] text-text-sub-dark/60 font-mono font-medium tracking-widest uppercase">
                FLUX OS v2.4 <span className="mx-2 text-white/10">|</span> BUILD 10.25
              </span>
              <button className="text-[10px] font-bold text-text-sub-dark/80 hover:text-primary flex items-center gap-2 transition-all uppercase tracking-widest group/support">
                <span className="flex w-2 h-2 rounded-full bg-primary/20 group-hover:bg-primary transition-colors"></span>
                Support Center
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce-short {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .animate-bounce-short {
          animation: bounce-short 0.5s ease-in-out 3;
        }
        .perspective-1000 {
          perspective: 1000px;
        }
      `}</style>
    </div>
  );
};

export default LoginScreen;
