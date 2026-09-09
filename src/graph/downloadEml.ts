import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import { graphFetch } from "./graphClient.js";

export function emlFileName(accountId: string, graphMessageId: string): string {
  const hash = createHash("sha256")
    .update(graphMessageId)
    .digest("hex")
    .slice(0, 16);
  return `${accountId}-${hash}.eml`;
}

export async function downloadEml(input: {
  accessToken: string;
  accountId: string;
  graphMessageId: string;
}): Promise<string> {
  const url = `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(input.graphMessageId)}/$value`;
  const response = await graphFetch(url, input.accessToken);
  const buf = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(config.emlDir, { recursive: true });
  const name = emlFileName(input.accountId, input.graphMessageId);
  const abs = path.join(config.emlDir, name);
  await fs.writeFile(abs, buf);
  return path.posix.join("storage", "eml", name);
}
