import { config } from "../config.js";
import { getAllAccounts } from "../csv/accountStore.js";
import { formatDisplayTime } from "../formatTime.js";
import { syncAccount } from "../graph/syncInbox.js";
import type { Account } from "../types.js";

export type SchedulerPhase = "idle" | "syncing" | "waiting_quota" | "backoff_429";

export type SchedulerSnapshot = {
  phase: SchedulerPhase;
  phaseLabel: string;
  activeEmail: string;
  cycleIndex: number;
  cycleTotal: number;
  tokensUsedThisMinute: number;
  tokensMax: number;
  estimatedCycleMin: number;
  backoffSec: number;
  last429At: string;
  cursorEmail: string;
};

const state = {
  cursor: 0,
  cycleIndex: 0,
  cycleTotal: 0,
  activeEmail: "",
  busy: false,
  tokens: config.syncPerMinute,
  lastRefillAt: Date.now(),
  backoffUntil: 0,
  last429At: "",
  lastCycleMs: 0,
  cycleStartedAt: Date.now(),
};

function refillTokens(): void {
  const now = Date.now();
  const elapsed = now - state.lastRefillAt;
  const add = (elapsed / 60_000) * config.syncPerMinute;
  if (add <= 0) return;
  state.tokens = Math.min(config.syncPerMinute, state.tokens + add);
  state.lastRefillAt = now;
}

function tokensUsedThisMinute(): number {
  return Math.max(0, Math.round(config.syncPerMinute - state.tokens));
}

function runningAccounts(accounts: Account[]): Account[] {
  return accounts.filter((row) => row.status === "Running");
}

function isDue(account: Account): boolean {
  if (!account.last_sync_at) return true;
  const last = Date.parse(account.last_sync_at);
  if (Number.isNaN(last)) return true;
  return Date.now() - last >= config.minAccountIntervalMs;
}

function pickNext(running: Account[]): Account | undefined {
  if (running.length === 0) return undefined;
  state.cycleTotal = running.length;
  for (let i = 0; i < running.length; i++) {
    const idx = (state.cursor + i) % running.length;
    const account = running[idx];
    if (!account) continue;
    if (!isDue(account)) continue;
    state.cursor = (idx + 1) % running.length;
    return account;
  }
  return undefined;
}

export function getSchedulerSnapshot(): SchedulerSnapshot {
  refillTokens();
  const now = Date.now();
  const backoffSec = Math.max(0, Math.ceil((state.backoffUntil - now) / 1000));
  let phase: SchedulerPhase = "idle";
  let phaseLabel = "Idle";
  if (state.busy && state.activeEmail) {
    phase = "syncing";
    phaseLabel = `Syncing ${state.activeEmail}`;
  } else if (backoffSec > 0) {
    phase = "backoff_429";
    phaseLabel = `429 暂停 ${backoffSec}s`;
  } else if (state.tokens < 1) {
    phase = "waiting_quota";
    phaseLabel = "等待配额";
  }
  const estimatedCycleMin =
    state.lastCycleMs > 0
      ? Math.max(1, Math.round(state.lastCycleMs / 60_000))
      : state.cycleTotal > 0
        ? Math.max(1, Math.ceil(state.cycleTotal / config.syncPerMinute))
        : 0;
  return {
    phase,
    phaseLabel,
    activeEmail: state.activeEmail,
    cycleIndex: state.cycleIndex,
    cycleTotal: state.cycleTotal,
    tokensUsedThisMinute: tokensUsedThisMinute(),
    tokensMax: config.syncPerMinute,
    estimatedCycleMin,
    backoffSec,
    last429At: formatDisplayTime(state.last429At),
    cursorEmail: "",
  };
}

export async function schedulerTick(): Promise<void> {
  if (state.busy) return;
  refillTokens();
  const now = Date.now();
  if (now < state.backoffUntil) return;
  if (state.tokens < 1) return;

  const accounts = await getAllAccounts();
  const running = runningAccounts(accounts);
  state.cycleTotal = running.length;
  const next = pickNext(running);
  if (!next) return;

  state.busy = true;
  state.activeEmail = next.email;
  state.tokens -= 1;
  try {
    const result = await syncAccount(next);
    if (result.kind === "throttle") {
      state.last429At = new Date().toISOString();
      state.backoffUntil = Date.now() + result.retryAfterSec * 1000;
      state.tokens += 1;
      return;
    }
    state.cycleIndex += 1;
    if (state.cycleTotal > 0 && state.cycleIndex >= state.cycleTotal) {
      state.lastCycleMs = Date.now() - state.cycleStartedAt;
      state.cycleIndex = 0;
      state.cycleStartedAt = Date.now();
    }
  } catch (err) {
    console.error(`scheduler sync failed for ${next.email}`, err);
  } finally {
    state.busy = false;
    state.activeEmail = "";
  }
}

export function startScheduler(): void {
  setInterval(() => {
    void schedulerTick();
  }, config.schedulerTickMs);
  void schedulerTick();
}
