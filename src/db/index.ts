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
  
  // Check if we need to migrate the timestamp columns
  try {
    const tableInfo = sqlite.prepare("PRAGMA table_info(domains)").all();
    const createdAtColumn = tableInfo.find((col: any) => col.name === 'created_at') as any;
    
    if (createdAtColumn && createdAtColumn.type === 'TEXT') {
      console.log('Migrating timestamp columns from TEXT to INTEGER...');
      
      // Create a new table with the correct schema
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS domains_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          ip_address TEXT NOT NULL,
          port INTEGER DEFAULT 80,
          is_active INTEGER DEFAULT 1,
          description TEXT,
          category TEXT,
          tags TEXT,
          parent_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
          created_at INTEGER DEFAULT (unixepoch()),
          updated_at INTEGER DEFAULT (unixepoch())
        );
      `);
      
      // Copy data from old table to new table, converting timestamps
      sqlite.exec(`
        INSERT OR IGNORE INTO domains_new (id, name, ip_address, port, is_active, description, category, tags, created_at, updated_at)
        SELECT 
          id, 
          name, 
          ip_address, 
          port, 
          is_active, 
          description, 
          category, 
          tags,
          CASE 
            WHEN created_at IS NULL THEN unixepoch()
            ELSE unixepoch(created_at)
          END,
          CASE 
            WHEN updated_at IS NULL THEN unixepoch()
            ELSE unixepoch(updated_at)
          END
        FROM domains;
      `);
      
      // Drop old table and rename new table
      sqlite.exec(`
        DROP TABLE domains;
        ALTER TABLE domains_new RENAME TO domains;
      `);
      
      console.log('Migration completed successfully');
    }
  } catch (error) {
    console.log('No migration needed or migration skipped:', error);
  }
  
  // Check if parent_id column exists and add it if not
  try {
    const tableInfo = sqlite.prepare("PRAGMA table_info(domains)").all();
    const hasParentId = tableInfo.some((col: any) => col.name === 'parent_id');
    
    if (!hasParentId) {
      console.log('Adding parent_id column to domains table...');
      sqlite.exec(`ALTER TABLE domains ADD COLUMN parent_id INTEGER REFERENCES domains(id) ON DELETE CASCADE;`);
      sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_domain_parent ON domains(parent_id);`);
    }
  } catch (error) {
    console.log('Could not check/add parent_id column:', error);
  }
  
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
      parent_id INTEGER REFERENCES domains(id) ON DELETE CASCADE,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );
    
    CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_name ON domains(name);
    CREATE INDEX IF NOT EXISTS idx_domain_category ON domains(category);
    CREATE INDEX IF NOT EXISTS idx_domain_parent ON domains(parent_id);
    
    -- Create trigger to update the updated_at timestamp
    CREATE TRIGGER IF NOT EXISTS update_domains_updated_at
    AFTER UPDATE ON domains
    FOR EACH ROW
    BEGIN
      UPDATE domains SET updated_at = unixepoch() WHERE id = NEW.id;
    END;
    
    -- Settings table
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      description TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );
    
    CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
    
    -- Reverse proxy configurations table
    CREATE TABLE IF NOT EXISTS reverse_proxy_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain_id INTEGER NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
      proxy_pass TEXT NOT NULL,
      proxy_host TEXT,
      proxy_headers TEXT,
      websocket_support INTEGER DEFAULT 0,
      cache_enabled INTEGER DEFAULT 0,
      custom_config TEXT,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch())
    );
    
    CREATE INDEX IF NOT EXISTS idx_reverse_proxy_domain ON reverse_proxy_configs(domain_id);
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