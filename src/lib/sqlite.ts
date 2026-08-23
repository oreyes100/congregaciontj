import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'msp.db');
const SCHEMA_PATH = path.join(process.cwd(), 'src', 'lib', 'schema.sql');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('busy_timeout = 5000');
  _db.pragma('cache_size = -8000');  // 8 MB page cache
  _db.pragma('synchronous = NORMAL'); // safe with WAL

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  _db.exec(schema);

  // Runtime migrations for columns added after initial schema deployment
  const runMigrations = [
    `ALTER TABLE public_talk_outlines ADD COLUMN theme text`,
    // Territory extras
    `ALTER TABLE territories ADD COLUMN pairs_count integer`,
    `ALTER TABLE territories ADD COLUMN completion_hours real`,
    `ALTER TABLE territories ADD COLUMN completion_houses integer`,
    `ALTER TABLE territories ADD COLUMN last_notified_at text`,
    `ALTER TABLE territories ADD COLUMN last_weekly_at text`,
    `ALTER TABLE territory_assignments ADD COLUMN pairs_count integer`,
    `ALTER TABLE territory_assignments ADD COLUMN completion_hours real`,
    `ALTER TABLE territory_assignments ADD COLUMN completion_houses integer`,
    // Congregation settings multi-tenant isolation
    `ALTER TABLE congregation_settings ADD COLUMN owning_congregation_id text`,
    // Telegram sync columns
    `ALTER TABLE messaging_settings ADD COLUMN telegram_enabled integer NOT NULL DEFAULT 0`,
    `ALTER TABLE messaging_settings ADD COLUMN telegram_bot_token text`,
    `ALTER TABLE messaging_settings ADD COLUMN telegram_chat_id text`,
    `ALTER TABLE messaging_settings ADD COLUMN telegram_notify_on_assign integer NOT NULL DEFAULT 1`,
    `ALTER TABLE messaging_settings ADD COLUMN telegram_notify_overdue integer NOT NULL DEFAULT 1`,
    `ALTER TABLE messaging_settings ADD COLUMN telegram_notify_weekly_status integer NOT NULL DEFAULT 1`,
    `ALTER TABLE messaging_settings ADD COLUMN telegram_weekly_dow integer NOT NULL DEFAULT 1`,
  ];
  for (const sql of runMigrations) {
    try { _db.exec(sql); } catch { /* column already exists */ }
  }

  // `weekend_meetings` shipped with a global `UNIQUE(date)`, which made the date
  // space shared across congregations: the second congregation to claim a week
  // collided with the first and could never create it. SQLite cannot drop a
  // constraint, so the table is rebuilt. Guarded on the constraint text so this
  // runs exactly once, and column names are listed explicitly — `SELECT *` would
  // break as soon as a later migration adds a column.
  try {
    const row = _db.prepare(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='weekend_meetings'`
    ).get() as { sql: string } | undefined;

    if (row && !row.sql.includes('UNIQUE(date, congregation_id)')) {
      const COLS = [
        'id', 'date', 'speaker_type', 'local_speaker_id', 'visiting_speaker_id',
        'other_speaker_name', 'outline_id', 'special_talk_title', 'song',
        'speaker_confirmed', 'notes', 'chairman_id', 'wt_conductor_id',
        'wt_reader_id', 'hospitality_person_id', 'hospitality_text',
        'created_at', 'updated_at', 'cleaning_group', 'congregation_id',
      ];
      const present = new Set(
        (_db.prepare(`PRAGMA table_info(weekend_meetings)`).all() as { name: string }[]).map(c => c.name)
      );
      const carried = COLS.filter(c => present.has(c));

      _db.pragma('foreign_keys = OFF');
      _db.exec('BEGIN');
      try {
        _db.exec(`
          CREATE TABLE weekend_meetings_new (
            id                   text PRIMARY KEY,
            date                 text NOT NULL,
            speaker_type         text DEFAULT 'local',
            local_speaker_id     text REFERENCES users(id) ON DELETE SET NULL,
            visiting_speaker_id  text REFERENCES public_speakers(id) ON DELETE SET NULL,
            other_speaker_name   text,
            outline_id           text REFERENCES public_talk_outlines(id) ON DELETE SET NULL,
            special_talk_title   text,
            song                 integer,
            speaker_confirmed    integer DEFAULT 0,
            notes                text,
            chairman_id          text REFERENCES users(id) ON DELETE SET NULL,
            wt_conductor_id      text REFERENCES users(id) ON DELETE SET NULL,
            wt_reader_id         text REFERENCES users(id) ON DELETE SET NULL,
            hospitality_person_id text REFERENCES users(id) ON DELETE SET NULL,
            hospitality_text     text,
            created_at           text DEFAULT (datetime('now')),
            updated_at           text DEFAULT (datetime('now')),
            cleaning_group       text,
            congregation_id      text REFERENCES congregations(id),
            UNIQUE(date, congregation_id)
          )`);
        const list = carried.join(', ');
        _db.exec(`INSERT INTO weekend_meetings_new (${list}) SELECT ${list} FROM weekend_meetings`);
        _db.exec(`DROP TABLE weekend_meetings`);
        _db.exec(`ALTER TABLE weekend_meetings_new RENAME TO weekend_meetings`);
        _db.exec(`CREATE INDEX IF NOT EXISTS idx_weekend_congre ON weekend_meetings(congregation_id)`);
        _db.exec('COMMIT');
      } catch (e) {
        _db.exec('ROLLBACK');
        throw e;
      } finally {
        _db.pragma('foreign_keys = ON');
      }
    }
  } catch { /* best effort — never block startup */ }

  // Repair rows written before db.ts generated ids. `id text PRIMARY KEY` is not
  // auto-populated by SQLite and (outside STRICT tables) still accepts NULL, so
  // any route that inserted without an id produced colliding NULL-id rows.
  try {
    const tables = _db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
    ).all() as { name: string }[];
    for (const { name } of tables) {
      const cols = _db.prepare(`PRAGMA table_info("${name}")`).all() as { name: string }[];
      if (!cols.some(c => c.name === 'id')) continue;
      const orphans = _db.prepare(`SELECT rowid FROM "${name}" WHERE id IS NULL OR id = ''`).all() as { rowid: number }[];
      for (const { rowid } of orphans) {
        _db.prepare(`UPDATE "${name}" SET id = ? WHERE rowid = ?`).run(randomUUID(), rowid);
      }
    }
  } catch { /* best effort — never block startup */ }

  return _db;
}
