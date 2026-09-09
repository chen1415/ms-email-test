import { promises as fs } from "node:fs";
import path from "node:path";
import { config } from "../config.js";

export function tokenAbsPath(tokenFile: string): string {
  return path.join(config.dataDir, tokenFile);
}

export async function saveTokenCache(
  tokenFile: string,
  serialized: string,
): Promise<void> {
  const abs = tokenAbsPath(tokenFile);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const tmp = `${abs}.tmp`;
  await fs.writeFile(tmp, serialized, "utf8");
  await fs.rename(tmp, abs);
}

export async function loadTokenCache(tokenFile: string): Promise<string> {
  const abs = tokenAbsPath(tokenFile);
  try {
    return await fs.readFile(abs, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return "";
    throw err;
  }
}
