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
  sessionSecret: env("SESSION_SECRET", "dev-session-secret"),
  msClientId: env("MS_CLIENT_ID"),
  msClientSecret: env("MS_CLIENT_SECRET"),
  msTenant: env("MS_TENANT", "consumers"),
  msRedirectUri: env(
    "MS_REDIRECT_URI",
    "http://localhost:3000/auth/microsoft/callback",
  ),
  pollIntervalMs: envInt("POLL_INTERVAL_MS", 180_000),
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
