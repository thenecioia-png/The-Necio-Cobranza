import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// Ruta del archivo SQLite — configurable con DB_PATH, por defecto junto al proceso
const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(process.cwd(), "necio_cobranza.db");

// Asegurarse de que el directorio existe
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);

// Habilitar WAL mode para mejor rendimiento
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Auto-migración: crea/altera tablas según el schema actual
function runMigrations(db: InstanceType<typeof Database>) {
  const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((t) => t.name);

  // ── Tablas base ───────────────────────────────────────────────────────────

  if (!tables.includes("businesses")) {
    db.exec(`CREATE TABLE businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      name TEXT NOT NULL,
      plan_type TEXT NOT NULL DEFAULT 'basic',
      activo INTEGER NOT NULL DEFAULT 0,
      banco_banco TEXT, banco_cuenta TEXT, banco_titular TEXT,
      email_smtp_user TEXT, email_smtp_pass TEXT,
      stripe_customer_id TEXT, stripe_subscription_id TEXT,
      subscription_status TEXT DEFAULT 'inactive',
      created_at INTEGER NOT NULL
    )`);
  }

  if (!tables.includes("users")) {
    db.exec(`CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL,
      email TEXT,
      oauth_provider TEXT,
      oauth_id TEXT,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'admin',
      business_id INTEGER,
      created_at INTEGER NOT NULL
    )`);
  }

  if (!tables.includes("clients")) {
    db.exec(`CREATE TABLE clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      business_id INTEGER,
      name TEXT NOT NULL,
      apodo TEXT, phone TEXT, whatsapp TEXT,
      address TEXT, sector TEXT, ciudad TEXT, cedula TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      risk_score INTEGER NOT NULL DEFAULT 50,
      notes TEXT, fiador_name TEXT, fiador_phone TEXT,
      cobrador_id INTEGER, avatar_url TEXT,
      gps_lat REAL, gps_lng REAL,
      created_at INTEGER NOT NULL
    )`);
  }

  if (!tables.includes("loans")) {
    db.exec(`CREATE TABLE loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      client_id INTEGER NOT NULL REFERENCES clients(id),
      amount TEXT NOT NULL,
      interest_rate TEXT NOT NULL,
      installments_count INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      frequency TEXT NOT NULL,
      total_amount TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL
    )`);
  }

  if (!tables.includes("installments")) {
    db.exec(`CREATE TABLE installments (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      loan_id INTEGER NOT NULL REFERENCES loans(id),
      client_id INTEGER REFERENCES clients(id),
      due_date TEXT NOT NULL,
      amount TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      paid_at INTEGER,
      payment_method TEXT DEFAULT 'efectivo',
      gps_lat REAL, gps_lng REAL,
      photo_url TEXT,
      cobrador_id INTEGER,
      paid_amount TEXT DEFAULT '0'
    )`);
  }

  // ── Migrations incrementales ───────────────────────────────────────────────

  // businesses: columnas Stripe (para DBs existentes sin estas columnas)
  const bizCols = db.prepare("PRAGMA table_info(businesses)").all() as { name: string }[];
  if (bizCols.length > 0) {
    const bizNames = bizCols.map((c) => c.name);
    if (!bizNames.includes("stripe_customer_id")) db.exec("ALTER TABLE businesses ADD COLUMN stripe_customer_id TEXT");
    if (!bizNames.includes("stripe_subscription_id")) db.exec("ALTER TABLE businesses ADD COLUMN stripe_subscription_id TEXT");
    if (!bizNames.includes("subscription_status")) db.exec("ALTER TABLE businesses ADD COLUMN subscription_status TEXT DEFAULT 'inactive'");
    if (!bizNames.includes("activo")) db.exec("ALTER TABLE businesses ADD COLUMN activo INTEGER NOT NULL DEFAULT 0");
    if (!bizNames.includes("banco_banco")) db.exec("ALTER TABLE businesses ADD COLUMN banco_banco TEXT");
    if (!bizNames.includes("banco_cuenta")) db.exec("ALTER TABLE businesses ADD COLUMN banco_cuenta TEXT");
    if (!bizNames.includes("banco_titular")) db.exec("ALTER TABLE businesses ADD COLUMN banco_titular TEXT");
    if (!bizNames.includes("email_smtp_user")) db.exec("ALTER TABLE businesses ADD COLUMN email_smtp_user TEXT");
    if (!bizNames.includes("email_smtp_pass")) db.exec("ALTER TABLE businesses ADD COLUMN email_smtp_pass TEXT");
  }

  // installments: columna clientId para joins directos
  const instCols = db.prepare("PRAGMA table_info(installments)").all() as { name: string }[];
  if (instCols.length > 0 && !instCols.map((c) => c.name).includes("client_id")) {
    db.exec("ALTER TABLE installments ADD COLUMN client_id INTEGER REFERENCES clients(id)");
  }

  // cobrador_locations: tabla nueva
  if (!tables.includes("cobrador_locations")) {
    db.exec(`
      CREATE TABLE cobrador_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        cobrador_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS cobrador_locations_cobrador_id_unique ON cobrador_locations (cobrador_id)");
  }

  // loan_contracts: tabla nueva
  if (!tables.includes("loan_contracts")) {
    db.exec(`
      CREATE TABLE loan_contracts (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        loan_id INTEGER NOT NULL REFERENCES loans(id),
        client_id INTEGER NOT NULL REFERENCES clients(id),
        business_id INTEGER,
        contract_html TEXT,
        signature_base64 TEXT,
        signed_at INTEGER,
        signer_name TEXT,
        signer_ip TEXT,
        created_at INTEGER NOT NULL
      )
    `);
  }

  // backup_settings: tabla nueva
  if (!tables.includes("backup_settings")) {
    db.exec(`
      CREATE TABLE backup_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        business_id INTEGER REFERENCES businesses(id),
        email TEXT NOT NULL,
        frequency TEXT NOT NULL DEFAULT 'weekly',
        enabled INTEGER NOT NULL DEFAULT 1,
        last_sent_at INTEGER,
        smtp_user TEXT,
        smtp_pass TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
  }

  // expenses: tabla nueva
  if (!tables.includes("expenses")) {
    db.exec(`
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        business_id INTEGER NOT NULL,
        category TEXT NOT NULL DEFAULT 'otro',
        description TEXT NOT NULL,
        amount TEXT NOT NULL,
        date TEXT NOT NULL,
        notes TEXT,
        created_at INTEGER NOT NULL
      )
    `);
  }
}

runMigrations(sqlite);

export const db = drizzle(sqlite, { schema });
export { sqlite };

export * from "./schema";
