import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as schema from './schema';

// Get the proper data directory for the app
const getDbPath = () => {
  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'data');
  
  // Ensure the directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  return path.join(dbDir, 'local-domain-manager.db');
};

// Create database instance
let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

export const initDatabase = () => {
  const dbPath = getDbPath();
  
  console.log('Initializing database at:', dbPath);
  
  // Create SQLite connection
  sqlite = new Database(dbPath);
  
  // Enable foreign keys
  sqlite.exec('PRAGMA foreign_keys = ON');
  
  // Create drizzle instance
  db = drizzle(sqlite, { schema });
  
  // Initialize tables (this won't recreate existing tables)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS domains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      ip_address TEXT NOT NULL,
      port INTEGER DEFAULT 80,
      is_active INTEGER DEFAULT 1,
      description TEXT,
      category TEXT,
      tags TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    
    CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_name ON domains(name);
    CREATE INDEX IF NOT EXISTS idx_domain_category ON domains(category);
  `);
  
  console.log('Database initialized successfully');
  
  return db;
};

export const getDb = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
};

export const closeDatabase = () => {
  if (sqlite) {
    sqlite.close();
  }
};

export { schema };