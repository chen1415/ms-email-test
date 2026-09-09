import { getAccessToken } from "../auth/microsoftAuth.js";
import { updateAccount } from "../csv/accountStore.js";
import {
  findByGraphId,
  insertRedirect,
  markRedirectStatus,
} from "../csv/redirectStore.js";
import { recordDuplicate } from "../stats.js";
import type { Account, RedirectRow } from "../types.js";
import { downloadEml } from "./downloadEml.js";
import {
  GraphError,
  graphJson,
  type GraphDeltaPage,
  type GraphMessage,
} from "./graphClient.js";
import { forwardReady, resendToFastmail } from "../mail/resendToFastmail.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function recipientList(msg: GraphMessage): string {
  return (msg.toRecipients ?? [])
    .map((r) => r.emailAddress?.address ?? "")
    .filter(Boolean)
    .join("; ");
}

async function graphJsonRetry<T>(
  url: string,
  accessToken: string,
): Promise<T> {
  try {
    return await graphJson<T>(url, accessToken);
  } catch (err) {
    if (err instanceof GraphError && err.status === 429) {
      const wait = (err.retryAfterSec ?? 10) * 1000;
      await sleep(wait);
      return graphJson<T>(url, accessToken);
    }
    throw err;
  }
}

export async function maybeForward(row: RedirectRow): Promise<RedirectRow> {
  if (row.redirect_status === "Success") return row;
  if (!forwardReady()) return row;
  try {
    await resendToFastmail(row);
    const updated = await markRedirectStatus(row.id, "Success", {
      redirected_at: new Date().toISOString(),
      last_error: "",
    });
    return updated ?? row;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const updated = await markRedirectStatus(row.id, "Failed", {
      last_error: message.slice(0, 500),
    });
    return updated ?? row;
  }
}

export async function syncAccount(account: Account): Promise<void> {
  if (account.status !== "Config-Run") return;

  let accessToken: string;
  try {
    accessToken = await getAccessToken(account.token_file);
    await updateAccount(account.id, {
      last_error: "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateAccount(account.id, {
      status: "ReauthRequired",
      last_error: message.slice(0, 500),
      error_count: String(Number(account.error_count || 0) + 1),
    });
    return;
  }

  const startUrl =
    account.delta_link ||
    "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta?$select=id,subject,from,toRecipients,receivedDateTime,internetMessageId";

  let url: string | undefined = startUrl;
  let deltaLink = account.delta_link;

  try {
    while (url) {
      const page: GraphDeltaPage = await graphJsonRetry<GraphDeltaPage>(
        url,
        accessToken,
      );
      for (const msg of page.value ?? []) {
        await ingestMessage(account, accessToken, msg);
      }
      url = page["@odata.nextLink"];
      if (page["@odata.deltaLink"]) {
        deltaLink = page["@odata.deltaLink"];
      }
    }

    await updateAccount(account.id, {
      delta_link: deltaLink,
      last_sync_at: new Date().toISOString(),
      last_error: "",
    });
  } catch (err) {
    if (err instanceof GraphError && err.status === 401) {
      await updateAccount(account.id, {
        status: "ReauthRequired",
        last_error: err.message.slice(0, 500),
        error_count: String(Number(account.error_count || 0) + 1),
      });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    const keepRunning =
      err instanceof GraphError && (err.status === 429 || err.status >= 500);
    await updateAccount(account.id, {
      status: keepRunning ? "Config-Run" : "Error",
      last_error: message.slice(0, 500),
      error_count: String(Number(account.error_count || 0) + 1),
    });
  }
}

async function ingestMessage(
  account: Account,
  accessToken: string,
  msg: GraphMessage,
): Promise<void> {
  if (!msg.id) return;
  const existing = await findByGraphId(account.id, msg.id);
  if (existing) {
    recordDuplicate();
    if (existing.redirect_status !== "Success" && forwardReady()) {
      let row = existing;
      if (!row.eml_path) {
        try {
          const emlPath = await downloadEml({
            accessToken,
            accountId: account.id,
            graphMessageId: msg.id,
          });
          row =
            (await markRedirectStatus(row.id, row.redirect_status, {
              eml_path: emlPath,
            })) ?? row;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await markRedirectStatus(row.id, "Failed", {
            last_error: `EML: ${message}`.slice(0, 500),
          });
          return;
        }
      }
      await maybeForward(row);
    }
    return;
  }

  const created = await insertRedirect({
    account_id: account.id,
    email: account.email,
    graph_message_id: msg.id,
    internet_message_id: msg.internetMessageId ?? "",
    subject: msg.subject ?? "",
    from_addr: msg.from?.emailAddress?.address ?? "",
    to_addr: recipientList(msg),
    received_at: msg.receivedDateTime ?? "",
    eml_path: "",
    redirect_status: "Seen",
    redirected_at: "",
    last_error: "",
  });

  try {
    const emlPath = await downloadEml({
      accessToken,
      accountId: account.id,
      graphMessageId: msg.id,
    });
    const withEml =
      (await markRedirectStatus(created.id, "Seen", {
        eml_path: emlPath,
        last_error: "",
      })) ?? created;
    await maybeForward(withEml);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markRedirectStatus(created.id, "Failed", {
      last_error: `EML: ${message}`.slice(0, 500),
    });
  }
}
