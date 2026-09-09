import { config } from "../config.js";
import { ACCOUNT_COLUMNS, type Account, type AccountStatus } from "../types.js";
import { readCsvLocked, withCsvFile } from "./csvFile.js";

function nowIso(): string {
  return new Date().toISOString();
}

function nextId(rows: Account[]): string {
  const max = rows.reduce((acc, row) => Math.max(acc, Number(row.id) || 0), 0);
  return String(max + 1);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getAllAccounts(): Promise<Account[]> {
  return readCsvLocked<Account>(config.accountsCsv, ACCOUNT_COLUMNS);
}

export async function getAccountById(id: string): Promise<Account | undefined> {
  const rows = await getAllAccounts();
  return rows.find((row) => row.id === id);
}

export async function getAccountByEmail(
  email: string,
): Promise<Account | undefined> {
  const want = normalizeEmail(email);
  const rows = await getAllAccounts();
  return rows.find((row) => normalizeEmail(row.email) === want);
}

export async function upsertAccountByEmail(input: {
  email: string;
  microsoft_user_id: string;
  token_file?: string;
  statusIfNew: AccountStatus;
}): Promise<Account> {
  const email = normalizeEmail(input.email);
  let saved: Account | undefined;
  await withCsvFile<Account>(config.accountsCsv, ACCOUNT_COLUMNS, (rows) => {
    const existing = rows.find((row) => normalizeEmail(row.email) === email);
    const ts = nowIso();
    if (existing) {
      existing.microsoft_user_id = input.microsoft_user_id;
      if (input.token_file) existing.token_file = input.token_file;
      existing.last_error = "";
      if (existing.status === "ReauthRequired" || existing.status === "Error") {
        existing.status = "Config-Run";
        existing.status_changed_at = ts;
      }
      existing.updated_at = ts;
      saved = existing;
      return rows;
    }
    const id = nextId(rows);
    const created: Account = {
      id,
      email,
      status: input.statusIfNew,
      status_changed_at: ts,
      microsoft_user_id: input.microsoft_user_id,
      token_file: input.token_file ?? `tokens/${id}.json`,
      delta_link: "",
      last_sync_at: "",
      error_count: "0",
      last_error: "",
      created_at: ts,
      updated_at: ts,
    };
    rows.push(created);
    saved = created;
    return rows;
  });
  if (!saved) throw new Error("failed to upsert account");
  return saved;
}

export async function updateAccount(
  id: string,
  patch: Partial<Account>,
): Promise<Account | undefined> {
  let saved: Account | undefined;
  await withCsvFile<Account>(config.accountsCsv, ACCOUNT_COLUMNS, (rows) => {
    const row = rows.find((item) => item.id === id);
    if (!row) return rows;
    const statusChanged =
      patch.status !== undefined && patch.status !== row.status;
    Object.assign(row, patch);
    if (statusChanged && !patch.status_changed_at) {
      row.status_changed_at = nowIso();
    }
    row.updated_at = nowIso();
    saved = row;
    return rows;
  });
  return saved;
}
