import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DB_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'mealsync.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true })
  }

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  initSchema(db)
  return db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS perfiles (
      id TEXT PRIMARY KEY,
      nombre TEXT NOT NULL,
      calorias_objetivo INTEGER DEFAULT 2000,
      proteinas_g INTEGER DEFAULT 150,
      carbohidratos_g INTEGER DEFAULT 250,
      grasas_g INTEGER DEFAULT 65,
      restricciones TEXT DEFAULT '[]',
      preferencias TEXT DEFAULT '[]',
      aversiones TEXT DEFAULT '[]',
      tiempo_cocina_max INTEGER DEFAULT 60,
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS horario_semanal (
      id TEXT PRIMARY KEY,
      semana TEXT NOT NULL,
      perfil_id TEXT NOT NULL,
      dia TEXT NOT NULL,
      desayuno TEXT DEFAULT 'casa',
      comida TEXT DEFAULT 'casa',
      cena TEXT DEFAULT 'casa',
      FOREIGN KEY (perfil_id) REFERENCES perfiles(id) ON DELETE CASCADE,
      UNIQUE(semana, perfil_id, dia)
    );

    CREATE TABLE IF NOT EXISTS menus (
      id TEXT PRIMARY KEY,
      semana TEXT NOT NULL UNIQUE,
      datos TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS despensa (
      id TEXT PRIMARY KEY,
      ingrediente TEXT NOT NULL,
      cantidad TEXT,
      unidad TEXT,
      caducidad TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getSemanaISO(date = new Date()): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
