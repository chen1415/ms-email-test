import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { Mutex } from "./mutex.js";

const locks = new Map<string, Mutex>();

function mutexFor(filePath: string): Mutex {
  let m = locks.get(filePath);
  if (!m) {
    m = new Mutex();
    locks.set(filePath, m);
  }
  return m;
}

export async function withCsvFile<T extends object>(
  filePath: string,
  columns: (keyof T & string)[],
  fn: (rows: T[]) => Promise<T[] | void> | T[] | void,
): Promise<void> {
  await mutexFor(filePath).run(async () => {
    const rows = await readCsv<T>(filePath, columns);
    const result = await fn(rows);
    const next = Array.isArray(result) ? result : rows;
    await writeCsv(filePath, columns, next);
  });
}

export async function readCsvLocked<T extends object>(
  filePath: string,
  columns: (keyof T & string)[],
): Promise<T[]> {
  return mutexFor(filePath).run(() => readCsv<T>(filePath, columns));
}

async function readCsv<T extends object>(
  filePath: string,
  columns: (keyof T & string)[],
): Promise<T[]> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    const raw = await fs.readFile(filePath, "utf8");
    if (!raw.trim()) return [];
    const records = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    }) as Record<string, string>[];
    return records.map((r) => {
      const row = {} as T;
      for (const col of columns) {
        (row as Record<string, string>)[col] = r[col] ?? "";
      }
      return row;
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw err;
  }
}

async function writeCsv<T extends object>(
  filePath: string,
  columns: (keyof T & string)[],
  rows: T[],
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const body = stringify(rows, {
    header: true,
    columns,
  });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, body, "utf8");
  await fs.rename(tmp, filePath);
}
