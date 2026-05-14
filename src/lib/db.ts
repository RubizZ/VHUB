import { Pool, type PoolClient } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://sevenr:sevenr_dev@localhost:5432/sevenr',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error:', err);
});

/** Run a query with automatic connection management */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

/** Get a single row */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Execute a statement (INSERT/UPDATE/DELETE) and return affected count */
export async function execute(
  sql: string,
  params?: unknown[]
): Promise<{ rowCount: number }> {
  const result = await pool.query(sql, params);
  return { rowCount: result.rowCount ?? 0 };
}

/** Execute INSERT RETURNING id */
export async function insert(
  sql: string,
  params?: unknown[]
): Promise<number> {
  const result = await pool.query(sql + ' RETURNING id', params);
  return result.rows[0]?.id;
}

/** Transaction helper */
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ============================================
// Schema migration — runs on first import
// ============================================

const MIGRATIONS = `
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  riot_name VARCHAR(100) DEFAULT '',
  riot_tag VARCHAR(50) DEFAULT '',
  puuid VARCHAR(100) UNIQUE,
  role VARCHAR(20) DEFAULT 'flex',
  avatar_color VARCHAR(10) DEFAULT '#FF4655',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compositions (
  id SERIAL PRIMARY KEY,
  map_id VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT DEFAULT '',
  agent_1 VARCHAR(100) NOT NULL,
  agent_2 VARCHAR(100) NOT NULL,
  agent_3 VARCHAR(100) NOT NULL,
  agent_4 VARCHAR(100) NOT NULL,
  agent_5 VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS strategies (
  id SERIAL PRIMARY KEY,
  composition_id INT REFERENCES compositions(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  side VARCHAR(10) NOT NULL DEFAULT 'attack',
  description TEXT DEFAULT '',
  canvas_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'match',
  date DATE NOT NULL,
  time TIME NOT NULL DEFAULT '21:00',
  description TEXT DEFAULT '',
  map VARCHAR(100) DEFAULT '',
  match_id VARCHAR(200),
  status VARCHAR(20) DEFAULT 'scheduled',
  premier_week INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS availability (
  id SERIAL PRIMARY KEY,
  event_id INT REFERENCES events(id) ON DELETE CASCADE,
  player_id INT REFERENCES players(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'pending',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, player_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  channel VARCHAR(50) DEFAULT 'general',
  player_id INT REFERENCES players(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  riot_match_id VARCHAR(200) UNIQUE NOT NULL,
  map_id VARCHAR(100),
  map_name VARCHAR(100),
  game_mode VARCHAR(50),
  game_start TIMESTAMPTZ,
  game_length_ms INT,
  is_ranked BOOLEAN DEFAULT false,
  queue_id VARCHAR(50),
  team_blue_score INT DEFAULT 0,
  team_red_score INT DEFAULT 0,
  team_blue_won BOOLEAN,
  season_id VARCHAR(100),
  raw_data JSONB,
  event_id INT REFERENCES events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_player_stats (
  id SERIAL PRIMARY KEY,
  match_id INT REFERENCES matches(id) ON DELETE CASCADE,
  puuid VARCHAR(100),
  player_id INT REFERENCES players(id) ON DELETE SET NULL,
  character_id VARCHAR(100),
  team_id VARCHAR(20),
  kills INT DEFAULT 0,
  deaths INT DEFAULT 0,
  assists INT DEFAULT 0,
  score INT DEFAULT 0,
  rounds_played INT DEFAULT 0,
  competitive_tier INT,
  ability_casts JSONB DEFAULT '{}',
  UNIQUE(match_id, puuid)
);
`;

const SEED = `
INSERT INTO players (name, riot_name, riot_tag, role, avatar_color)
SELECT 'Jugador 1', '', '', 'duelist', '#FF4655'
WHERE NOT EXISTS (SELECT 1 FROM players LIMIT 1);

INSERT INTO players (name, riot_name, riot_tag, role, avatar_color)
SELECT 'Jugador 2', '', '', 'initiator', '#00D4AA'
WHERE NOT EXISTS (SELECT 1 FROM players WHERE name = 'Jugador 2');

INSERT INTO players (name, riot_name, riot_tag, role, avatar_color)
SELECT 'Jugador 3', '', '', 'controller', '#A855F7'
WHERE NOT EXISTS (SELECT 1 FROM players WHERE name = 'Jugador 3');

INSERT INTO players (name, riot_name, riot_tag, role, avatar_color)
SELECT 'Jugador 4', '', '', 'sentinel', '#3B82F6'
WHERE NOT EXISTS (SELECT 1 FROM players WHERE name = 'Jugador 4');

INSERT INTO players (name, riot_name, riot_tag, role, avatar_color)
SELECT 'Jugador 5', '', '', 'flex', '#F59E0B'
WHERE NOT EXISTS (SELECT 1 FROM players WHERE name = 'Jugador 5');
`;

let _initialized = false;

export async function initDB(): Promise<void> {
  if (_initialized) return;

  // Retry connection for Docker startup
  let retries = 10;
  while (retries > 0) {
    try {
      await pool.query('SELECT 1');
      break;
    } catch (err) {
      retries--;
      if (retries === 0) throw err;
      console.log(`Waiting for PostgreSQL... (${retries} retries left)`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // Run migrations
  const statements = MIGRATIONS.split(';').map((s) => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    await pool.query(stmt);
  }

  // Seed
  const seeds = SEED.split(';').map((s) => s.trim()).filter(Boolean);
  for (const stmt of seeds) {
    await pool.query(stmt);
  }

  _initialized = true;
  console.log('✅ Database initialized');
}

// Auto-init on import
const _initPromise = initDB().catch((err) => {
  console.error('❌ Database init failed:', err.message);
  console.error('   Make sure PostgreSQL is running. Use: docker compose up db');
});

export { _initPromise as dbReady };
