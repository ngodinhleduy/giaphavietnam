// Adapter SQLite cho Node (Docker / VPS / NAS). Dùng node:sqlite có sẵn trong Node 22+.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { norm, type DB } from './db.ts';

export function openNodeDb(file: string, migrationsDir: string): DB {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)');
  const done = new Set(
    (db.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map((r) => r.name),
  );
  for (const f of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    db.exec(readFileSync(join(migrationsDir, f), 'utf8'));
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(f);
    console.log(`[db] migrated ${f}`);
  }

  const p = (params: unknown[] = []) => params.map(norm) as any[];
  return {
    async all(sql, params) {
      return db.prepare(sql).all(...p(params)) as any[];
    },
    async first(sql, params) {
      return (db.prepare(sql).get(...p(params)) as any) ?? null;
    },
    async run(sql, params) {
      const r = db.prepare(sql).run(...p(params));
      return { lastId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
  };
}
