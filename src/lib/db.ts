import sqlite3 from 'sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(process.cwd(), 'management.db');
export const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        // Create users table if not exists
        db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
            if (err) {
                console.error('Error creating users table', err.message);
            } else {
                // Pre-seed default user: admin / admin (hashed with sha256 as used in auth.ts)
                const defaultHash = crypto.createHash('sha256').update('admin').digest('hex');
                db.run(`INSERT OR IGNORE INTO users (id, username, password_hash) VALUES (1, 'admin', ?)`, [defaultHash]);
            }
        });

        // Create settings table if not exists
        db.run(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
            if (err) {
                console.error('Error creating settings table', err.message);
            } else {
                // Pre-seed default settings
                db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('BACKUP_DIR', '/tmp/backups')`);
                db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES ('FILE_MANAGER_ROOT', '/')`);
            }
        });
    }
});

// Helper Function for checking and initializing default settings
export const getSetting = async (key: string, defaultValue: string = ''): Promise<string> => {
    try {
        const row = await dbGet('SELECT value FROM settings WHERE key = ?', [key]);
        if (row) return row.value;
        return defaultValue;
    } catch {
        return defaultValue;
    }
};

export const setSetting = async (key: string, value: string): Promise<void> => {
    await dbRun(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `, [key, value]);
};

// Helper for async queries
export const dbGet = (query: string, params: any[] = []): Promise<any> => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) reject(err);
            resolve(row);
        });
    });
};

export const dbRun = (query: string, params: any[] = []): Promise<any> => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            resolve(this);
        });
    });
};
