import React, { useState, useEffect } from 'react';
import { Shield, Users, Coins, TrendingUp, RefreshCw, ArrowRight, Loader2, Search, CheckCircle2 } from 'lucide-react';
import { API_URL } from '../config';

interface AdminDashboardViewProps {
  token: string;
  showToast: (title: string, message: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ token, showToast }) => {
  // Metrics
  const [metrics, setMetrics] = useState({
    activeUsersCount: 0,
    totalVolume: 0,
    totalMoneyIssued: 0,
  });
  const [metricsLoading, setMetricsLoading] = useState(true);

  // Transactions & Ledger Table
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Credit Injection Form
  const [targetCvu, setTargetCvu] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Ledger detail (Double-Entry audit)
  const [ledgerAudit, setLedgerAudit] = useState<any[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [showLedgerAudit, setShowLedgerAudit] = useState(false);

  // Fetch administrative statistics
  const fetchMetrics = async () => {
    setMetricsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/metrics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error('Error fetching admin metrics:', err);
    } finally {
      setMetricsLoading(false);
    }
  };

  // Fetch system-wide transactions
  const fetchTransactions = async () => {
    setTxLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '6',
        search,
        type: typeFilter,
      });

      const response = await fetch(`${API_URL}/api/admin/transactions?${queryParams}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions);
        setTotalPages(data.pagination.pages);
      }
    } catch (err) {
      console.error('Error fetching admin transactions:', err);
    } finally {
      setTxLoading(false);
    }
  };

  // Fetch Double-entry ledger entries for auditing
  const fetchLedger = async () => {
    setLedgerLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/ledger?limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setLedgerAudit(data.ledger);
      }
    } catch (err) {
      console.error('Error fetching admin ledger:', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [page, search, typeFilter]);

  useEffect(() => {
    if (showLedgerAudit) {
      fetchLedger();
    }
  }, [showLedgerAudit]);

  const handleRefresh = () => {
    fetchMetrics();
    fetchTransactions();
    if (showLedgerAudit) {
      fetchLedger();
    }
  };

  // Handle Administrative Credit Injection
  const handleInjectCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    setFormSuccess('');

    if (!targetCvu || !amount || parseFloat(amount) <= 0) {
      setFormError('CVU/Alias/DNI y monto positivo válidos requeridos.');
      setFormLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/admin/accounts/credit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetUserCvu: targetCvu,
          amount: parseFloat(amount),
          reason: reason || 'Inyección Administrativa',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error al ejecutar crédito.');
      }

      setFormSuccess(`¡Inyección exitosa! Acreditado en cuenta de: ${data.targetUser}`);
      showToast('Ajuste Administrativo Completado', `Se inyectaron $${parseFloat(amount).toLocaleString('es-AR')} a ${data.targetUser}`);
      setTargetCvu('');
      setAmount('');
      setReason('');
      
      // Refresh statistics & logs
      fetchMetrics();
      fetchTransactions();
    } catch (err: any) {
      setFormError(err.message || 'Error de conexión.');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col justify-between overflow-y-auto no-scrollbar p-5 bg-[#0B0B14]">
      {/* View Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="flex items-center gap-1.5">
            <Shield className="w-5 h-5 text-red-500" />
            <h2 className="text-xl font-bold text-white tracking-tight">Consola de Administración</h2>
          </div>
          <p className="text-[10px] text-fintech-neutral font-medium uppercase tracking-wider mt-0.5">
            Auditoría de Partida Doble y Control Contable
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="w-8 h-8 rounded-full bg-slate-800/40 hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-all active:scale-90"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* 1. METRICS HEADER CARDS */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <div className="glass-panel p-3.5 rounded-2xl flex flex-col justify-between border border-white/5 relative overflow-hidden">
          <div className="absolute top-1 right-1 opacity-10">
            <Users className="w-10 h-10 text-fintech-primary" />
          </div>
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Usuarios</span>
          {metricsLoading ? (
            <Loader2 className="w-4.5 h-4.5 text-fintech-primary animate-spin mt-2" />
          ) : (
            <span className="text-md font-extrabold text-white mt-1">
              {metrics.activeUsersCount}
            </span>
          )}
        </div>

        <div className="glass-panel p-3.5 rounded-2xl flex flex-col justify-between border border-white/5 relative overflow-hidden">
          <div className="absolute top-1 right-1 opacity-10">
            <TrendingUp className="w-10 h-10 text-fintech-accent" />
          </div>
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Vol. Global</span>
          {metricsLoading ? (
            <Loader2 className="w-4.5 h-4.5 text-fintech-accent animate-spin mt-2" />
          ) : (
            <span className="text-md font-extrabold text-fintech-accent mt-1 truncate">
              ${metrics.totalVolume.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
            </span>
          )}
        </div>

        <div className="glass-panel p-3.5 rounded-2xl flex flex-col justify-between border border-white/5 relative overflow-hidden">
          <div className="absolute top-1 right-1 opacity-10">
            <Coins className="w-10 h-10 text-indigo-400" />
          </div>
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Emitido Total</span>
          {metricsLoading ? (
            <Loader2 className="w-4.5 h-4.5 text-indigo-400 animate-spin mt-2" />
          ) : (
            <span className="text-md font-extrabold text-indigo-400 mt-1 truncate">
              ${metrics.totalMoneyIssued.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
            </span>
          )}
        </div>
      </div>

      {/* Main Grid: Form and Logs */}
      <div className="space-y-4">
        
        {/* Toggle between transactions log and Ledger Entries */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowLedgerAudit(false)}
            className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
              !showLedgerAudit
                ? 'bg-fintech-primary text-white border-transparent'
                : 'bg-slate-900 text-slate-400 border-white/5'
            }`}
          >
            Monitor de Transacciones
          </button>
          <button
            onClick={() => setShowLedgerAudit(true)}
            className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
              showLedgerAudit
                ? 'bg-fintech-primary text-white border-transparent'
                : 'bg-slate-900 text-slate-400 border-white/5'
            }`}
          >
            Libro Mayor (Doble Entrada)
          </button>
        </div>

        {/* 2A. MONITOR DE TRANSACCIONES */}
        {!showLedgerAudit ? (
          <div className="glass-panel p-4 rounded-2xl border border-white/5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-200 uppercase">Historial General</span>
              
              {/* Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                className="bg-[#181829] border border-white/5 text-[10px] text-slate-400 rounded-lg py-1 px-2 focus:outline-none"
              >
                <option value="">Todos los tipos</option>
                <option value="TRANSFER">Transferencias</option>
                <option value="DEPOSIT">Depósitos</option>
                <option value="QR_PAYMENT">Pago QR</option>
                <option value="ADMIN_ADJUSTMENT">Ajustes Admin</option>
              </select>
            </div>

            {/* Search Box */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-500">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Buscar por DNI, CVU, Alias o Nombre..."
                className="w-full bg-[#181829] border border-white/5 text-white placeholder-slate-500 rounded-xl py-1.5 pl-8 pr-3 text-[10px] focus:outline-none"
              />
            </div>

            {/* Transaction Log Table */}
            <div className="overflow-x-auto min-h-[220px]">
              {txLoading ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 className="w-6 h-6 text-fintech-primary animate-spin" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="flex justify-center items-center h-48 text-slate-600 text-xs italic">
                  No hay transacciones registradas.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="border-b border-white/5 text-slate-500 uppercase tracking-wider font-semibold">
                      <th className="py-2 pr-2">Ref/Fecha</th>
                      <th className="py-2 px-2">Origen → Destino</th>
                      <th className="py-2 px-2 text-right">Monto</th>
                      <th className="py-2 pl-2 text-center font-bold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-white/5 text-slate-300 hover:bg-slate-900/40">
                        <td className="py-2 pr-2">
                          <span className="font-mono text-slate-400 font-bold block">{tx.reference}</span>
                          <span className="text-[8px] text-slate-500">{new Date(tx.createdAt).toLocaleTimeString()}</span>
                        </td>
                        <td className="py-2 px-2 max-w-[120px] truncate">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-200">{tx.sourceAccount}</span>
                            <span className="text-[8px] text-slate-500">→ {tx.destAccount}</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right font-extrabold text-slate-200">
                          ${tx.amount.toLocaleString('es-AR')}
                          <span className="text-[8px] text-slate-500 block uppercase font-normal">{tx.type}</span>
                        </td>
                        <td className="py-2 pl-2 text-center">
                          <span className="px-1.5 py-0.5 rounded-full text-[8px] font-extrabold bg-fintech-accent/15 text-fintech-accent uppercase">
                            ACID
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center pt-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 bg-slate-900 border border-white/5 rounded-lg text-[9px] text-slate-400 disabled:opacity-30"
                >
                  Anterior
                </button>
                <span className="text-[10px] text-slate-500">Pág {page} de {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 bg-slate-900 border border-white/5 rounded-lg text-[9px] text-slate-400 disabled:opacity-30"
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        ) : (
          /* 2B. LIBRO MAYOR (DOBLE ENTRADA AUDITADA) */
          <div className="glass-panel p-4 rounded-2xl border border-white/5 space-y-3">
            <span className="text-xs font-bold text-slate-200 uppercase block">Auditoría del Ledger</span>
            <p className="text-[9px] text-fintech-neutral leading-relaxed">
              Cada transacción del sistema se audita aquí en partida doble (Debits = Credits). Se verifica que el saldo de salida sume 0 al consolidar el libro diario.
            </p>

            <div className="space-y-3.5 max-h-[300px] overflow-y-auto no-scrollbar">
              {ledgerLoading ? (
                <div className="flex justify-center items-center h-48">
                  <Loader2 className="w-6 h-6 text-fintech-primary animate-spin" />
                </div>
              ) : ledgerAudit.length === 0 ? (
                <div className="text-center py-10 text-slate-500 italic text-[11px]">
                  No hay asientos contables.
                </div>
              ) : (
                ledgerAudit.map((journal) => (
                  <div key={journal.journalId} className="bg-[#121223] border border-white/5 rounded-xl p-3 space-y-2">
                    <div className="flex justify-between items-center text-[9px] text-slate-500">
                      <span className="font-bold font-mono text-slate-300">{journal.reference}</span>
                      <span>{new Date(journal.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-white/5 pb-1">
                      <span className="text-[10px] text-slate-200 font-semibold truncate max-w-[170px]">
                        {journal.description}
                      </span>
                      <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${
                        journal.audit.balanced ? 'bg-fintech-accent/15 text-fintech-accent' : 'bg-red-500/15 text-red-500'
                      }`}>
                        {journal.audit.balanced ? 'CUADRADO (0)' : 'DESCUADRADO'}
                      </span>
                    </div>

                    {/* Double Entry Pairs */}
                    <div className="space-y-1">
                      {journal.entries.map((entry: any) => (
                        <div key={entry.id} className="flex justify-between items-center text-[9px] text-slate-400 font-mono">
                          <span className="truncate max-w-[160px]">{entry.accountName}</span>
                          <div className="flex gap-2.5">
                            <span className={entry.type === 'DEBIT' ? 'text-fintech-primary font-bold' : 'text-slate-600'}>
                              {entry.type === 'DEBIT' ? `D: $${entry.amount.toLocaleString('es-AR')}` : '-'}
                            </span>
                            <span className={entry.type === 'CREDIT' ? 'text-indigo-400 font-bold' : 'text-slate-600'}>
                              {entry.type === 'CREDIT' ? `C: $${entry.amount.toLocaleString('es-AR')}` : '-'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 3. CREDIT INJECTION FORM */}
        <div className="glass-panel p-4 rounded-2xl border border-white/5 space-y-3.5">
          <div className="flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-fintech-primary" />
            <span className="text-xs font-bold text-slate-200 uppercase">Inyección de Crédito Contable</span>
          </div>

          <form onSubmit={handleInjectCredit} className="space-y-3">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 mb-1">Destinatario (CVU, Alias o DNI)</label>
              <input
                type="text"
                required
                placeholder="Ej. usuario.prueba.fintech o 12345678"
                value={targetCvu}
                onChange={(e) => setTargetCvu(e.target.value)}
                className="w-full bg-[#181829] border border-white/5 text-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-fintech-primary/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">Monto (ARS)</label>
                <input
                  type="number"
                  required
                  placeholder="Monto a acreditar"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#181829] border border-white/5 text-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-fintech-primary/50"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">Concepto/Motivo</label>
                <input
                  type="text"
                  placeholder="Ej. Bonificación"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-[#181829] border border-white/5 text-white rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-fintech-primary/50"
                />
              </div>
            </div>

            {formError && (
              <div className="bg-red-950/20 border border-red-500/10 text-red-400 text-[10px] rounded-xl p-2.5">
                {formError}
              </div>
            )}

            {formSuccess && (
              <div className="bg-fintech-accent/15 border border-fintech-accent/10 text-fintech-accent text-[10px] rounded-xl p-2.5 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={formLoading}
              className="w-full h-10 bg-fintech-primary hover:bg-fintech-primaryHover disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md shadow-fintech-primary/10"
            >
              {formLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Proceder con Ajuste Contable</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
