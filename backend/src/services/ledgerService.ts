import { prisma } from '../db';
import { EntryType, JournalType, TransactionStatus, AccountType } from '../types/enums';
import { Decimal } from '@prisma/client/runtime/library';

// Helper helper to generate unique references
function generateReference(): string {
  return 'TX-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

export class LedgerService {
  /**
   * Helper to ensure the Fintech System Cash Asset Account exists.
   * In double-entry, deposits debit this active asset account and credit the user's liability account.
   */
  private static async getSystemCashAccount(tx: any) {
    let account = await tx.account.findUnique({
      where: { cvu: 'SYSTEM_FINTECH_VAULT_001' },
    });

    if (!account) {
      account = await tx.account.create({
        data: {
          name: 'Fintech Cash Asset Account',
          type: AccountType.ASSET,
          balance: new Decimal(1000000000), // Large initial assets
          cvu: 'SYSTEM_FINTECH_VAULT_001',
          alias: 'FINTECH.VAULT.CASH',
        },
      });
    }
    return account;
  }

  /**
   * Helper to ensure the Fintech System Merchant Account exists for QR payments.
   */
  private static async getSystemMerchantAccount(tx: any, merchantAlias: string = 'CAFE.MARTINEZ.QR') {
    let account = await tx.account.findUnique({
      where: { alias: merchantAlias },
    });

    if (!account) {
      account = await tx.account.create({
        data: {
          name: 'Café Martínez QR Merchant',
          type: AccountType.LIABILITY,
          balance: new Decimal(0),
          cvu: 'SYSTEM_MERCHANT_QR_0001',
          alias: merchantAlias,
        },
      });
    }
    return account;
  }

  /**
   * Get the balance of an account recalculated directly from the ledger entries (Auditing).
   */
  static async auditBalance(accountId: string): Promise<Decimal> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) throw new Error('Account not found');

    const entries = await prisma.ledgerEntry.findMany({
      where: { accountId },
    });

    let balance = new Decimal(0);
    for (const entry of entries) {
      if (account.type === AccountType.LIABILITY) {
        // Liability: Credits increase, Debits decrease
        if (entry.type === EntryType.CREDIT) {
          balance = balance.add(entry.amount);
        } else {
          balance = balance.sub(entry.amount);
        }
      } else {
        // Asset: Debits increase, Credits decrease
        if (entry.type === EntryType.DEBIT) {
          balance = balance.add(entry.amount);
        } else {
          balance = balance.sub(entry.amount);
        }
      }
    }
    return balance;
  }

  /**
   * Step 1: Create a Pending Transfer Journal Entry
   * This is fast, does not lock the database, and enables async processing.
   */
  static async createPendingTransfer(fromUserId: string, targetIdentifier: string, amount: number) {
    if (amount <= 0) {
      throw new Error('El monto debe ser mayor a cero.');
    }

    // Pre-validate target account exists
    const targetAccount = await prisma.account.findFirst({
      where: {
        OR: [
          { cvu: targetIdentifier },
          { alias: targetIdentifier },
        ],
      },
      include: { user: true },
    });

    if (!targetAccount) {
      throw new Error('La cuenta destino (CVU o Alias) no existe.');
    }

    // Pre-validate sender account and balance
    const sourceAccount = await prisma.account.findUnique({
      where: { userId: fromUserId },
    });

    if (!sourceAccount) {
      throw new Error('Cuenta origen no encontrada.');
    }

    if (sourceAccount.cvu === targetAccount.cvu) {
      throw new Error('No puedes transferirte a ti mismo.');
    }

    if (new Decimal(sourceAccount.balance).lessThan(amount)) {
      throw new Error('Saldo insuficiente.');
    }

    // Create the Journal Entry as PENDING
    const reference = generateReference();
    const journalEntry = await prisma.journalEntry.create({
      data: {
        type: JournalType.TRANSFER,
        description: `Transferencia a ${targetAccount.user?.name || targetAccount.name}`,
        status: TransactionStatus.PENDING,
        amount: new Decimal(amount),
        reference,
      },
    });

    return {
      journalEntry,
      sourceAccount,
      targetAccount,
    };
  }

  /**
   * Step 2: Execute the actual Double-Entry Transfer in an ACID transaction.
   * This runs after the simulated processing delay.
   */
  static async executePendingTransfer(journalEntryId: string, fromUserId: string, targetAccountId: string, amount: number) {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch and Lock source account (prevent race conditions)
      const sourceAccount = await tx.account.findUnique({
        where: { userId: fromUserId },
      });

      if (!sourceAccount) {
        throw new Error('Cuenta de origen no encontrada en la transacción.');
      }

      // Check balance inside transaction
      if (new Decimal(sourceAccount.balance).lessThan(amount)) {
        throw new Error('Saldo insuficiente al momento de ejecutar.');
      }

      // 2. Fetch target account
      const targetAccount = await tx.account.findUnique({
        where: { id: targetAccountId },
      });

      if (!targetAccount) {
        throw new Error('Cuenta destino no encontrada en la transacción.');
      }

      // 3. Update balances in Account table
      const finalSourceBalance = new Decimal(sourceAccount.balance).sub(amount);
      const finalTargetBalance = new Decimal(targetAccount.balance).add(amount);

      await tx.account.update({
        where: { id: sourceAccount.id },
        data: { balance: finalSourceBalance },
      });

      await tx.account.update({
        where: { id: targetAccount.id },
        data: { balance: finalTargetBalance },
      });

      // 4. Create Ledger Entries (Debit sender, Credit receiver)
      await tx.ledgerEntry.createMany({
        data: [
          {
            journalEntryId,
            accountId: sourceAccount.id,
            type: EntryType.DEBIT, // Debit liability reduces balance
            amount: new Decimal(amount),
          },
          {
            journalEntryId,
            accountId: targetAccount.id,
            type: EntryType.CREDIT, // Credit liability increases balance
            amount: new Decimal(amount),
          },
        ],
      });

      // 5. Update JournalEntry to COMPLETED
      const updatedJournal = await tx.journalEntry.update({
        where: { id: journalEntryId },
        data: { status: TransactionStatus.COMPLETED },
        include: { ledgerEntries: true },
      });

      return {
        journalEntry: updatedJournal,
        sourceAccount: { ...sourceAccount, balance: finalSourceBalance },
        targetAccount: { ...targetAccount, balance: finalTargetBalance },
      };
    });
  }

  /**
   * Fail a pending transfer
   */
  static async failPendingTransfer(journalEntryId: string) {
    return await prisma.journalEntry.update({
      where: { id: journalEntryId },
      data: { status: TransactionStatus.FAILED },
    });
  }

  /**
   * Deposit money (ACID transaction)
   * Debit System Active Cash Account (+Asset)
   * Credit User Wallet Liability Account (+Liability, which is the user's wallet balance)
   */
  static async executeDeposit(userId: string, amount: number) {
    if (amount <= 0) throw new Error('El monto debe ser mayor a cero.');

    return await prisma.$transaction(async (tx) => {
      const userAccount = await tx.account.findUnique({
        where: { userId },
        include: { user: true },
      });

      if (!userAccount) throw new Error('Cuenta de usuario no encontrada.');

      const systemCashAccount = await LedgerService.getSystemCashAccount(tx);

      // Create completed Journal Entry
      const reference = generateReference();
      const journalEntry = await tx.journalEntry.create({
        data: {
          type: JournalType.DEPOSIT,
          description: 'Ingreso de dinero',
          status: TransactionStatus.COMPLETED,
          amount: new Decimal(amount),
          reference,
        },
      });

      // Create Ledger Entries
      await tx.ledgerEntry.createMany({
        data: [
          {
            journalEntryId: journalEntry.id,
            accountId: systemCashAccount.id,
            type: EntryType.DEBIT, // Debit asset increases balance
            amount: new Decimal(amount),
          },
          {
            journalEntryId: journalEntry.id,
            accountId: userAccount.id,
            type: EntryType.CREDIT, // Credit liability increases user balance
            amount: new Decimal(amount),
          },
        ],
      });

      // Update balances
      const updatedSystemBalance = new Decimal(systemCashAccount.balance).add(amount); // Debited asset -> balance increases
      const updatedUserBalance = new Decimal(userAccount.balance).add(amount);       // Credited liability -> balance increases

      await tx.account.update({
        where: { id: systemCashAccount.id },
        data: { balance: updatedSystemBalance },
      });

      const updatedAccount = await tx.account.update({
        where: { id: userAccount.id },
        data: { balance: updatedUserBalance },
        include: { user: true },
      });

      return {
        journalEntry,
        account: updatedAccount,
      };
    });
  }

  /**
   * QR Payment (ACID transaction)
   * Debit User Wallet Liability Account (-Liability)
   * Credit Merchant Liability Account (+Liability)
   */
  static async executeQRPayment(userId: string, merchantAlias: string, amount: number) {
    if (amount <= 0) throw new Error('El monto debe ser mayor a cero.');

    return await prisma.$transaction(async (tx) => {
      const userAccount = await tx.account.findUnique({
        where: { userId },
      });

      if (!userAccount) throw new Error('Cuenta de usuario no encontrada.');
      if (new Decimal(userAccount.balance).lessThan(amount)) {
        throw new Error('Saldo insuficiente.');
      }

      const merchantAccount = await LedgerService.getSystemMerchantAccount(tx, merchantAlias);

      const reference = generateReference();
      const journalEntry = await tx.journalEntry.create({
        data: {
          type: JournalType.QR_PAYMENT,
          description: `Pago QR a ${merchantAccount.name}`,
          status: TransactionStatus.COMPLETED,
          amount: new Decimal(amount),
          reference,
        },
      });

      // Create Ledger Entries
      await tx.ledgerEntry.createMany({
        data: [
          {
            journalEntryId: journalEntry.id,
            accountId: userAccount.id,
            type: EntryType.DEBIT, // Debit liability decreases balance
            amount: new Decimal(amount),
          },
          {
            journalEntryId: journalEntry.id,
            accountId: merchantAccount.id,
            type: EntryType.CREDIT, // Credit liability increases balance
            amount: new Decimal(amount),
          },
        ],
      });

      // Update balances
      const updatedUserBalance = new Decimal(userAccount.balance).sub(amount);
      const updatedMerchantBalance = new Decimal(merchantAccount.balance).add(amount);

      const updatedAccount = await tx.account.update({
        where: { id: userAccount.id },
        data: { balance: updatedUserBalance },
      });

      await tx.account.update({
        where: { id: merchantAccount.id },
        data: { balance: updatedMerchantBalance },
      });

      return {
        journalEntry,
        account: updatedAccount,
      };
    });
  }
}
