import { getAllAccounts } from "../csv/accountStore.js";
import { syncAccount } from "../graph/syncInbox.js";

let running = false;

export async function pollAccounts(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const accounts = await getAllAccounts();
    for (const account of accounts) {
      if (account.status !== "Config-Run") continue;
      try {
        await syncAccount(account);
      } catch (err) {
        console.error(`sync failed for ${account.email}`, err);
      }
    }
  } finally {
    running = false;
  }
}
