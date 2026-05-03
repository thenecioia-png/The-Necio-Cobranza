import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const BACKUP_BASE = process.env.BACKUP_DIR || "C:\\BotBackups";
const MAX_BACKUPS = 30;

/**
 * Realiza un backup de la base de datos PostgreSQL usando pg_dump
 * y lo guarda en C:\BotBackups\[nombre-negocio]\backup_YYYY-MM-DDTHH-MM-SS.sql
 * Retorna la ruta del backup creado.
 */
export async function backupDatabase(businessName: string): Promise<string> {
  const sanitized = businessName.replace(/[^a-zA-Z0-9_\-]/g, "_");
  const dir = path.join(BACKUP_BASE, sanitized);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `backup_${dateStr}.sql`;
  const dest = path.join(dir, filename);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está configurada para el backup");
  }

  // Usar pg_dump para hacer un backup SQL completo
  await execAsync(`pg_dump "${databaseUrl}" > "${dest}"`);

  // Mantener solo los últimos MAX_BACKUPS backups
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith("backup_") && f.endsWith(".sql"))
    .sort();

  if (files.length > MAX_BACKUPS) {
    const toDelete = files.slice(0, files.length - MAX_BACKUPS);
    for (const f of toDelete) {
      try { fs.unlinkSync(path.join(dir, f)); } catch {}
    }
  }

  return dest;
}

/**
 * Inicia backup automático cada 24 horas.
 * Llama backupDatabase(businessName) en segundo plano.
 */
export function scheduleAutoBackup(businessName: string): void {
  const INTERVAL_MS = 24 * 60 * 60 * 1000;

  // Primer backup 30 segundos después de arrancar
  setTimeout(() => {
    backupDatabase(businessName).catch(err =>
      console.error("[BackupPostgreSQL] Error en backup inicial:", err)
    );
  }, 30_000);

  setInterval(() => {
    backupDatabase(businessName).catch(err =>
      console.error("[BackupPostgreSQL] Error en backup automático:", err)
    );
  }, INTERVAL_MS);
}
