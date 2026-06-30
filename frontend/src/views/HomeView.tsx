import React, { useState } from 'react';
import { Eye, EyeOff, ArrowUpRight, Plus, QrCode, ChevronRight, ArrowDownLeft, Receipt } from 'lucide-react';

interface Transaction {
  id: string;
  type: string;
  amount: string;
  description: string;
  partyName: string;
  direction: 'INGRESO' | 'EGRESO';
  createdAt: string;
}

interface HomeViewProps {
  account: any;
  transactions: Transaction[];
  onNavigate: (tab: string) => void;
  onOpenDeposit: () => void;
  onOpenQR: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  account,
  transactions,
  onNavigate,
  onOpenDeposit,
  onOpenQR,
}) => {
  const [showBalance, setShowBalance] = useState(true);

  const formatCurrency = (val: any) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    });
  };

  const recentTransactions = transactions.slice(0, 3);

  return (
    <div className="flex flex-col h-full overflow-y-auto no-scrollbar p-5 space-y-5 bg-[#0B0B14]">
      {/* Upper header */}
      <div className="flex items-center justify-between mt-2">
        <div>
          <span className="text-xs text-fintech-neutral font-medium">Hola,</span>
          <h2 className="text-lg font-bold text-white leading-tight">
            {account?.user?.name || 'Usuario'} 👋
          </h2>
        </div>
        <div className="w-9 h-9 rounded-full bg-[#181829] flex items-center justify-center border border-white/5">
          <span className="text-xs font-bold text-fintech-primary">
            {(account?.user?.name || 'U').substring(0, 2).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Premium Wallet Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E1B4B] via-[#311B92] to-[#12063E] border border-white/10 p-6 shadow-xl shadow-indigo-900/10">
        {/* Glow vector shapes */}
        <div className="absolute top-[-50px] right-[-50px] w-36 h-36 bg-fintech-primary opacity-20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-[-30px] left-[-30px] w-24 h-24 bg-fintech-accent opacity-10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="flex justify-between items-start">
          <span className="text-xs font-medium text-indigo-200 tracking-wider">SALDO DISPONIBLE</span>
          <button
            onClick={() => setShowBalance(!showBalance)}
            className="text-indigo-200 hover:text-white transition-colors"
          >
            {showBalance ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        <div className="mt-3">
          <span className="text-3xl font-bold font-sans tracking-tight text-white transition-all">
            {showBalance ? formatCurrency(account?.balance) : '••••••'}
          </span>
        </div>

        {/* CVU / Alias Quick Display */}
        <div className="mt-6 flex justify-between items-center text-[11px] text-indigo-200/80 border-t border-white/5 pt-4">
          <div>
            <span className="block text-[10px] text-indigo-300/60 uppercase">Alias</span>
            <span className="font-semibold text-white">{account?.alias || '...'}</span>
          </div>
          <div className="text-right">
            <span className="block text-[10px] text-indigo-300/60 uppercase">CVU</span>
            <span className="font-semibold text-white">
              {account?.cvu ? `${account.cvu.slice(0, 4)}...${account.cvu.slice(-4)}` : '...'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={onOpenDeposit}
          className="flex flex-col items-center justify-center p-3.5 bg-slate-800/40 hover:bg-slate-800/60 rounded-2xl border border-white/5 transition-all group active:scale-95"
        >
          <div className="w-10 h-10 rounded-xl bg-fintech-primary/10 group-hover:bg-fintech-primary/20 flex items-center justify-center mb-2 transition-all">
            <Plus className="w-5 h-5 text-fintech-primary" />
          </div>
          <span className="text-[11px] font-semibold text-slate-200">Ingresar</span>
        </button>

        <button
          onClick={() => onNavigate('transfer')}
          className="flex flex-col items-center justify-center p-3.5 bg-slate-800/40 hover:bg-slate-800/60 rounded-2xl border border-white/5 transition-all group active:scale-95"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 group-hover:bg-indigo-500/20 flex items-center justify-center mb-2 transition-all">
            <ArrowUpRight className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="text-[11px] font-semibold text-slate-200">Transferir</span>
        </button>

        <button
          onClick={onOpenQR}
          className="flex flex-col items-center justify-center p-3.5 bg-slate-800/40 hover:bg-slate-800/60 rounded-2xl border border-white/5 transition-all group active:scale-95"
        >
          <div className="w-10 h-10 rounded-xl bg-fintech-accent/10 group-hover:bg-fintech-accent/20 flex items-center justify-center mb-2 transition-all">
            <QrCode className="w-5 h-5 text-fintech-accent" />
          </div>
          <span className="text-[11px] font-semibold text-slate-200">Pagar QR</span>
        </button>
      </div>

      {/* Activity Preview Section */}
      <div className="flex flex-col flex-1">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold text-slate-200">Actividad reciente</h3>
          <button
            onClick={() => onNavigate('history')}
            className="text-xs font-semibold text-fintech-primary flex items-center gap-0.5 hover:underline"
          >
            Ver toda <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-800/20 border border-white/5 border-dashed rounded-3xl text-center">
            <Receipt className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs text-fintech-neutral font-medium">Aún no hay transacciones</p>
            <p className="text-[10px] text-slate-600 mt-0.5">Los movimientos que realices aparecerán aquí.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentTransactions.map((tx) => {
              const isIngreso = tx.direction === 'INGRESO';
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3.5 bg-slate-800/30 border border-white/5 rounded-2xl"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      isIngreso ? 'bg-fintech-accent/10' : 'bg-fintech-danger/10'
                    }`}>
                      {isIngreso
                        ? <ArrowDownLeft className={`w-4 h-4 text-fintech-accent`} />
                        : <ArrowUpRight className={`w-4 h-4 text-fintech-danger`} />
                      }
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-100 max-w-[150px] truncate">
                        {tx.description}
                      </h4>
                      <p className="text-[10px] text-fintech-neutral mt-0.5">
                        {tx.partyName}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`text-xs font-bold ${
                      isIngreso ? 'text-fintech-accent' : 'text-slate-200'
                    }`}>
                      {isIngreso ? '+' : '-'} {formatCurrency(tx.amount)}
                    </span>
                    <p className="text-[9px] text-slate-600 mt-0.5">
                      {new Date(tx.createdAt).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
