-- SQL DDL script for "Dinero Pagano" PostgreSQL Schema
-- Establishes UUID extensions, Users, Accounts, and Ledger tables with constraints.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS "users" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" VARCHAR(255) NOT NULL,
  "dni" VARCHAR(50) UNIQUE NOT NULL,
  "email" VARCHAR(255) UNIQUE NOT NULL,
  "password" VARCHAR(255) NOT NULL,
  "role" VARCHAR(50) DEFAULT 'USER',
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Accounts Table
CREATE TABLE IF NOT EXISTS "accounts" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "user_id" UUID UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "balance" NUMERIC(15, 2) DEFAULT 0.00 CHECK ("balance" >= 0.00),
  "cvu" VARCHAR(22) UNIQUE NOT NULL,
  "alias" VARCHAR(100) UNIQUE NOT NULL
);

-- 3. Ledger_Entries Table (Double-Entry Bookkeeping)
CREATE TABLE IF NOT EXISTS "ledger_entries" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "transaction_id" UUID NOT NULL,
  "account_id" UUID REFERENCES "accounts"("id") ON DELETE SET NULL,
  "entry_type" VARCHAR(10) NOT NULL CHECK ("entry_type" IN ('DEBIT', 'CREDIT')),
  "amount" NUMERIC(15, 2) NOT NULL CHECK ("amount" > 0.00),
  "description" TEXT,
  "party_name" VARCHAR(255),
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance in lookups and double-entry auditing
CREATE INDEX IF NOT EXISTS "idx_accounts_cvu" ON "accounts"("cvu");
CREATE INDEX IF NOT EXISTS "idx_accounts_alias" ON "accounts"("alias");
CREATE INDEX IF NOT EXISTS "idx_ledger_transaction" ON "ledger_entries"("transaction_id");
CREATE INDEX IF NOT EXISTS "idx_ledger_account" ON "ledger_entries"("account_id");
