import { Router } from "express";
import {
  getAccountById,
  updateAccount,
} from "../csv/accountStore.js";
import { getRedirectsByAccountId } from "../csv/redirectStore.js";
import { syncAccount } from "../graph/syncInbox.js";

export const accountsRouter = Router();

accountsRouter.post("/:id/start", async (req, res, next) => {
  try {
    const account = await getAccountById(req.params.id);
    if (!account) {
      res.status(404).send("Account not found");
      return;
    }
    await updateAccount(account.id, { status: "Config-Run" });
    res.redirect(`/account/${account.id}`);
  } catch (err) {
    next(err);
  }
});

accountsRouter.post("/:id/disable", async (req, res, next) => {
  try {
    const account = await getAccountById(req.params.id);
    if (!account) {
      res.status(404).send("Account not found");
      return;
    }
    await updateAccount(account.id, { status: "Disabled" });
    res.redirect(`/account/${account.id}`);
  } catch (err) {
    next(err);
  }
});

accountsRouter.post("/:id/sync", async (req, res, next) => {
  try {
    const account = await getAccountById(req.params.id);
    if (!account) {
      res.status(404).send("Account not found");
      return;
    }
    if (account.status !== "Config-Run") {
      await updateAccount(account.id, { status: "Config-Run" });
    }
    const latest = await getAccountById(account.id);
    if (latest) await syncAccount(latest);
    res.redirect(`/account/${account.id}`);
  } catch (err) {
    next(err);
  }
});

accountsRouter.get("/:id", async (req, res, next) => {
  try {
    const account = await getAccountById(req.params.id);
    if (!account) {
      res.status(404).send("Account not found");
      return;
    }
    const messages = await getRedirectsByAccountId(account.id);
    res.render("account", { account, messages });
  } catch (err) {
    next(err);
  }
});
