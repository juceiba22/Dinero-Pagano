import React, { useState, useEffect } from 'react';
import { Search, ArrowLeft, AlertCircle, CheckCircle2, XCircle, Share2, Wallet, ArrowRight, Loader2 } from 'lucide-react';
import { CustomKeyboard } from '../components/CustomKeyboard';

interface TransferViewProps {
  userBalance: string;
  onNavigate: (tab: string) => void;
  wsMessage: any; // Last WS message to listen for completion
  clearWSMessage: () => void;
  token: string;
}

type Step = 'DESTINATION' | 'AMOUNT' | 'CONFIRMATION' | 'PROCESSING' | 'RECEIPT';

export const TransferView: React.FC<TransferViewProps> = ({
  userBalance,
  onNavigate,
  wsMessage,
  clearWSMessage,
  token,
}) => {
  const [step, setStep] = useState<Step>('DESTINATION');
  const [identifier, setIdentifier] = useState('');
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [error, setError] = useState('');

  // Target Account Details (populated after lookup)
  const [targetAccount, setTargetAccount] = useState<{
    accountId: string;
    name: string;
    cvu: string;
    alias: string;
  } | null>(null);

  // Amount Details
  const [amount, setAmount] = useState('0');

  // Transaction Receipt Details (populated from WS or API)
  const [receipt, setReceipt] = useState<{
    reference: string;
    amount: number;
    partyName: string;
    createdAt: string;
    status: 'COMPLETED' | 'FAILED';
    error?: string;
  } | null>(null);

  // Listen to WebSocket messages
  useEffect(() => {
    if (!wsMessage || step !== 'PROCESSING') return;

    if (wsMessage.type === 'transfer_completed') {
      setReceipt({
        reference: wsMessage.reference,
        amount: wsMessage.amount,
        partyName: wsMessage.partyName,
        createdAt: wsMessage.createdAt,
        status: 'COMPLETED',
      });
      setStep('RECEIPT');
      clearWSMessage();
    } else if (wsMessage.type === 'transfer_failed') {
      setReceipt({
        reference: 'N/A',
        amount: parseFloat(amount),
        partyName: targetAccount?.name || 'Destinatario',
        createdAt: new Date().toISOString(),
        status: 'FAILED',
        error: wsMessage.error || 'Error al procesar la transferencia.',
      });
      setStep('RECEIPT');
      clearWSMessage();
    }
  }, [wsMessage, step, amount, targetAccount, clearWSMessage]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;

    setError('');
    setLoadingLookup(true);

    try {
      const response = await fetch(`/api/account/lookup?identifier=${encodeURIComponent(identifier.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo validar el destinatario.');
      }

      setTargetAccount(data);
      setStep('AMOUNT');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingLookup(false);
    }
  };

  const handleStartTransfer = async () => {
    if (!targetAccount) return;
    setError('');
    setStep('PROCESSING');

    try {
      const response = await fetch('/api/transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetIdentifier: targetAccount.cvu,
          amount: parseFloat(amount),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al iniciar la transferencia.');
      }
      // Wait for WS confirmation in processing state...
    } catch (err: any) {
      setReceipt({
        reference: 'ERROR',
        amount: parseFloat(amount),
        partyName: targetAccount.name,
        createdAt: new Date().toISOString(),
        status: 'FAILED',
        error: err.message,
      });
      setStep('RECEIPT');
    }
  };

  const handleBack = () => {
    if (step === 'AMOUNT') {
      setStep('DESTINATION');
    } else if (step === 'CONFIRMATION') {
      setStep('AMOUNT');
    }
  };

  const formatCurrency = (val: any) => {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2,
    });
  };

  const handleQuickAmount = (val: string) => {
    setAmount(val);
  };

  // Check if balance is exceeded
  const isInsufficient = parseFloat(amount) > parseFloat(userBalance);
  const isValidAmount = parseFloat(amount) > 0 && !isInsufficient;

  return (
    <div className="flex flex-col h-full bg-[#0B0B14] justify-between">
      {/* Header (unless processing or receipt) */}
      {step !== 'PROCESSING' && step !== 'RECEIPT' && (
        <div className="flex items-center px-4 py-4 border-b border-white/5 bg-[#0F0F1D]/50">
          <button
            onClick={step === 'DESTINATION' ? () => onNavigate('home') : handleBack}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-white ml-4">
            {step === 'DESTINATION' && 'Transferir'}
            {step === 'AMOUNT' && 'Monto a Transferir'}
            {step === 'CONFIRMATION' && 'Revisar Transferencia'}
          </span>
        </div>
      )}

      {/* STEP 1: DESTINATION LOOKUP */}
      {step === 'DESTINATION' && (
        <div className="flex-1 p-5 flex flex-col justify-between">
          <div className="space-y-4 mt-2">
            <div className="bg-[#121222] border border-white/5 rounded-2xl p-4 flex items-start gap-3">
              <Wallet className="w-5 h-5 text-indigo-400 mt-0.5" />
              <div>
                <span className="text-[10px] text-fintech-neutral uppercase block">Tu saldo actual</span>
                <span className="font-bold text-sm text-slate-200">{formatCurrency(userBalance)}</span>
              </div>
            </div>

            <form onSubmit={handleLookup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  CVU o Alias del destinatario
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Ej. juan.perez.pago o 00000079..."
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full bg-[#181829] border border-white/5 focus:border-fintech-primary/50 text-white rounded-xl py-3 pl-4 pr-12 text-sm focus:outline-none transition-all"
                  />
                  <button
                    type="submit"
                    disabled={loadingLookup || !identifier.trim()}
                    className="absolute inset-y-1.5 right-1.5 w-9 h-9 bg-fintech-primary hover:bg-fintech-primaryHover text-white rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
                  >
                    {loadingLookup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </form>

            {error && (
              <div className="bg-red-900/30 border border-red-500/30 text-red-300 text-xs rounded-xl p-3 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="bg-[#121222] border border-white/5 rounded-2xl p-4">
            <h4 className="text-[11px] font-bold text-fintech-neutral mb-2 uppercase tracking-wider">
              Destinatarios de prueba (Semilla)
            </h4>
            <div className="space-y-2 text-xs">
              <button
                onClick={() => { setIdentifier('juan.perez.pago'); setError(''); }}
                className="w-full text-left p-2 hover:bg-slate-800/40 rounded-lg flex justify-between items-center text-slate-300 border border-transparent hover:border-white/5"
              >
                <div>
                  <span className="font-semibold block text-white">Juan Pérez</span>
                  <span className="text-[10px] text-slate-500">juan.perez.pago</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
              </button>
              <button
                onClick={() => { setIdentifier('maria.rodriguez.efectivo'); setError(''); }}
                className="w-full text-left p-2 hover:bg-slate-800/40 rounded-lg flex justify-between items-center text-slate-300 border border-transparent hover:border-white/5"
              >
                <div>
                  <span className="font-semibold block text-white">María Rodríguez</span>
                  <span className="text-[10px] text-slate-500">maria.rodriguez.efectivo</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: AMOUNT INPUT WITH CUSTOM KEYBOARD */}
      {step === 'AMOUNT' && targetAccount && (
        <div className="flex-1 flex flex-col justify-between">
          <div className="p-5 flex-1 flex flex-col justify-center items-center">
            {/* Target Display */}
            <span className="text-xs text-fintech-neutral">Transferir a</span>
            <span className="font-bold text-white text-lg mt-0.5">{targetAccount.name}</span>
            <span className="text-[10px] text-slate-500 mt-0.5">Alias: {targetAccount.alias}</span>

            {/* Huge Amount Input */}
            <div className="mt-6 flex flex-col items-center">
              <div className="text-3xl font-extrabold text-white font-sans flex items-baseline select-none">
                <span className="text-fintech-primary mr-1">$</span>
                <span>{parseFloat(amount).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</span>
                {amount.includes('.') && (
                  <span className="text-slate-400 text-xl">.{amount.split('.')[1]}</span>
                )}
              </div>

              {isInsufficient ? (
                <div className="text-fintech-danger text-[11px] font-semibold mt-2.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Saldo insuficiente ({formatCurrency(userBalance)})
                </div>
              ) : (
                <span className="text-[10px] text-fintech-neutral mt-2">
                  Saldo disponible: {formatCurrency(userBalance)}
                </span>
              )}
            </div>

            {/* Quick amounts helper */}
            <div className="flex gap-2.5 mt-8 w-full max-w-[280px]">
              {['500', '1000', '5000'].map((val) => (
                <button
                  key={val}
                  onClick={() => handleQuickAmount(val)}
                  className="flex-1 py-1.5 bg-[#181829] border border-white/5 hover:border-indigo-500/30 text-white rounded-xl text-xs font-semibold transition-all active:scale-95"
                >
                  +{formatCurrency(val).replace(',00', '')}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#0F0F1D]/80 pt-4 pb-6 border-t border-white/5 flex flex-col items-center gap-3">
            <CustomKeyboard value={amount} onChange={setAmount} />
            <button
              onClick={() => setStep('CONFIRMATION')}
              disabled={!isValidAmount}
              className="w-[85%] h-11 bg-fintech-primary hover:bg-fintech-primaryHover text-white rounded-xl font-medium text-sm flex items-center justify-center gap-1 transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-95 shadow-lg shadow-fintech-primary/15"
            >
              Continuar
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: TRANSACTION REVIEW / CONFIRMATION */}
      {step === 'CONFIRMATION' && targetAccount && (
        <div className="flex-1 p-5 flex flex-col justify-between">
          <div className="space-y-4 mt-2">
            <div className="bg-[#121222] border border-white/5 rounded-3xl p-5 space-y-4">
              <div className="text-center pb-4 border-b border-white/5">
                <span className="text-xs text-fintech-neutral block">Monto a Transferir</span>
                <span className="text-3xl font-extrabold text-white mt-1 block">
                  {formatCurrency(amount)}
                </span>
              </div>

              <div className="space-y-3.5">
                <div>
                  <span className="text-[10px] text-fintech-neutral uppercase block">Destinatario</span>
                  <span className="text-xs font-bold text-white block mt-0.5">{targetAccount.name}</span>
                </div>

                <div>
                  <span className="text-[10px] text-fintech-neutral uppercase block">CVU</span>
                  <span className="text-xs font-medium text-slate-300 block mt-0.5 tracking-wider">
                    {targetAccount.cvu}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-fintech-neutral uppercase block">Alias</span>
                  <span className="text-xs font-semibold text-slate-300 block mt-0.5">
                    {targetAccount.alias}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-fintech-neutral uppercase block">Moneda</span>
                  <span className="text-xs font-semibold text-slate-300 block mt-0.5">
                    Pesos Argentinos (ARS)
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#1E1212]/30 border border-red-500/10 rounded-2xl p-4 flex gap-3 text-[10px] text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>
                Esta transferencia simula un proceso fintech real en partida doble ACID. Al confirmar, el backend esperará 2.5s y debitará el saldo con validación de concurrencia.
              </span>
            </div>
          </div>

          <button
            onClick={handleStartTransfer}
            className="w-full h-12 shimmer-bg text-white rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-1 transition-all active:scale-95 shadow-lg shadow-fintech-primary/20 mt-4"
          >
            CONFIRMAR TRANSFERENCIA
          </button>
        </div>
      )}

      {/* STEP 4: PROCESSING LOADING ANIMATION */}
      {step === 'PROCESSING' && (
        <div className="flex-1 p-5 flex flex-col justify-center items-center text-center bg-[#0B0B14]">
          <div className="relative mb-6">
            {/* Pulsing ring outline */}
            <div className="absolute inset-[-10px] rounded-full ring-4 ring-fintech-primary/30 animate-ping"></div>
            <div className="w-20 h-20 rounded-full bg-slate-900/80 border border-fintech-primary/30 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-fintech-primary animate-spin" />
            </div>
          </div>

          <h3 className="text-lg font-bold text-white tracking-tight">Procesando Transferencia</h3>
          <p className="text-xs text-fintech-neutral max-w-[200px] mt-2 leading-relaxed">
            Validando integridad contable y firmando el balance de partida doble...
          </p>

          <div className="w-40 bg-slate-800 h-1 rounded-full overflow-hidden mt-6">
            <div className="bg-fintech-primary h-full rounded-full animate-[shimmery_2s_infinite_linear] w-[70%]"></div>
          </div>

          <span className="text-[10px] text-fintech-warning font-semibold uppercase tracking-wider mt-4">
            Demora simulada de 2.5 segundos
          </span>
        </div>
      )}

      {/* STEP 5: RECEIPT / COMPROBANTE DE TRANSFERENCIA */}
      {step === 'RECEIPT' && receipt && (
        <div className="flex-1 p-5 flex flex-col justify-between overflow-y-auto no-scrollbar">
          <div className="space-y-5 mt-4 text-center">
            {receipt.status === 'COMPLETED' ? (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-fintech-accent/15 border border-fintech-accent/30 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-9 h-9 text-fintech-accent" />
                </div>
                <h3 className="text-lg font-bold text-white">¡Transferencia exitosa!</h3>
                <p className="text-xs text-fintech-neutral mt-0.5">El comprobante ha sido generado.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-fintech-danger/15 border border-fintech-danger/30 flex items-center justify-center mb-3">
                  <XCircle className="w-9 h-9 text-fintech-danger" />
                </div>
                <h3 className="text-lg font-bold text-white">Transferencia Fallida</h3>
                <p className="text-xs text-fintech-danger font-medium mt-1">
                  Motivo: {receipt.error || 'Fallo general en base de datos.'}
                </p>
              </div>
            )}

            {/* Styled Ticket */}
            <div className="bg-[#151525] border border-white/5 rounded-3xl p-5 space-y-4 text-left shadow-lg relative">
              {/* Ticket cutouts on the sides */}
              <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-[#0B0B14] rounded-full border-r border-white/5"></div>
              <div className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-[#0B0B14] rounded-full border-l border-white/5"></div>

              <div className="pb-3.5 border-b border-dashed border-slate-800 flex justify-between items-end">
                <div>
                  <span className="text-[10px] text-fintech-neutral uppercase block">Monto enviado</span>
                  <span className="text-2xl font-extrabold text-white mt-0.5 block">
                    {formatCurrency(receipt.amount)}
                  </span>
                </div>
                <Share2 className="w-4 h-4 text-slate-400 cursor-pointer hover:text-white transition-colors" />
              </div>

              <div className="grid grid-cols-2 gap-y-3.5 text-[11px]">
                <div>
                  <span className="text-slate-500 uppercase block">Destinatario</span>
                  <span className="font-semibold text-slate-200 block mt-0.5">{receipt.partyName}</span>
                </div>
                <div>
                  <span className="text-slate-500 uppercase block">Referencia Ledger</span>
                  <span className="font-semibold text-slate-200 block mt-0.5 truncate tracking-wider">
                    {receipt.reference}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 uppercase block">Fecha y Hora</span>
                  <span className="font-semibold text-slate-200 block mt-0.5">
                    {new Date(receipt.createdAt).toLocaleString('es-AR')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 uppercase block">Estado</span>
                  <span className={`font-bold block mt-0.5 ${
                    receipt.status === 'COMPLETED' ? 'text-fintech-accent' : 'text-fintech-danger'
                  }`}>
                    {receipt.status === 'COMPLETED' ? 'COMPLETADO' : 'FALLIDO'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2">
            {receipt.status === 'COMPLETED' ? (
              <button
                onClick={() => onNavigate('home')}
                className="w-full h-11 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium text-xs transition-all active:scale-95 border border-white/5"
              >
                Volver al Inicio
              </button>
            ) : (
              <button
                onClick={() => {
                  setStep('DESTINATION');
                  setAmount('0');
                  setTargetAccount(null);
                  setError('');
                }}
                className="w-full h-11 bg-fintech-primary hover:bg-fintech-primaryHover text-white rounded-xl font-medium text-xs transition-all active:scale-95"
              >
                Volver a Intentar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
