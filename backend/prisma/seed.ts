import { PrismaClient } from '@prisma/client';
import { AccountType } from '../src/types/enums';
import bcrypt from 'bcryptjs';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

// Helper to generate unique reference
function generateReference(): string {
  return 'TX-SEED-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

async function main() {
  console.log('Iniciando siembra de base de datos...');

  // 1. Limpiar base de datos
  await prisma.ledgerEntry.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  console.log('Tablas limpias.');

  // 2. Crear Cuenta de Activos del Sistema Fintech (Vault)
  const systemVault = await prisma.account.create({
    data: {
      name: 'Fintech Cash Asset Account',
      type: AccountType.ASSET,
      balance: new Decimal(1000000000), // Cuenta madre de activos
      cvu: 'SYSTEM_FINTECH_VAULT_001',
      alias: 'FINTECH.VAULT.CASH',
    },
  });
  console.log('Cuenta de activos del sistema creada.');

  // 3. Crear Cuenta de Comercio (Mercado Pago / Ualá partner) para Pago QR
  const systemMerchant = await prisma.account.create({
    data: {
      name: 'Café Martínez QR Merchant',
      type: AccountType.LIABILITY,
      balance: new Decimal(0),
      cvu: 'SYSTEM_MERCHANT_QR_0001',
      alias: 'CAFE.MARTINEZ.QR',
    },
  });
  console.log('Cuenta de comercio (Café Martínez) creada.');

  // 4. Usuarios Dummy
  const hashedPassword = bcrypt.hashSync('password123', 10);

  const usersData = [
    {
      name: 'Usuario Prueba',
      email: 'test@wallet.com',
      cvu: '0000007912345678901234',
      alias: 'usuario.prueba.fintech',
      startingBalance: 15000,
    },
    {
      name: 'Juan Pérez',
      email: 'juan@perez.com',
      cvu: '0000007911111111111111',
      alias: 'juan.perez.pago',
      startingBalance: 25000,
    },
    {
      name: 'María Rodríguez',
      email: 'maria@rodriguez.com',
      cvu: '0000007922222222222222',
      alias: 'maria.rodriguez.efectivo',
      startingBalance: 45000,
    },
  ];

  for (const u of usersData) {
    const user = await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        password: hashedPassword,
      },
    });

    const account = await prisma.account.create({
      data: {
        name: `Cuenta de ${u.name}`,
        type: AccountType.LIABILITY,
        balance: new Decimal(0), // se cargará con asiento contable a continuación
        userId: user.id,
        cvu: u.cvu,
        alias: u.alias,
      },
    });

    console.log(`Usuario creado: ${u.name} (CVU: ${u.cvu}, Alias: ${u.alias})`);

    // Depósito inicial (Partida Doble)
    if (u.startingBalance > 0) {
      const reference = generateReference();
      const journalEntry = await prisma.journalEntry.create({
        data: {
          type: 'DEPOSIT',
          description: 'Carga inicial de saldo (Semilla)',
          status: 'COMPLETED',
          amount: new Decimal(u.startingBalance),
          reference,
        },
      });

      // Ledger: Debitar Caja Activo del Sistema, Acreditar Pasivo Cuenta de Usuario
      await prisma.ledgerEntry.createMany({
        data: [
          {
            journalEntryId: journalEntry.id,
            accountId: systemVault.id,
            type: 'DEBIT',
            amount: new Decimal(u.startingBalance),
          },
          {
            journalEntryId: journalEntry.id,
            accountId: account.id,
            type: 'CREDIT',
            amount: new Decimal(u.startingBalance),
          },
        ],
      });

      // Actualizar balances
      await prisma.account.update({
        where: { id: systemVault.id },
        data: { balance: new Decimal(systemVault.balance).add(u.startingBalance) }, // Aunque el Vault inicial es gigante, sumamos
      });

      await prisma.account.update({
        where: { id: account.id },
        data: { balance: new Decimal(u.startingBalance) },
      });

      console.log(`  -> Saldo inicial de $${u.startingBalance} acreditado contablemente.`);
    }
  }

  console.log('¡Siembra completada con éxito!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
