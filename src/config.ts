import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(rootDir, ".env") });

function env(name: string, fallback = ""): string {
  return process.env[name]?.trim() ?? fallback;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  rootDir,
  port: envInt("PORT", 3000),
  msClientId: env("MS_CLIENT_ID"),
  msClientSecret: env("MS_CLIENT_SECRET"),
  msTenant: env("MS_TENANT", "consumers"),
  msRedirectUri: env(
    "MS_REDIRECT_URI",
    "https://YOUR-NGROK-HOST/auth/microsoft/callback",
  ),
  dashboardPassword: env("DASHBOARD_PASSWORD", "123456"),
  syncPerMinute: envInt("SYNC_PER_MINUTE", 20),
  minAccountIntervalMs: envInt("MIN_ACCOUNT_INTERVAL_MS", 60_000),
  schedulerTickMs: envInt("SCHEDULER_TICK_MS", 1_000),
  enableForward: env("ENABLE_FORWARD", "false").toLowerCase() === "true",
  smtpHost: env("SMTP_HOST"),
  smtpPort: envInt("SMTP_PORT", 587),
  smtpUser: env("SMTP_USER"),
  smtpPass: env("SMTP_PASS"),
  forwardTo: env("FORWARD_TO"),
  smtpFrom: env("SMTP_FROM"),
  dataDir: path.join(rootDir, "data"),
  tokensDir: path.join(rootDir, "data", "tokens"),
  emlDir: path.join(rootDir, "storage", "eml"),
  accountsCsv: path.join(rootDir, "data", "outlook_accounts.csv"),
  redirectsCsv: path.join(rootDir, "data", "outlook_redirects.csv"),
  scopes: ["openid", "profile", "offline_access", "User.Read", "Mail.Read"],
};

export function msConfigured(): boolean {
  return Boolean(config.msClientId && config.msClientSecret);
}
