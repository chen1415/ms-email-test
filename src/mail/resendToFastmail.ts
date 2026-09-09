import { createTransport } from "nodemailer";
import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import type { RedirectRow } from "../types.js";

export function forwardReady(): boolean {
  return Boolean(
    config.enableForward &&
      config.smtpHost &&
      config.smtpUser &&
      config.smtpPass &&
      config.forwardTo,
  );
}

export async function resendToFastmail(row: RedirectRow): Promise<void> {
  if (!row.eml_path) {
    throw new Error("No EML path to forward");
  }
  const abs = path.join(config.rootDir, row.eml_path);
  const raw = await fs.readFile(abs);
  const from = config.smtpFrom || config.smtpUser;
  const transport = createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: { user: config.smtpUser, pass: config.smtpPass },
  });
  await transport.sendMail({
    envelope: { from, to: config.forwardTo },
    raw,
  });
}
