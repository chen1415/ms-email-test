import { config } from "../config.js";
import {
  REDIRECT_COLUMNS,
  type RedirectRow,
  type RedirectStatus,
} from "../types.js";
import { readCsvLocked, withCsvFile } from "./csvFile.js";

function nowIso(): string {
  return new Date().toISOString();
}

function nextId(rows: RedirectRow[]): string {
  const max = rows.reduce((acc, row) => Math.max(acc, Number(row.id) || 0), 0);
  return String(max + 1);
}

export async function getAllRedirects(): Promise<RedirectRow[]> {
  return readCsvLocked<RedirectRow>(config.redirectsCsv, REDIRECT_COLUMNS);
}

export async function getRedirectsByAccountId(
  accountId: string,
): Promise<RedirectRow[]> {
  const rows = await getAllRedirects();
  return rows
    .filter((row) => row.account_id === accountId)
    .sort((a, b) => (a.received_at < b.received_at ? 1 : -1));
}

export async function getRedirectById(
  id: string,
): Promise<RedirectRow | undefined> {
  const rows = await getAllRedirects();
  return rows.find((row) => row.id === id);
}

export async function findByGraphId(
  accountId: string,
  graphMessageId: string,
): Promise<RedirectRow | undefined> {
  const rows = await getAllRedirects();
  return rows.find(
    (row) =>
      row.account_id === accountId && row.graph_message_id === graphMessageId,
  );
}

export async function insertRedirect(
  input: Omit<RedirectRow, "id" | "created_at">,
): Promise<RedirectRow> {
  let saved: RedirectRow | undefined;
  await withCsvFile<RedirectRow>(
    config.redirectsCsv,
    REDIRECT_COLUMNS,
    (rows) => {
      const dup = rows.find(
        (row) =>
          row.account_id === input.account_id &&
          row.graph_message_id === input.graph_message_id,
      );
      if (dup) {
        saved = dup;
        return rows;
      }
    const created: RedirectRow = {
        ...input,
        id: nextId(rows),
        created_at: nowIso(),
      };
      rows.push(created);
      saved = created;
      return rows;
    },
  );
  if (!saved) throw new Error("failed to insert redirect row");
  return saved;
}

export async function updateRedirect(
  id: string,
  patch: Partial<RedirectRow>,
): Promise<RedirectRow | undefined> {
  let saved: RedirectRow | undefined;
  await withCsvFile<RedirectRow>(
    config.redirectsCsv,
    REDIRECT_COLUMNS,
    (rows) => {
      const row = rows.find((item) => item.id === id);
      if (!row) return rows;
      Object.assign(row, patch);
      saved = row;
      return rows;
    },
  );
  return saved;
}

export async function markRedirectStatus(
  id: string,
  status: RedirectStatus,
  extra: Partial<RedirectRow> = {},
): Promise<RedirectRow | undefined> {
  return updateRedirect(id, { redirect_status: status, ...extra });
}
