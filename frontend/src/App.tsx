import React, { useState, useEffect, useRef } from 'react';
import { Home, ArrowUpRight, History, User, Battery, Wifi, Bell, Smartphone, ShieldCheck, QrCode, Plus, X, Sparkles, Send, Loader2 } from 'lucide-react';
import { LoginView } from './views/LoginView';
import { HomeView } from './views/HomeView';
import { TransferView } from './views/TransferView';
import { HistoryView } from './views/HistoryView';
import { ProfileView } from './views/ProfileView';
import { API_URL } from './config';

interface Toast {
  id: string;
  title: string;
  message: string;
}

export default function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem('token') || '');
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [account, setAccount] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Navigation
  const [activeTab, setActiveTab] = useState<string>('home');

  // Modals & Overlays inside the Phone
  const [qrOpen, setQrOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('1000');
  const [processingAction, setProcessingAction] = useState(false);
  const [modalError, setModalError] = useState('');

  // WebSockets and Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastWSMessage, setLastWSMessage] = useState<any>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Simulator Panel (outside phone)
  const [simAmount, setSimAmount] = useState('2500');
  const [simSender, setSimSender] = useState('Carlos Gómez (Simulado)');
  const [simLoading, setSimLoading] = useState(false);
  const [simLogs, setSimLogs] = useState<string[]>([]);

  // Fetch account and transaction data
  const fetchData = async () => {
    if (!token) return;
    try {
      // 1. Get current account
      const accRes = await fetch(`${API_URL}/api/account/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (accRes.ok) {
        const accData = await accRes.json();
        setAccount(accData);
      }

      // 2. Get transaction history
      const txRes = await fetch(`${API_URL}/api/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(txData);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  // Re-run fetchData whenever token or active tab changes
  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, activeTab]);

  // Connect WebSocket when token/user is available
  useEffect(() => {
    if (!token || !user) {
      if (wsRef.current) {
        wsRef.current.close();
      }
      return;
    }

    const WS_URL = API_URL
      .replace("https://", "wss://")
      .replace("http://", "ws://");
    console.log(`[WS] Conectando a ${WS_URL}...`);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Conectado con éxito.');
      setWsConnected(true);
      // Register this client to receive targeted notifications
      ws.send(JSON.stringify({ type: 'register', userId: user.id }));
      addLog('Conexión WebSocket establecida y registrada.');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WS] Mensaje recibido:', data);
        addLog(`Recibido evento: ${data.type}`);

        // Route general updates
        if (data.type === 'push_notification') {
          showToast(data.title, data.message);
        } else if (data.type === 'balance_updated') {
          fetchData();
        }

        // Pass details down to transaction views
        setLastWSMessage(data);
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Desconectado.');
      setWsConnected(false);
      addLog('WebSocket cerrado. Reconectando en 5s...');
      // Reconnect after 5 seconds
      setTimeout(() => {
        if (token && user) {
          // Trigger effect reload
          setToken((t) => t);
        }
      }, 5000);
    };

    return () => {
      ws.close();
    };
  }, [token, user]);

  const addLog = (log: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setSimLogs((prev) => [`[${timestamp}] ${log}`, ...prev.slice(0, 15)]);
  };

  const showToast = (title: string, message: string) => {
    const id = Math.random().toString();
    setToasts((prev) => [...prev, { id, title, message }]);
    
    // Auto dismiss after 4.5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const handleLoginSuccess = (token: string, userData: any, accountData: any) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(token);
    setUser(userData);
    setAccount(accountData);
    setActiveTab('home');
    addLog(`Usuario ${userData.name} inició sesión.`);
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken('');
    setUser(null);
    setAccount(null);
    setTransactions([]);
    if (wsRef.current) wsRef.current.close();
    addLog('Sesión cerrada.');
  };

  // Perform Simulated Deposit
  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    setProcessingAction(true);
    setModalError('');
    try {
      const response = await fetch(`${API_URL}/api/deposits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: parseFloat(depositAmount) }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setDepositOpen(false);
      showToast('Carga de dinero exitosa', `Se ingresaron $${parseFloat(depositAmount).toLocaleString('es-AR')} a tu cuenta.`);
      fetchData();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setProcessingAction(false);
    }
  };

  // Perform QR Payment
  const handleQRPayment = async (merchantAlias: string, amount: number) => {
    setProcessingAction(true);
    setModalError('');
    try {
      const response = await fetch(`${API_URL}/api/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ merchantAlias, amount }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setQrOpen(false);
      showToast('Pago QR Exitoso', `Pagaste $${amount.toLocaleString('es-AR')} a ${merchantAlias === 'CAFE.MARTINEZ.QR' ? 'Café Martínez' : merchantAlias}`);
      fetchData();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setProcessingAction(false);
    }
  };

  // Trigger simulated incoming transfer (Side Panel action)
  const triggerIncomingSimulation = async () => {
    if (simLoading || !token) return;
    setSimLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/simulator/incoming-transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: parseFloat(simAmount),
          senderName: simSender,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      addLog(`Simulación exitosa: +$${simAmount} desde ${simSender}`);
    } catch (err: any) {
      addLog(`Error en simulación: ${err.message}`);
    } finally {
      setSimLoading(false);
    }
  };

  // Quick switch user (Side panel shortcut)
  const handleQuickSwitch = async (email: string) => {
    handleLogout();
    setSimLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'password123' }),
      });
      const data = await response.json();
      if (response.ok) {
        handleLoginSuccess(data.token, data.user, data.account);
      }
    } catch (e: any) {
      addLog(`Error en quick switch: ${e.message}`);
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070710] py-6 px-4 flex flex-col xl:flex-row justify-center items-center gap-10 overflow-x-hidden">
      
      {/* LEFT PANEL: EDUCATIONAL CONTROL SIMULATOR (Side panel outside mobile container) */}
      <div className="w-full max-w-md bg-[#0D0D1E] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-5 shrink-0 xl:self-start xl:mt-8">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-fintech-warning" />
            <h2 className="text-md font-extrabold text-white tracking-tight uppercase">
              Consola del Simulador
            </h2>
          </div>
          <p className="text-[11px] text-fintech-neutral mt-1">
            Esta consola simula eventos externos a la app (como pasarelas de pago o transferencias bancarias ACH) para demostrar la partida doble y notificaciones WebSocket en tiempo real.
          </p>
        </div>

        {token ? (
          <div className="space-y-4">
            {/* Action 1: Simulator Incoming Transfer */}
            <div className="bg-[#121226] border border-white/5 rounded-2xl p-4 space-y-3">
              <span className="text-xs font-bold text-slate-200 block">
                💸 Simular Transferencia Entrante
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-slate-500 uppercase block">Monto (ARS)</label>
                  <input
                    type="number"
                    value={simAmount}
                    onChange={(e) => setSimAmount(e.target.value)}
                    className="w-full bg-[#18182E] border border-white/5 text-white rounded-lg p-2 text-xs focus:outline-none focus:border-fintech-primary/50"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-slate-500 uppercase block">Remitente</label>
                  <input
                    type="text"
                    value={simSender}
                    onChange={(e) => setSimSender(e.target.value)}
                    className="w-full bg-[#18182E] border border-white/5 text-white rounded-lg p-2 text-xs focus:outline-none focus:border-fintech-primary/50"
                  />
                </div>
              </div>
              <button
                onClick={triggerIncomingSimulation}
                disabled={simLoading}
                className="w-full h-9 bg-fintech-primary hover:bg-fintech-primaryHover text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1 transition-all disabled:opacity-50"
              >
                {simLoading ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : 'Disparar Transferencia Externa'}
              </button>
            </div>

            {/* Quick Switch User */}
            <div className="bg-[#121226] border border-white/5 rounded-2xl p-4 space-y-2">
              <span className="text-xs font-bold text-slate-200 block">
                👥 Conmutador Rápido de Cuenta
              </span>
              <p className="text-[9px] text-fintech-neutral">
                Alterna entre terminales para probar transferencias en vivo. Loguearse como Juan y transferir al CVU de test activará instantáneamente un push toast en la app del test user.
              </p>
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  onClick={() => handleQuickSwitch('test@wallet.com')}
                  disabled={user?.email === 'test@wallet.com' || simLoading}
                  className={`py-1.5 rounded-lg text-[9px] font-bold border transition-all ${
                    user?.email === 'test@wallet.com'
                      ? 'bg-fintech-primary text-white border-transparent'
                      : 'bg-[#18182E] text-slate-400 border-white/5 hover:bg-slate-800'
                  }`}
                >
                  Test User
                </button>
                <button
                  onClick={() => handleQuickSwitch('juan@perez.com')}
                  disabled={user?.email === 'juan@perez.com' || simLoading}
                  className={`py-1.5 rounded-lg text-[9px] font-bold border transition-all ${
                    user?.email === 'juan@perez.com'
                      ? 'bg-fintech-primary text-white border-transparent'
                      : 'bg-[#18182E] text-slate-400 border-white/5 hover:bg-slate-800'
                  }`}
                >
                  Juan
                </button>
                <button
                  onClick={() => handleQuickSwitch('maria@rodriguez.com')}
                  disabled={user?.email === 'maria@rodriguez.com' || simLoading}
                  className={`py-1.5 rounded-lg text-[9px] font-bold border transition-all ${
                    user?.email === 'maria@rodriguez.com'
                      ? 'bg-fintech-primary text-white border-transparent'
                      : 'bg-[#18182E] text-slate-400 border-white/5 hover:bg-slate-800'
                  }`}
                >
                  María
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#121226]/50 border border-dashed border-white/5 rounded-2xl p-6 text-center text-xs text-slate-500">
            Inicie sesión en el teléfono de la derecha para habilitar la consola de simulación interactiva.
          </div>
        )}

        {/* Live WS Logs */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-300">Monitoreo de Eventos (WS):</span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
              wsConnected ? 'bg-fintech-accent/15 text-fintech-accent' : 'bg-fintech-danger/15 text-fintech-danger'
            }`}>
              {wsConnected ? 'CONECTADO' : 'DESCONECTADO'}
            </span>
          </div>
          <div className="bg-slate-950 rounded-xl p-3 h-32 overflow-y-auto no-scrollbar font-mono text-[9px] text-slate-400 border border-white/5 space-y-1">
            {simLogs.length === 0 ? (
              <span className="text-slate-600 block italic">Esperando eventos de red...</span>
            ) : (
              simLogs.map((log, idx) => (
                <div key={idx} className="leading-relaxed whitespace-pre-wrap">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* CENTER / RIGHT: SMARTPHONE DEVICE MOCK CONTAINER (Strictly Mobile-Only max-w-md) */}
      <div className="w-full max-w-sm h-[780px] bg-black rounded-[52px] p-3 shadow-2xl border-[11px] border-slate-900 ring-4 ring-slate-800/60 relative overflow-hidden flex flex-col justify-between select-none">
        
        {/* PHYSICAL SMARTPHONE DETAILS */}
        {/* Notch / Speaker block */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-b-2xl z-50 flex items-center justify-center">
          <div className="w-12 h-1 bg-slate-900 rounded-full mb-1"></div>
        </div>

        {/* DEVICE STATUS BAR */}
        <div className="h-10 px-6 pt-2 pb-1 bg-[#0B0B14] flex justify-between items-center text-[10px] text-slate-400 font-semibold z-45 select-none select-none">
          <span>11:40</span>
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3 text-slate-400" />
            <Battery className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>

        {/* MOBILE VIEWPORT CORE VIEWPORT */}
        <div className="flex-1 bg-[#0B0B14] relative overflow-hidden flex flex-col justify-between">
          
          {/* IN-APP TOAST NOTIFICATION BOX (Simulated Push Alerts) */}
          <div className="absolute top-2.5 inset-x-3 z-50 pointer-events-none space-y-2">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className="w-full glass-panel rounded-2xl p-3.5 flex items-start gap-3 shadow-2xl pointer-events-auto border-l-4 border-l-fintech-primary animate-[slideDown_0.2s_ease-out] relative"
              >
                <div className="w-8 h-8 rounded-xl bg-fintech-primary/10 flex items-center justify-center text-fintech-primary shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 pr-4">
                  <h4 className="text-xs font-bold text-white tracking-tight">{toast.title}</h4>
                  <p className="text-[10px] text-slate-300 mt-0.5 leading-normal">{toast.message}</p>
                </div>
                <button
                  onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                  className="absolute top-2.5 right-2.5 text-slate-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* VIEW CONTROLLER OR LOGIN IF NO TOKEN */}
          {!token ? (
            <LoginView onLoginSuccess={handleLoginSuccess} />
          ) : (
            <div className="flex-1 flex flex-col justify-between h-full overflow-hidden">
              <div className="flex-1 overflow-hidden">
                {activeTab === 'home' && (
                  <HomeView
                    account={account}
                    transactions={transactions}
                    onNavigate={setActiveTab}
                    onOpenDeposit={() => { setDepositAmount('1000'); setDepositOpen(true); }}
                    onOpenQR={() => setQrOpen(true)}
                  />
                )}
                {activeTab === 'transfer' && (
                  <TransferView
                    userBalance={account?.balance || '0'}
                    onNavigate={setActiveTab}
                    wsMessage={lastWSMessage}
                    clearWSMessage={() => setLastWSMessage(null)}
                    token={token}
                  />
                )}
                {activeTab === 'history' && <HistoryView transactions={transactions} />}
                {activeTab === 'profile' && <ProfileView account={account} onLogout={handleLogout} />}
              </div>

              {/* BOTTOM TAB NAVIGATION BAR */}
              <div className="h-16 border-t border-white/5 bg-[#0F0F1D]/80 flex justify-around items-center px-4 shrink-0">
                <button
                  onClick={() => setActiveTab('home')}
                  className={`flex flex-col items-center justify-center w-12 h-12 transition-all ${
                    activeTab === 'home' ? 'text-fintech-primary' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Home className="w-5 h-5" />
                  <span className="text-[9px] font-bold mt-1">Inicio</span>
                </button>

                <button
                  onClick={() => setActiveTab('transfer')}
                  className={`flex flex-col items-center justify-center w-12 h-12 transition-all ${
                    activeTab === 'transfer' ? 'text-fintech-primary' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <ArrowUpRight className="w-5 h-5" />
                  <span className="text-[9px] font-bold mt-1">Transferir</span>
                </button>

                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex flex-col items-center justify-center w-12 h-12 transition-all ${
                    activeTab === 'history' ? 'text-fintech-primary' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <History className="w-5 h-5" />
                  <span className="text-[9px] font-bold mt-1">Actividad</span>
                </button>

                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex flex-col items-center justify-center w-12 h-12 transition-all ${
                    activeTab === 'profile' ? 'text-fintech-primary' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <User className="w-5 h-5" />
                  <span className="text-[9px] font-bold mt-1">Perfil</span>
                </button>
              </div>
            </div>
          )}

          {/* SIMULATED QR CODE SCANNER OVERLAY */}
          {qrOpen && (
            <div className="absolute inset-0 bg-[#000000FA] z-50 flex flex-col justify-between p-5 text-center">
              <div className="flex justify-between items-center text-white mt-4 shrink-0">
                <span className="font-bold text-sm">Escanear Pago QR</span>
                <button
                  onClick={() => { setQrOpen(false); setModalError(''); }}
                  className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Viewfinder Mock */}
              <div className="relative w-56 h-56 border-2 border-dashed border-fintech-accent/40 rounded-3xl mx-auto flex flex-col items-center justify-center bg-slate-900/20 my-auto">
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-fintech-accent"></div>
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-fintech-accent"></div>
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-fintech-accent"></div>
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-fintech-accent"></div>
                <QrCode className="w-14 h-14 text-fintech-accent/30 animate-pulse" />
              </div>

              <div className="space-y-3 pb-8 shrink-0">
                <p className="text-xs text-slate-400">
                  Seleccione un QR simulado para realizar un pago instantáneo:
                </p>

                {modalError && (
                  <p className="text-[10px] text-fintech-danger bg-red-950/20 border border-red-500/10 rounded-xl p-2.5">
                    {modalError}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => handleQRPayment('CAFE.MARTINEZ.QR', 850)}
                    disabled={processingAction}
                    className="p-3 bg-[#121226] border border-white/5 text-slate-200 rounded-2xl hover:border-fintech-accent/30 transition-all flex flex-col items-center active:scale-95 disabled:opacity-50"
                  >
                    <span className="font-bold text-white">Café Martínez</span>
                    <span className="text-[10px] text-fintech-accent mt-0.5">$850</span>
                  </button>
                  <button
                    onClick={() => handleQRPayment('CAFE.MARTINEZ.QR', 2300)}
                    disabled={processingAction}
                    className="p-3 bg-[#121226] border border-white/5 text-slate-200 rounded-2xl hover:border-fintech-accent/30 transition-all flex flex-col items-center active:scale-95 disabled:opacity-50"
                  >
                    <span className="font-bold text-white">Pago General</span>
                    <span className="text-[10px] text-fintech-accent mt-0.5">$2.300</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SIMULATED DEPOSIT MODAL OVERLAY */}
          {depositOpen && (
            <div className="absolute inset-0 bg-[#05050AC0] backdrop-blur-sm z-50 flex items-end justify-center p-4">
              <div className="w-full bg-[#121222] border border-white/10 rounded-t-3xl rounded-b-2xl p-5 shadow-2xl space-y-4">
                <div className="flex justify-between items-center pb-2.5 border-b border-white/5">
                  <span className="text-xs font-bold text-white">Ingresar Dinero a la Cuenta</span>
                  <button
                    onClick={() => { setDepositOpen(false); setModalError(''); }}
                    className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-750 flex items-center justify-center text-slate-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] text-fintech-neutral leading-relaxed">
                    Esta operación simula una transferencia de recaudación externa (DEPOSIT). El ledger registrará un Débito en el Activo de la Fintech y un Crédito en el Pasivo de tu cuenta.
                  </p>

                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase mb-1 font-semibold">
                      Monto a Cargar (ARS)
                    </label>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="w-full bg-[#181829] border border-white/5 text-white rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>

                  {modalError && (
                    <p className="text-[10px] text-fintech-danger bg-red-950/20 border border-red-500/10 rounded-xl p-2">
                      {modalError}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleDeposit}
                  disabled={processingAction || !depositAmount || parseFloat(depositAmount) <= 0}
                  className="w-full h-11 bg-fintech-primary hover:bg-fintech-primaryHover text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                >
                  {processingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Realizar Carga'}
                </button>
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM VIRTUAL PHONE HOME BAR INDICATOR */}
        <div className="h-6 w-full flex items-center justify-center bg-[#0B0B14] shrink-0">
          <div className="w-32 h-1 bg-slate-700/60 rounded-full mb-1"></div>
        </div>

      </div>

    </div>
  );
}
