export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
}

export enum JournalType {
  TRANSFER = 'TRANSFER',
  DEPOSIT = 'DEPOSIT',
  QR_PAYMENT = 'QR_PAYMENT',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum EntryType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}
