import React, { useState } from 'react';
import { Mail, Lock, User, Wallet, ArrowRight } from 'lucide-react';
import { API_URL } from '../config';

interface LoginViewProps {
  onLoginSuccess: (token: string, user: any, account: any) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [startingBalance, setStartingBalance] = useState('15000');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegistering
        ? `${API_URL}/api/auth/register`
        : `${API_URL}/api/auth/login`;
      const body = isRegistering
        ? { email, password, name, startingBalance: parseFloat(startingBalance) }
        : { email, password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Algo salió mal.');
      }

      if (isRegistering) {
        // Automatically switch to login after registration
        setIsRegistering(false);
        setError('');
        // Attempt auto-login
        const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const loginData = await loginResponse.json();
        if (loginResponse.ok) {
          onLoginSuccess(loginData.token, loginData.user, loginData.account);
        } else {
          setError('Registro exitoso. Inicie sesión.');
        }
      } else {
        onLoginSuccess(data.token, data.user, data.account);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (presetEmail: string) => {
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: presetEmail, password: 'password123' }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error al iniciar sesión rápida.');
      }
      onLoginSuccess(data.token, data.user, data.account);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full justify-between p-6 bg-[#0B0B14]">
      {/* Brand Header */}
      <div className="flex flex-col items-center mt-6">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-fintech-primary to-indigo-400 flex items-center justify-center shadow-lg shadow-fintech-primary/20 ring-pulse-effect">
          <Wallet className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold mt-4 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          SillyWallet
        </h1>
        <p className="text-xs text-fintech-neutral font-medium uppercase tracking-widest mt-1">
          Demo Fintech Educativa
        </p>
      </div>

      {/* Main Login Card */}
      <div className="glass-panel rounded-3xl p-5 my-auto shadow-xl border border-white/5">
        <h2 className="text-xl font-semibold text-white mb-4">
          {isRegistering ? 'Crear Cuenta Pasivo' : 'Ingresar a tu Cuenta'}
        </h2>

        {error && (
          <div className="bg-red-900/30 border border-red-500/30 text-red-300 text-xs rounded-xl p-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Nombre Completo</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  placeholder="Ej. Juan Pérez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#181829] border border-white/5 focus:border-fintech-primary/50 text-white rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none transition-all"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Correo Electrónico</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                placeholder="usuario@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#181829] border border-white/5 focus:border-fintech-primary/50 text-white rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Contraseña</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#181829] border border-white/5 focus:border-fintech-primary/50 text-white rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none transition-all"
              />
            </div>
          </div>

          {isRegistering && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Saldo Inicial Simulado (ARS)</label>
              <input
                type="number"
                min="0"
                max="1000000"
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                className="w-full bg-[#181829] border border-white/5 focus:border-fintech-primary/50 text-white rounded-xl py-2.5 px-4 text-sm focus:outline-none transition-all"
              />
              <span className="text-[10px] text-fintech-neutral block mt-1">
                Generará un asiento de DEPOSIT (+Activo / +Pasivo) en el ledger.
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-fintech-primary hover:bg-fintech-primaryHover text-white rounded-xl font-medium text-sm flex items-center justify-center gap-1 transition-all active:scale-95 shadow-md shadow-fintech-primary/10 mt-6 disabled:opacity-50"
          >
            {loading ? 'Procesando...' : isRegistering ? 'Registrarse' : 'Ingresar'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="text-center mt-4">
          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-xs text-fintech-primary hover:underline font-semibold"
          >
            {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
          </button>
        </div>
      </div>

      {/* Demo Credentials Quick Switcher (Educational Tool) */}
      <div className="bg-[#121220] border border-white/5 rounded-2xl p-4 mt-auto">
        <p className="text-xs font-bold text-fintech-warning mb-2.5 uppercase tracking-wider text-center">
          ⚡ Accesos Rápidos Demo (Semilla)
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleQuickLogin('test@wallet.com')}
            disabled={loading}
            className="bg-slate-800/60 hover:bg-slate-800 text-[10px] text-white py-2 px-1 rounded-xl text-center flex flex-col items-center justify-center font-medium border border-white/5"
          >
            <span className="font-bold text-fintech-primary text-[11px]">$15K</span>
            <span>Test User</span>
          </button>
          <button
            onClick={() => handleQuickLogin('juan@perez.com')}
            disabled={loading}
            className="bg-slate-800/60 hover:bg-slate-800 text-[10px] text-white py-2 px-1 rounded-xl text-center flex flex-col items-center justify-center font-medium border border-white/5"
          >
            <span className="font-bold text-fintech-accent text-[11px]">$25K</span>
            <span>Juan Pérez</span>
          </button>
          <button
            onClick={() => handleQuickLogin('maria@rodriguez.com')}
            disabled={loading}
            className="bg-slate-800/60 hover:bg-slate-800 text-[10px] text-white py-2 px-1 rounded-xl text-center flex flex-col items-center justify-center font-medium border border-white/5"
          >
            <span className="font-bold text-indigo-400 text-[11px]">$45K</span>
            <span>M. Rodríguez</span>
          </button>
        </div>
        <p className="text-[10px] text-center text-slate-500 mt-2">
          La contraseña por defecto para todos es <code className="bg-slate-900 px-1 rounded text-slate-400">password123</code>.
        </p>
      </div>
    </div>
  );
};
