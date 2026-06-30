import React, { useState } from 'react';
import { Copy, Check, LogOut, ShieldCheck, Bell, Smartphone, User, Moon } from 'lucide-react';

interface ProfileViewProps {
  account: any;
  onLogout: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ account, onLogout }) => {
  const [copiedField, setCopiedField] = useState<'cvu' | 'alias' | null>(null);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  const copyToClipboard = (text: string, field: 'cvu' | 'alias') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField(null);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto no-scrollbar p-5 space-y-5 bg-[#0B0B14]">
      {/* Profile Header */}
      <div className="flex flex-col items-center py-4 text-center mt-2">
        <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-3">
          <User className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-lg font-bold text-white leading-tight">
          {account?.user?.name || 'Usuario'}
        </h2>
        <span className="text-xs text-fintech-neutral font-medium mt-1">
          {account?.user?.email || 'email@correo.com'}
        </span>
      </div>

      {/* Financial Identity Card */}
      <div className="bg-[#121222] border border-white/5 rounded-3xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
          Datos de tu cuenta
        </h3>

        {/* CVU Field */}
        <div className="flex items-center justify-between p-3.5 bg-slate-900/40 rounded-2xl border border-white/5">
          <div className="space-y-0.5">
            <span className="text-[9px] text-slate-500 uppercase block">CVU</span>
            <span className="font-mono text-xs text-slate-300 block tracking-wider select-all">
              {account?.cvu || '...'}
            </span>
          </div>
          <button
            onClick={() => copyToClipboard(account?.cvu, 'cvu')}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-750 flex items-center justify-center text-slate-300 active:scale-95 transition-all"
          >
            {copiedField === 'cvu' ? (
              <Check className="w-4 h-4 text-fintech-accent" />
            ) : (
              <Copy className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>

        {/* Alias Field */}
        <div className="flex items-center justify-between p-3.5 bg-slate-900/40 rounded-2xl border border-white/5">
          <div className="space-y-0.5">
            <span className="text-[9px] text-slate-500 uppercase block">Alias</span>
            <span className="font-semibold text-xs text-slate-300 block">
              {account?.alias || '...'}
            </span>
          </div>
          <button
            onClick={() => copyToClipboard(account?.alias, 'alias')}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-750 flex items-center justify-center text-slate-300 active:scale-95 transition-all"
          >
            {copiedField === 'alias' ? (
              <Check className="w-4 h-4 text-fintech-accent" />
            ) : (
              <Copy className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Settings Options Mock */}
      <div className="bg-[#121222] border border-white/5 rounded-3xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
          Ajustes del Dispositivo
        </h3>

        {/* Dark Mode switch */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 text-slate-300">
            <Moon className="w-4 h-4 text-slate-400" />
            <span>Modo Oscuro</span>
          </div>
          <div className="relative inline-flex items-center cursor-pointer select-none">
            <div className="w-9 h-5 bg-fintech-primary rounded-full transition-all"></div>
            <div className="absolute right-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-all"></div>
          </div>
        </div>

        {/* Push notifications switch */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 text-slate-300">
            <Bell className="w-4 h-4 text-slate-400" />
            <span>Notificaciones Push</span>
          </div>
          <button
            onClick={() => setPushEnabled(!pushEnabled)}
            className="relative inline-flex items-center cursor-pointer select-none"
          >
            <div className={`w-9 h-5 rounded-full transition-all ${
              pushEnabled ? 'bg-fintech-primary' : 'bg-slate-800'
            }`}></div>
            <div className={`absolute bg-white w-4 h-4 rounded-full transition-all ${
              pushEnabled ? 'right-0.5 top-0.5' : 'left-0.5 top-0.5'
            }`}></div>
          </button>
        </div>

        {/* Biometrics switch */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <span>Biometría (Face ID)</span>
          </div>
          <button
            onClick={() => setBiometricsEnabled(!biometricsEnabled)}
            className="relative inline-flex items-center cursor-pointer select-none"
          >
            <div className={`w-9 h-5 rounded-full transition-all ${
              biometricsEnabled ? 'bg-fintech-primary' : 'bg-slate-800'
            }`}></div>
            <div className={`absolute bg-white w-4 h-4 rounded-full transition-all ${
              biometricsEnabled ? 'right-0.5 top-0.5' : 'left-0.5 top-0.5'
            }`}></div>
          </button>
        </div>
      </div>

      {/* Logout Action */}
      <button
        onClick={onLogout}
        className="w-full h-11 bg-red-950/20 hover:bg-red-950/40 text-red-400 rounded-2xl border border-red-500/10 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
      >
        <LogOut className="w-4 h-4" />
        Cerrar Sesión
      </button>
    </div>
  );
};
