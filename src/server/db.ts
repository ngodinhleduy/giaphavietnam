// Lớp DB tối giản, chung cho Cloudflare D1 và SQLite trên Node.
export type Row = Record<string, any>;

export interface DB {
  all<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  first<T = Row>(sql: string, params?: unknown[]): Promise<T | null>;
  run(sql: string, params?: unknown[]): Promise<{ lastId: number; changes: number }>;
}

// Adapter cho Cloudflare D1
export function d1Adapter(d1: D1Database): DB {
  const bind = (sql: string, params: unknown[] = []) => d1.prepare(sql).bind(...params.map(norm));
  return {
    async all(sql, params) {
      const r = await bind(sql, params).all();
      return (r.results ?? []) as any[];
    },
    async first(sql, params) {
      return ((await bind(sql, params).first()) ?? null) as any;
    },
    async run(sql, params) {
      const r = await bind(sql, params).run();
      return { lastId: Number(r.meta.last_row_id ?? 0), changes: Number(r.meta.changes ?? 0) };
    },
  };
}

// D1 và node:sqlite không nhận undefined/boolean
export function norm(v: unknown): unknown {
  if (v === undefined || v === '') return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v;
}
