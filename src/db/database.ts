import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const databasePath = resolve(
  process.env.DATABASE_PATH ?? "./data/prices.sqlite",
);

mkdirSync(dirname(databasePath), { recursive: true });

export const db = new DatabaseSync(databasePath);

db.exec("PRAGMA foreign_keys = ON");

db.exec(`
    CREATE TABLE IF NOT EXISTS coins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cmc_id INTEGER NOT NULL UNIQUE,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL 
    );
    
    CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        coin_id INTEGER NOT NULL,
        price TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        recorded_at TEXT NOT NULL,
        FOREIGN KEY (coin_id) REFERENCES coins(id) ON DELETE CASCADE    
    );

    CREATE INDEX IF NOT EXISTS idx_price_history_coin_time 
        ON price_history (coin_id, recorded_at DESC);
    `);
