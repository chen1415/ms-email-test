import { Router } from "express";
import type { Request } from "express";
import { config, msConfigured } from "../config.js";
import { getAllAccounts } from "../csv/accountStore.js";
import { getAllRedirects } from "../csv/redirectStore.js";
import { graphStats } from "../stats.js";
import { forwardReady } from "../mail/resendToFastmail.js";
import { getSchedulerSnapshot } from "../worker/scheduler.js";

type GateSession = { unlocked?: boolean };

export const dashboardRouter = Router();

dashboardRouter.get("/login", (req, res) => {
  if ((req.session as GateSession).unlocked) {
    res.redirect("/");
    return;
  }
  res.render("login", { error: false });
});

dashboardRouter.post("/login", (req, res) => {
  const password = String((req.body as { password?: string }).password ?? "");
  if (password === config.dashboardPassword) {
    (req.session as GateSession).unlocked = true;
    res.redirect("/");
    return;
  }
  res.status(401).render("login", { error: true });
});

dashboardRouter.get("/api/scheduler", (_req, res) => {
  res.json(getSchedulerSnapshot());
});

dashboardRouter.get("/", async (_req, res, next) => {
  try {
    const accounts = await getAllAccounts();
    const redirects = await getAllRedirects();
    const byStatus = (status: string) =>
      accounts.filter((a) => a.status === status).length;
    res.render("dashboard", {
      accounts,
      scheduler: getSchedulerSnapshot(),
      msConfigured: msConfigured(),
      enableForward: config.enableForward,
      forwardReady: forwardReady(),
      stats: {
        accounts: accounts.length,
        running: byStatus("Running"),
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

export function requireDashboard(req: Request): boolean {
  return Boolean((req.session as GateSession).unlocked);
}
