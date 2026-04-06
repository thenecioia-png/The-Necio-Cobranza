import fs from "fs";
import path from "path";
import { sqlite } from "@workspace/db";

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(process.cwd(), "necio_cobranza.db");

const BACKUP_BASE = process.env.BACKUP_DIR || "C:\\BotBackups";
const MAX_BACKUPS = 30;

/**
 * Copia el archivo SQLite a C:\BotBackups\[nombre-negocio]\backup_YYYY-MM-DDTHH-MM-SS.db
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
  const filename = `backup_${dateStr}.db`;
  const dest = path.join(dir, filename);

  // Usar el API de backup de better-sqlite3 (safe hot backup)
  await new Promise<void>((resolve, reject) => {
    sqlite.backup(dest)
      .then(() => resolve())
      .catch(reject);
  });

  // Mantener solo los últimos MAX_BACKUPS backups
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith("backup_") && f.endsWith(".db"))
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
      console.error("[BackupSQLite] Error en backup inicial:", err)
    );
  }, 30_000);

  setInterval(() => {
    backupDatabase(businessName).catch(err =>
      console.error("[BackupSQLite] Error en backup automático:", err)
    );
  }, INTERVAL_MS);
}
