import React, { useState } from 'react';
import { Search, ArrowUpRight, ArrowDownLeft, X, Share2, Receipt, Filter } from 'lucide-react';

interface Transaction {
  id: string;
  reference: string;
  type: string;
  status: string;
  amount: string;
  description: string;
  partyName: string;
  direction: 'INGRESO' | 'EGRESO';
  createdAt: string;
}

interface HistoryViewProps {
  transactions: Transaction[];
}

export const HistoryView: React.FC<HistoryViewProps> = ({ transactions }) => {
  const [filter, setFilter] = useState<'ALL' | 'INCOME' | 'OUTCOME'>('ALL');
  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const formatCurrency = (val: any) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    });
  };

  const filteredTransactions = transactions.filter((tx) => {
    // 1. Search text filter
    const matchesSearch =
      tx.description.toLowerCase().includes(search.toLowerCase()) ||
      tx.partyName.toLowerCase().includes(search.toLowerCase()) ||
      tx.reference.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    // 2. Tab filter
    if (filter === 'INCOME') return tx.direction === 'INGRESO';
    if (filter === 'OUTCOME') return tx.direction === 'EGRESO';
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-[#0B0B14] relative">
      {/* Search and Filters Header */}
      <div className="p-4 border-b border-white/5 bg-[#0F0F1D]/50 space-y-3 shrink-0">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            placeholder="Buscar por nombre, motivo o referencia"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#181829] border border-white/5 focus:border-fintech-primary/50 text-white rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none transition-all placeholder:text-slate-500"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('ALL')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              filter === 'ALL'
                ? 'bg-slate-800 text-white border-white/10'
                : 'bg-slate-900/40 text-fintech-neutral border-transparent hover:bg-slate-850'
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter('INCOME')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              filter === 'INCOME'
                ? 'bg-fintech-accent/10 text-fintech-accent border-fintech-accent/20'
                : 'bg-slate-900/40 text-fintech-neutral border-transparent hover:bg-slate-850'
            }`}
          >
            Ingresos
          </button>
          <button
            onClick={() => setFilter('OUTCOME')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              filter === 'OUTCOME'
                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                : 'bg-slate-900/40 text-fintech-neutral border-transparent hover:bg-slate-850'
            }`}
          >
            Egresos
          </button>
        </div>
      </div>

      {/* Transaction List */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-2">
        {filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center h-[70%]">
            <Receipt className="w-10 h-10 text-slate-700 mb-2.5" />
            <p className="text-xs text-fintech-neutral font-medium">Ningún movimiento coincide</p>
            <p className="text-[10px] text-slate-600 mt-0.5">Prueba cambiando los filtros o la búsqueda.</p>
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const isIngreso = tx.direction === 'INGRESO';
            return (
              <button
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                className="w-full flex items-center justify-between p-3.5 bg-slate-800/20 hover:bg-slate-850/40 border border-white/5 rounded-2xl transition-all text-left active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    isIngreso ? 'bg-fintech-accent/10' : 'bg-fintech-danger/10'
                  }`}>
                    {isIngreso
                      ? <ArrowDownLeft className="w-4 h-4 text-fintech-accent" />
                      : <ArrowUpRight className="w-4 h-4 text-fintech-danger" />
                    }
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-100 max-w-[155px] truncate">
                      {tx.description}
                    </h4>
                    <p className="text-[10px] text-fintech-neutral mt-0.5 max-w-[155px] truncate">
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
                      month: '2-digit',
                      year: '2-digit',
                    })}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* TICKET DETAIL MODAL / SLIDE DRAWERS */}
      {selectedTx && (
        <div className="absolute inset-0 bg-[#05050AC0] backdrop-blur-sm flex items-end justify-center z-50 p-4 transition-all">
          <div className="w-full bg-[#121222] border border-white/10 rounded-t-3xl rounded-b-2xl p-5 shadow-2xl space-y-4 max-h-[90%] overflow-y-auto no-scrollbar animate-[slideUp_0.2s_ease-out]">
            
            <div className="flex justify-between items-center pb-2.5 border-b border-white/5">
              <span className="text-xs font-bold text-slate-400">Detalle del Movimiento</span>
              <button
                onClick={() => setSelectedTx(null)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-750 flex items-center justify-center text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-center py-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
                selectedTx.direction === 'INGRESO' ? 'bg-fintech-accent/15' : 'bg-fintech-danger/15'
              }`}>
                {selectedTx.direction === 'INGRESO'
                  ? <ArrowDownLeft className="w-6 h-6 text-fintech-accent" />
                  : <ArrowUpRight className="w-6 h-6 text-fintech-danger" />
                }
              </div>
              <span className="text-xs text-fintech-neutral uppercase block font-medium">Monto</span>
              <span className="text-2xl font-black text-white mt-1 block">
                {formatCurrency(selectedTx.amount)}
              </span>
            </div>

            <div className="bg-slate-900/60 rounded-2xl p-4 space-y-3.5 text-xs">
              <div>
                <span className="text-slate-500 block uppercase text-[9px]">Concepto / Motivo</span>
                <span className="font-semibold text-white block mt-0.5">{selectedTx.description}</span>
              </div>

              <div>
                <span className="text-slate-500 block uppercase text-[9px]">Contraparte</span>
                <span className="font-semibold text-slate-200 block mt-0.5">{selectedTx.partyName}</span>
              </div>

              <div>
                <span className="text-slate-500 block uppercase text-[9px]">Referencia del Ledger</span>
                <span className="font-mono font-semibold text-slate-200 block mt-0.5 tracking-wider select-all bg-slate-950/40 p-1.5 rounded border border-white/5">
                  {selectedTx.reference}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block uppercase text-[9px]">Fecha y Hora</span>
                <span className="font-semibold text-slate-200 block mt-0.5">
                  {new Date(selectedTx.createdAt).toLocaleString('es-AR')}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block uppercase text-[9px]">Tipo de Operación</span>
                <span className="font-semibold text-slate-200 block mt-0.5">{selectedTx.type}</span>
              </div>

              <div>
                <span className="text-slate-500 block uppercase text-[9px]">Estado de Transacción</span>
                <span className="font-bold text-fintech-accent block mt-0.5">
                  {selectedTx.status} (AUDITADO)
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSelectedTx(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl border border-white/5 transition-all"
              >
                Cerrar
              </button>
              <button
                className="w-12 h-10 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center transition-all"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
