import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './db';
import { authenticateToken, AuthenticatedRequest } from './middleware/auth';
import { LedgerService } from './services/ledgerService';
import { Decimal } from '@prisma/client/runtime/library';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'wallet-super-secret-key-educational-123!';

app.use(cors({
  origin: [
    'https://dinero-pagano.vercel.app',
    'http://localhost:5173', 
    'http://127.0.0.1:5173',
    'https://localhost',
    'capacitor://localhost'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// --- WEBSOCKET REGISTRY ---
// Map to keep track of active connections: userId -> WebSocket[]
const clients = new Map<string, WebSocket[]>();

function registerClient(userId: string, ws: WebSocket) {
  if (!clients.has(userId)) {
    clients.set(userId, []);
  }
  clients.get(userId)!.push(ws);
  console.log(`[WS] Cliente registrado para usuario: ${userId} (${clients.get(userId)!.length} conexiones activas)`);
}

function unregisterClient(ws: WebSocket) {
  for (const [userId, userSockets] of clients.entries()) {
    const index = userSockets.indexOf(ws);
    if (index !== -1) {
      userSockets.splice(index, 1);
      if (userSockets.length === 0) {
        clients.delete(userId);
      }
      console.log(`[WS] Conexión cerrada para usuario: ${userId}`);
      break;
    }
  }
}

function sendToUser(userId: string, message: any) {
  const userSockets = clients.get(userId);
  if (userSockets && userSockets.length > 0) {
    const payload = JSON.stringify(message);
    userSockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
    return true;
  }
  return false;
}

// Attach WS to HTTP Upgrade
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws: WebSocket) => {
  console.log('[WS] Nueva conexión WebSocket abierta');

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'register') {
        const userId = data.userId;
        if (userId) {
          registerClient(userId, ws);
        }
      }
    } catch (e) {
      console.error('[WS] Error al procesar mensaje', e);
    }
  });

  ws.on('close', () => {
    unregisterClient(ws);
  });
});

// --- HELPER PARA ALIAS Y CVU ---
const ALIAS_WORDS = [
  'cielo', 'sol', 'luna', 'mate', 'asado', 'futbol', 'pampa', 'rio', 'mar',
  'viento', 'nube', 'valle', 'cerro', 'amigo', 'patagonia', 'bosque', 'libre',
  'verde', 'azul', 'piedra', 'cordillera', 'tango', 'camino', 'horizonte'
];

function generateAlias(): string {
  const selected: string[] = [];
  while (selected.length < 3) {
    const word = ALIAS_WORDS[Math.floor(Math.random() * ALIAS_WORDS.length)];
    if (!selected.includes(word)) {
      selected.push(word);
    }
  }
  return selected.join('.');
}

function generateCvu(): string {
  // Argentina CVU virtual wallets start with 00000079
  let cvu = '00000079';
  for (let i = 0; i < 14; i++) {
    cvu += Math.floor(Math.random() * 10).toString();
  }
  return cvu;
}

// --- AUTH ROUTERS ---

app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, startingBalance, dni } = req.body;

  if (!email || !password || !name || !dni) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios (incluyendo DNI).' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'El email ya está registrado.' });
    }

    const existingDni = await prisma.user.findUnique({ where: { dni } });
    if (existingDni) {
      return res.status(400).json({ error: 'El DNI ya está registrado.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const cvu = generateCvu();
    const alias = generateAlias();

    // Create the User and their associated liability Account
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          dni,
        },
      });

      const account = await tx.account.create({
        data: {
          name: `Cuenta de ${name}`,
          type: 'LIABILITY',
          balance: new Decimal(0), // initial balance is set via Deposit to maintain ledger audit integrity
          userId: user.id,
          cvu,
          alias,
        },
      });

      return { user, account };
    });

    // Run starting balance deposit through the Ledger Service (ACID)
    const initialFunds = startingBalance !== undefined ? Number(startingBalance) : 15000;
    if (initialFunds > 0) {
      await LedgerService.executeDeposit(result.user.id, initialFunds);
    }

    res.status(201).json({
      message: 'Usuario registrado con éxito.',
      userId: result.user.id,
      cvu,
      alias,
    });
  } catch (err: any) {
    console.error('Error al registrar:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { account: true },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      account: {
        id: user.account?.id,
        cvu: user.account?.cvu,
        alias: user.account?.alias,
        balance: user.account?.balance,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno de login.' });
  }
});

// --- ACCOUNT ROUTES ---

app.get('/api/account/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.userId;
  try {
    const account = await prisma.account.findUnique({
      where: { userId },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada.' });
    }

    // Optional: audit the ledger balance to make sure cached balance is correct
    const auditedBalance = await LedgerService.auditBalance(account.id);

    res.json({
      id: account.id,
      name: account.name,
      cvu: account.cvu,
      alias: account.alias,
      balance: account.balance,
      auditedBalance: auditedBalance,
      user: account.user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener cuenta.' });
  }
});

app.get('/api/account/lookup', authenticateToken, async (req, res) => {
  const { identifier } = req.query;

  if (!identifier) {
    return res.status(400).json({ error: 'Debe ingresar un CVU, Alias o DNI.' });
  }

  try {
    const account = await prisma.account.findFirst({
      where: {
        OR: [
          { cvu: String(identifier) },
          { alias: String(identifier) },
          { user: { dni: String(identifier) } },
        ],
      },
      include: { user: true },
    });

    if (!account) {
      return res.status(404).json({ error: 'Destinatario no encontrado.' });
    }

    res.json({
      accountId: account.id,
      name: account.user?.name || account.name,
      cvu: account.cvu,
      alias: account.alias,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al buscar destinatario.' });
  }
});

app.get('/api/transactions', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.userId;

  try {
    const account = await prisma.account.findUnique({ where: { userId } });
    if (!account) {
      return res.status(404).json({ error: 'Cuenta no encontrada.' });
    }

    // Fetch ledger entries for this account
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { accountId: account.id },
      include: {
        journalEntry: {
          include: {
            ledgerEntries: {
              include: {
                account: {
                  include: { user: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format transactions in a user-friendly way
    const transactions = ledgerEntries.map((entry) => {
      const journal = entry.journalEntry;
      let partyName = 'Fintech Vault';

      // Find the opposite entry in the ledger to know who was the sender/receiver
      const otherEntry = journal.ledgerEntries.find((e) => e.accountId !== account.id);
      if (otherEntry) {
        partyName = otherEntry.account.user?.name || otherEntry.account.name;
      }

      return {
        id: journal.id,
        reference: journal.reference,
        type: journal.type,
        status: journal.status,
        amount: journal.amount,
        description: journal.description,
        partyName,
        direction: entry.type === 'DEBIT' ? 'EGRESO' : 'INGRESO', // DEBIT reduces liability, CREDIT increases
        createdAt: journal.createdAt,
      };
    });

    res.json(transactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener transacciones.' });
  }
});

// --- ADMIN AUTHORIZATION MIDDLEWARE ---
async function isAdmin(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Acceso no autorizado. Sesión faltante.' });
  }

  try {
    const userObj = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!userObj || userObj.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acceso prohibido. Se requieren permisos de Administrador.' });
    }

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al verificar permisos de administrador.' });
  }
}

// --- ADMIN API ENDPOINTS ---

// GET /api/admin/transactions - Global transactions paginated and filtered
app.get('/api/admin/transactions', authenticateToken, isAdmin, async (req, res) => {
  const { startDate, endDate, type, search, page = '1', limit = '10' } = req.query;

  const pageNum = parseInt(String(page)) || 1;
  const limitNum = parseInt(String(limit)) || 10;
  const skip = (pageNum - 1) * limitNum;

  const whereClause: any = {};

  if (startDate || endDate) {
    whereClause.createdAt = {};
    if (startDate) {
      whereClause.createdAt.gte = new Date(String(startDate));
    }
    if (endDate) {
      whereClause.createdAt.lte = new Date(String(endDate));
    }
  }

  if (type) {
    whereClause.type = String(type);
  }

  if (search) {
    const searchStr = String(search);
    whereClause.OR = [
      { description: { contains: searchStr } },
      { reference: { contains: searchStr } },
      {
        ledgerEntries: {
          some: {
            account: {
              OR: [
                { cvu: { contains: searchStr } },
                { alias: { contains: searchStr } },
                { name: { contains: searchStr } },
                { user: { name: { contains: searchStr } } },
                { user: { dni: { contains: searchStr } } },
              ],
            },
          },
        },
      },
    ];
  }

  try {
    const totalCount = await prisma.journalEntry.count({ where: whereClause });
    const journalEntries = await prisma.journalEntry.findMany({
      where: whereClause,
      include: {
        ledgerEntries: {
          include: {
            account: {
              include: { user: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    });

    const formatted = journalEntries.map((journal) => {
      const debitEntry = journal.ledgerEntries.find((e) => e.type === 'DEBIT');
      const creditEntry = journal.ledgerEntries.find((e) => e.type === 'CREDIT');

      const sourceAccount = debitEntry
        ? debitEntry.account.user?.name || debitEntry.account.name
        : 'N/A';
      const sourceIdentifier = debitEntry ? debitEntry.account.cvu : 'N/A';

      const destAccount = creditEntry
        ? creditEntry.account.user?.name || creditEntry.account.name
        : 'N/A';
      const destIdentifier = creditEntry ? creditEntry.account.cvu : 'N/A';

      return {
        id: journal.id,
        reference: journal.reference,
        type: journal.type,
        status: journal.status,
        amount: Number(journal.amount.toString()),
        description: journal.description,
        createdAt: journal.createdAt,
        sourceAccount,
        sourceIdentifier,
        destAccount,
        destIdentifier,
      };
    });

    res.json({
      transactions: formatted,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener transacciones globales.' });
  }
});

// GET /api/admin/ledger - Accounting ledger double-entry auditor
app.get('/api/admin/ledger', authenticateToken, isAdmin, async (req, res) => {
  const { page = '1', limit = '10' } = req.query;
  const pageNum = parseInt(String(page)) || 1;
  const limitNum = parseInt(String(limit)) || 10;
  const skip = (pageNum - 1) * limitNum;

  try {
    const totalCount = await prisma.journalEntry.count();
    const journals = await prisma.journalEntry.findMany({
      include: {
        ledgerEntries: {
          include: {
            account: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    });

    const ledgerDetails = journals.map((journal) => {
      let totalDebits = new Decimal(0);
      let totalCredits = new Decimal(0);

      const entries = journal.ledgerEntries.map((entry) => {
        const amt = new Decimal(entry.amount);
        if (entry.type === 'DEBIT') {
          totalDebits = totalDebits.add(amt);
        } else {
          totalCredits = totalCredits.add(amt);
        }

        return {
          id: entry.id,
          accountId: entry.accountId,
          accountName: entry.account.name,
          accountCvu: entry.account.cvu,
          accountType: entry.account.type,
          type: entry.type,
          amount: Number(entry.amount.toString()),
        };
      });

      const balanced = totalDebits.sub(totalCredits).equals(0);

      return {
        journalId: journal.id,
        reference: journal.reference,
        type: journal.type,
        description: journal.description,
        amount: Number(journal.amount.toString()),
        createdAt: journal.createdAt,
        entries,
        audit: {
          totalDebits: Number(totalDebits.toString()),
          totalCredits: Number(totalCredits.toString()),
          difference: Number(totalDebits.sub(totalCredits).toString()),
          balanced,
        },
      };
    });

    res.json({
      ledger: ledgerDetails,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener libro mayor contable.' });
  }
});

// POST /api/admin/accounts/credit - Inyección de saldo desde el vault central
app.post('/api/admin/accounts/credit', authenticateToken, isAdmin, async (req, res) => {
  const { targetUserCvu, amount, reason } = req.body;

  if (!targetUserCvu || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Campos requeridos y monto positivo inválidos.' });
  }

  try {
    const result = await LedgerService.executeAdminAdjustment(
      targetUserCvu,
      Number(amount),
      reason || 'Crédito administrativo'
    );

    // Notify receiver via WS push notification
    if (result.targetAccount.userId) {
      sendToUser(result.targetAccount.userId, {
        type: 'push_notification',
        title: '✨ Crédito Administrativo',
        message: `Se han acreditado $${Number(amount).toLocaleString('es-AR')} en tu cuenta. Motivo: ${reason || 'Ajuste Contable'}`,
        amount: Number(amount),
        partyName: 'Administración',
        journalEntryId: result.journalEntry.id,
      });

      // Update receiver's balance
      sendToUser(result.targetAccount.userId, {
        type: 'balance_updated',
      });
    }

    res.json({
      message: 'Ajuste administrativo completado con éxito.',
      journalEntryId: result.journalEntry.id,
      reference: result.journalEntry.reference,
      targetUser: result.targetAccount.user?.name || result.targetAccount.name,
      newTargetBalance: Number(result.updatedTargetBalance.toString()),
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Error al ejecutar ajuste administrativo.' });
  }
});

// GET /api/admin/metrics - Administrative statistics
app.get('/api/admin/metrics', authenticateToken, isAdmin, async (req, res) => {
  try {
    const activeUsersCount = await prisma.user.count();

    const volumeResult = await prisma.journalEntry.aggregate({
      where: { type: 'TRANSFER' },
      _sum: { amount: true },
    });
    const totalVolume = volumeResult._sum.amount ? Number(volumeResult._sum.amount.toString()) : 0;

    const issuedResult = await prisma.journalEntry.aggregate({
      where: {
        OR: [
          { type: 'DEPOSIT' },
          { type: 'ADMIN_ADJUSTMENT' },
        ],
      },
      _sum: { amount: true },
    });
    const totalMoneyIssued = issuedResult._sum.amount ? Number(issuedResult._sum.amount.toString()) : 0;

    res.json({
      activeUsersCount,
      totalVolume,
      totalMoneyIssued,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener métricas contables.' });
  }
});


// --- CORE FINANCIAL OPERATIONS WITH DELAY SIMULATION ---

app.post('/api/transfers', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.userId!;
  const { targetIdentifier, amount } = req.body;

  try {
    // 1. Create Pending Transaction record (validation of balances happens here)
    const { journalEntry, sourceAccount, targetAccount } = await LedgerService.createPendingTransfer(
      userId,
      targetIdentifier,
      Number(amount)
    );

    // 2. Respond immediately with status 202 (Accepted)
    res.status(202).json({
      message: 'Transferencia iniciada. Procesando transacción...',
      journalEntryId: journalEntry.id,
      status: journalEntry.status,
    });

    // 3. Simulate processing delay of 2.5 seconds asynchronously
    setTimeout(async () => {
      try {
        console.log(`[Ledger] Procesando transferencia pendiente ${journalEntry.id}...`);

        // Run the ACID ledger operation
        const result = await LedgerService.executePendingTransfer(
          journalEntry.id,
          userId,
          targetAccount.id,
          Number(amount)
        );

        // Notify SENDER via WS
        sendToUser(userId, {
          type: 'transfer_completed',
          journalEntryId: journalEntry.id,
          status: 'COMPLETED',
          amount: Number(amount),
          reference: result.journalEntry.reference,
          partyName: targetAccount.user?.name || targetAccount.name,
          createdAt: result.journalEntry.createdAt,
        });

        // Notify RECEIVER via WS (with push alert payload)
        if (targetAccount.userId) {
          sendToUser(targetAccount.userId, {
            type: 'push_notification',
            title: '¡Recibiste dinero!',
            message: `¡Recibiste $${Number(amount).toLocaleString('es-AR')} de ${sourceAccount.name}!`,
            amount: Number(amount),
            partyName: sourceAccount.name,
            journalEntryId: journalEntry.id,
          });

          // Also trigger a balance refresh signal
          sendToUser(targetAccount.userId, {
            type: 'balance_updated',
          });
        }
        console.log(`[Ledger] Transferencia exitosa ${journalEntry.id}`);
      } catch (err: any) {
        console.error(`[Ledger] Error procesando transferencia ${journalEntry.id}:`, err.message);

        // Mark ledger transaction as failed
        await LedgerService.failPendingTransfer(journalEntry.id);

        // Notify SENDER of failure
        sendToUser(userId, {
          type: 'transfer_failed',
          journalEntryId: journalEntry.id,
          status: 'FAILED',
          error: err.message || 'Error al procesar la transferencia.',
        });
      }
    }, 2500);

  } catch (err: any) {
    console.error('Error al iniciar transferencia:', err.message);
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/deposits', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.userId!;
  const { amount } = req.body;

  try {
    const result = await LedgerService.executeDeposit(userId, Number(amount));

    // Deposits are instant. Notify client to refresh balance
    sendToUser(userId, {
      type: 'balance_updated',
    });

    res.status(200).json({
      message: 'Dinero ingresado con éxito.',
      journalEntry: result.journalEntry,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/payments', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.userId!;
  const { merchantAlias, amount } = req.body;

  try {
    const result = await LedgerService.executeQRPayment(userId, merchantAlias || 'CAFE.MARTINEZ.QR', Number(amount));

    // QR payments are instant. Notify client to refresh balance
    sendToUser(userId, {
      type: 'balance_updated',
    });

    res.status(200).json({
      message: 'Pago QR realizado con éxito.',
      journalEntry: result.journalEntry,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- SIMULATOR PANEL TRIGGERS ---

/**
 * Endpoint to simulate an external transfer coming in to the user
 * This allows testing WebSocket push notification toasts in real time!
 */
app.post('/api/simulator/incoming-transfer', authenticateToken, async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.userId!;
  const { amount, senderName } = req.body;

  const transferAmount = Number(amount) || 2500;
  const name = senderName || 'Carlos Gómez (Simulado)';

  try {
    // 1. Create a dummy external account in DB if it doesn't exist
    const dummyCvu = '0000007999999999999999';
    const dummyAlias = 'carlos.gomez.externo';

    let externalAccount = await prisma.account.findUnique({ where: { cvu: dummyCvu } });
    if (!externalAccount) {
      externalAccount = await prisma.account.create({
        data: {
          name,
          type: 'LIABILITY',
          balance: new Decimal(100000), // starting balance
          cvu: dummyCvu,
          alias: dummyAlias,
        },
      });
    }

    // Get current user's account
    const userAccount = await prisma.account.findUnique({ where: { userId } });
    if (!userAccount) {
      return res.status(404).json({ error: 'Cuenta de usuario no encontrada.' });
    }

    // 2. Perform the double entry transfer
    // We create a journal entry directly and run ledger transfer
    const reference = 'TX-SIM-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const journalEntry = await prisma.journalEntry.create({
      data: {
        type: 'TRANSFER',
        description: `Transferencia recibida de ${name}`,
        status: 'PENDING',
        amount: new Decimal(transferAmount),
        reference,
      },
    });

    // Process the transfer instantly (simulate it coming from external banking API)
    // Since external account might not have a userId, we write a simple custom transaction for this simulator endpoint:
    await prisma.$transaction(async (tx) => {
      // Debit external account
      await tx.account.update({
        where: { id: externalAccount!.id },
        data: { balance: new Decimal(externalAccount!.balance).sub(transferAmount) },
      });
      // Credit user account
      await tx.account.update({
        where: { id: userAccount.id },
        data: { balance: new Decimal(userAccount.balance).add(transferAmount) },
      });
      // Create ledger entries
      await tx.ledgerEntry.createMany({
        data: [
          { journalEntryId: journalEntry.id, accountId: externalAccount!.id, type: 'DEBIT', amount: new Decimal(transferAmount) },
          { journalEntryId: journalEntry.id, accountId: userAccount.id, type: 'CREDIT', amount: new Decimal(transferAmount) },
        ],
      });
      // Complete journal entry
      await tx.journalEntry.update({
        where: { id: journalEntry.id },
        data: { status: 'COMPLETED' },
      });
    });

    // 3. Notify the user via WebSocket
    sendToUser(userId, {
      type: 'push_notification',
      title: '¡Recibiste dinero!',
      message: `¡Recibiste $${transferAmount.toLocaleString('es-AR')} de ${name}!`,
      amount: transferAmount,
      partyName: name,
      journalEntryId: journalEntry.id,
    });

    sendToUser(userId, {
      type: 'balance_updated',
    });

    res.json({
      message: 'Simulación de transferencia entrante disparada con éxito.',
      amount: transferAmount,
      senderName: name,
    });
  } catch (err: any) {
    console.error('Error en simulador:', err);
    res.status(500).json({ error: err.message });
  }
});

// Run server
server.listen(PORT, () => {
  console.log(`[Fintech Server] Corriendo en http://localhost:${PORT}`);
});
