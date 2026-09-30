import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma } from '@prisma/client';

/**
 * 门禁：容器启动时真正会执行的迁移（docker-entrypoint.sh 里
 * `prisma migrate deploy --schema=src/prisma/schema.prisma`，即 src/prisma/migrations），
 * 必须能建出 schema.prisma 里每个模型、每一列、每个枚举值和每个 @unique。
 *
 * 为什么要有：payments 的 orderNo / userId / plan / billingPeriod 四列与 demo_requests 表
 * 曾只写在 runtime/web/prisma/migrations（另一个目录，entrypoint 不执行）。
 * 按 compose 部署后所有支付下单、预约演示、注销时删预约记录都会因「列/表不存在」失败，
 * 而 jest 全部用 Prisma 替身，一条都不会红。
 *
 * 做法：不连数据库，把迁移 SQL 顺序「回放」成 表 → 列（是否 NOT NULL / 有无默认值）、
 * 唯一索引、枚举值，再与生成的 Prisma DMMF 逐项比对。
 */

const MIGRATIONS_DIR = join(__dirname, 'migrations');

interface Column { notNull: boolean; hasDefault: boolean }
interface Db {
  tables: Map<string, Map<string, Column>>;
  unique: Map<string, Set<string>>; // table -> 单列唯一的列名
  enums: Map<string, Set<string>>;
}

const unq = (s: string) => s.replace(/^"|"$/g, '');

/** 按最外层逗号切分（忽略括号和引号里的逗号）。 */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0; let quote: string | null = null; let cur = '';
  for (const ch of body) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function splitStatements(sql: string): string[] {
  const noComments = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  const out: string[] = [];
  let quote: string | null = null; let cur = '';
  for (const ch of noComments) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === ';') { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function columnFromDefinition(def: string): [string, Column] | null {
  const m = def.match(/^"([^"]+)"\s+(.*)$/s);
  if (!m) return null;
  return [m[1], { notNull: /\bNOT NULL\b/i.test(m[2]), hasDefault: /\bDEFAULT\b/i.test(m[2]) }];
}

export function replayMigrations(files: { name: string; sql: string }[]): Db {
  const db: Db = { tables: new Map(), unique: new Map(), enums: new Map() };
  const table = (name: string) => {
    const t = db.tables.get(name);
    if (!t) throw new Error(`迁移引用了不存在的表 ${name}`);
    return t;
  };
  for (const file of files) {
    for (const stmt of splitStatements(file.sql)) {
      let m: RegExpMatchArray | null;
      if ((m = stmt.match(/^CREATE TYPE "([^"]+)" AS ENUM \((.*)\)$/is))) {
        db.enums.set(m[1], new Set([...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1])));
      } else if ((m = stmt.match(/^ALTER TYPE "([^"]+)" ADD VALUE (?:IF NOT EXISTS )?'([^']*)'/i))) {
        db.enums.get(m[1])?.add(m[2]);
      } else if ((m = stmt.match(/^CREATE TABLE (?:IF NOT EXISTS )?"([^"]+)"\s*\((.*)\)$/is))) {
        const cols = new Map<string, Column>();
        for (const part of splitTopLevel(m[2])) {
          const c = columnFromDefinition(part);
          if (c) cols.set(c[0], c[1]);
        }
        db.tables.set(m[1], cols);
      } else if ((m = stmt.match(/^DROP TABLE (?:IF EXISTS )?"([^"]+)"/i))) {
        db.tables.delete(m[1]); db.unique.delete(m[1]);
      } else if ((m = stmt.match(/^ALTER TABLE "([^"]+)"\s+(.*)$/is))) {
        const cols = table(m[1]);
        for (const clause of splitTopLevel(m[2])) {
          let c: RegExpMatchArray | null;
          if ((c = clause.match(/^ADD COLUMN (?:IF NOT EXISTS )?(.*)$/is))) {
            const col = columnFromDefinition(c[1]);
            if (col) cols.set(col[0], col[1]);
          } else if ((c = clause.match(/^DROP COLUMN (?:IF EXISTS )?"([^"]+)"/i))) {
            cols.delete(c[1]);
          } else if ((c = clause.match(/^ALTER COLUMN "([^"]+)" SET NOT NULL/i))) {
            const col = cols.get(c[1]); if (col) col.notNull = true;
          } else if ((c = clause.match(/^ALTER COLUMN "([^"]+)" DROP NOT NULL/i))) {
            const col = cols.get(c[1]); if (col) col.notNull = false;
          } else if ((c = clause.match(/^ALTER COLUMN "([^"]+)" SET DEFAULT/i))) {
            const col = cols.get(c[1]); if (col) col.hasDefault = true;
          } else if ((c = clause.match(/^ALTER COLUMN "([^"]+)" DROP DEFAULT/i))) {
            const col = cols.get(c[1]); if (col) col.hasDefault = false;
          } else if (/^RENAME\b/i.test(clause)) {
            throw new Error(`回放器还不认识 RENAME，请扩展 migrations-drift.test.ts：${stmt.slice(0, 80)}`);
          }
        }
      } else if ((m = stmt.match(/^CREATE UNIQUE INDEX (?:IF NOT EXISTS )?"[^"]+" ON "([^"]+)"\s*\(([^)]*)\)/i))) {
        const cols = m[2].split(',').map((s) => unq(s.trim()));
        if (cols.length === 1) {
          if (!db.unique.has(m[1])) db.unique.set(m[1], new Set());
          db.unique.get(m[1])!.add(cols[0]);
        }
      } else if (/^ALTER TABLE|^CREATE TABLE|^DROP TABLE|^CREATE TYPE|^ALTER TYPE/i.test(stmt)) {
        throw new Error(`回放器无法解析的迁移语句：${stmt.slice(0, 100)}`);
      }
    }
  }
  return db;
}

export function loadMigrations() {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8') }));
}

/** 返回所有不一致项；空数组即一致。 */
export function driftProblems(db: Db): string[] {
  const problems: string[] = [];
  const { models, enums } = Prisma.dmmf.datamodel;
  for (const model of models) {
    const tableName = model.dbName || model.name;
    const cols = db.tables.get(tableName);
    if (!cols) { problems.push(`缺表 ${tableName}（模型 ${model.name}）`); continue; }
    const scalar = model.fields.filter((f) => f.kind !== 'object');
    for (const f of scalar) {
      const col = f.dbName || f.name;
      const dbCol = cols.get(col);
      if (!dbCol) { problems.push(`缺列 ${tableName}.${col}`); continue; }
      // Prisma 里可选、库里却 NOT NULL 且没有默认值：写入时省略该字段就会失败
      if (!f.isRequired && dbCol.notNull && !dbCol.hasDefault) {
        problems.push(`${tableName}.${col} 在 schema 里可选，但库里 NOT NULL 且无默认值`);
      }
      if (f.isUnique && !db.unique.get(tableName)?.has(col)) {
        problems.push(`缺唯一索引 ${tableName}.${col}`);
      }
      if (f.kind === 'enum') {
        const values = db.enums.get(f.type);
        if (!values) problems.push(`缺枚举类型 ${f.type}（${tableName}.${col}）`);
        else {
          const expected = enums.find((e) => e.name === f.type)!.values.map((v) => v.name);
          for (const v of expected) if (!values.has(v)) problems.push(`枚举 ${f.type} 缺值 ${v}`);
        }
      }
    }
    // 库里有、schema 里没有的 NOT NULL 无默认值列：Prisma 的 create 永远填不上它
    const known = new Set(scalar.map((f) => f.dbName || f.name));
    for (const [col, c] of cols) {
      if (!known.has(col) && c.notNull && !c.hasDefault) {
        problems.push(`${tableName}.${col} 是 NOT NULL 且无默认值，但 schema 里没有这一列`);
      }
    }
  }
  return problems;
}

describe('迁移与 schema.prisma 不漂移', () => {
  const files = loadMigrations();

  it('目录里至少有迁移，且都能被回放', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(() => replayMigrations(files)).not.toThrow();
  });

  it('容器启动执行的迁移能建出 schema 里的全部表、列、唯一索引和枚举值', () => {
    expect(driftProblems(replayMigrations(files))).toEqual([]);
  });

  // 检查器自己必须能抓住问题：删掉一列、一张表、一个唯一索引都要红
  it('检查器能识别缺列、缺表、缺唯一索引', () => {
    const base = replayMigrations(files);
    const clone = (): Db => ({
      tables: new Map([...base.tables].map(([t, c]) => [t, new Map(c)])),
      unique: new Map([...base.unique].map(([t, s]) => [t, new Set(s)])),
      enums: new Map([...base.enums].map(([e, s]) => [e, new Set(s)])),
    });
    const noCol = clone(); noCol.tables.get('users')!.delete('email');
    expect(driftProblems(noCol)).toContain('缺列 users.email');
    const noTable = clone(); noTable.tables.delete('payments');
    expect(driftProblems(noTable).join('\n')).toContain('缺表 payments');
    const noUnique = clone(); noUnique.unique.get('users')!.delete('email');
    expect(driftProblems(noUnique)).toContain('缺唯一索引 users.email');
  });
});

describe('只有一个迁移目录', () => {
  // runtime/web/prisma/migrations 是旧位置，entrypoint 不执行它。两个目录并存时，
  // 有人把新迁移写进旧目录，部署后表/列就缺了（这个门禁本来要抓的事故）。
  it('旧目录 runtime/web/prisma/migrations 不存在', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { existsSync } = require('node:fs') as typeof import('node:fs');
    expect(existsSync(join(__dirname, '..', '..', 'prisma', 'migrations'))).toBe(false);
  });
});
