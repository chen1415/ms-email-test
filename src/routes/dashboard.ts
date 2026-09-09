import { Router } from "express";
import { getAllAccounts } from "../csv/accountStore.js";
import { getAllRedirects } from "../csv/redirectStore.js";
import { config, msConfigured } from "../config.js";
import { graphStats } from "../stats.js";
import { forwardReady } from "../mail/resendToFastmail.js";
import { syncAccount } from "../graph/syncInbox.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", async (_req, res, next) => {
  try {
    const accounts = await getAllAccounts();
    const redirects = await getAllRedirects();
    const byStatus = (status: string) =>
      accounts.filter((a) => a.status === status).length;
    res.render("dashboard", {
      accounts,
      msConfigured: msConfigured(),
      enableForward: config.enableForward,
      forwardReady: forwardReady(),
      stats: {
        accounts: accounts.length,
        pending: byStatus("Pending"),
        configRun: byStatus("Config-Run"),
        reauth: byStatus("ReauthRequired"),
        error: byStatus("Error"),
        disabled: byStatus("Disabled"),
        messages: redirects.length,
        seen: redirects.filter((r) => r.redirect_status === "Seen").length,
        eml: redirects.filter((r) => Boolean(r.eml_path)).length,
        success: redirects.filter((r) => r.redirect_status === "Success").length,
        failed: redirects.filter((r) => r.redirect_status === "Failed").length,
        duplicatePrevented: graphStats.duplicatePrevented,
        graph401: graphStats.status401,
        graph429: graphStats.status429,
        graph5xx: graphStats.status5xx,
      },
    });
  } catch (err) {
    next(err);
  }
});

dashboardRouter.post("/sync-all", async (_req, res, next) => {
  try {
    const accounts = await getAllAccounts();
    for (const account of accounts) {
      if (account.status !== "Config-Run") continue;
      await syncAccount(account);
    }
    res.redirect("/");
  } catch (err) {
    next(err);
  }
});
