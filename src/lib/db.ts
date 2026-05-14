import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', '7r.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeDb(db);
  }
  return db;
}

function initializeDb(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      riot_name TEXT,
      riot_tag TEXT,
      role TEXT DEFAULT 'flex',
      avatar_color TEXT DEFAULT '#FF4655',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS strategies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      map TEXT NOT NULL,
      side TEXT NOT NULL DEFAULT 'attack',
      description TEXT DEFAULT '',
      canvas_data TEXT DEFAULT '{}',
      created_by INTEGER REFERENCES players(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'match',
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      description TEXT DEFAULT '',
      map TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      note TEXT DEFAULT '',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(event_id, player_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL DEFAULT 'general',
      player_id INTEGER NOT NULL REFERENCES players(id),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id TEXT UNIQUE,
      map TEXT,
      mode TEXT,
      result TEXT,
      rounds_won INTEGER DEFAULT 0,
      rounds_lost INTEGER DEFAULT 0,
      data_json TEXT DEFAULT '{}',
      played_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS player_match_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
      player_id INTEGER REFERENCES players(id),
      puuid TEXT,
      agent TEXT,
      kills INTEGER DEFAULT 0,
      deaths INTEGER DEFAULT 0,
      assists INTEGER DEFAULT 0,
      acs INTEGER DEFAULT 0,
      headshot_pct REAL DEFAULT 0,
      first_bloods INTEGER DEFAULT 0,
      first_deaths INTEGER DEFAULT 0,
      adr REAL DEFAULT 0,
      kast REAL DEFAULT 0,
      data_json TEXT DEFAULT '{}',
      UNIQUE(match_id, player_id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel, created_at);
    CREATE INDEX IF NOT EXISTS idx_availability_event ON availability(event_id);
    CREATE INDEX IF NOT EXISTS idx_player_stats_match ON player_match_stats(match_id);
    CREATE INDEX IF NOT EXISTS idx_player_stats_player ON player_match_stats(player_id);
  `);

  // Seed default players if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM players').get() as { c: number };
  if (count.c === 0) {
    const insert = db.prepare('INSERT INTO players (name, riot_name, riot_tag, role, avatar_color) VALUES (?, ?, ?, ?, ?)');
    const players = [
      ['Jugador 1', '', '', 'duelist', '#FF4655'],
      ['Jugador 2', '', '', 'initiator', '#00D4AA'],
      ['Jugador 3', '', '', 'controller', '#A855F7'],
      ['Jugador 4', '', '', 'sentinel', '#3B82F6'],
      ['Jugador 5', '', '', 'flex', '#F59E0B'],
    ];
    for (const p of players) {
      insert.run(...p);
    }
  }
}
