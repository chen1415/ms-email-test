import { Router } from "express";
import { saveTokenCache } from "../auth/tokenStore.js";
import {
  exchangeAuthCode,
  getMicrosoftAuthUrl,
} from "../auth/microsoftAuth.js";
import { msConfigured } from "../config.js";
import { upsertAccountByEmail } from "../csv/accountStore.js";
import { graphJson, type GraphMe } from "../graph/graphClient.js";

export const authRouter = Router();

authRouter.get("/microsoft", async (req, res, next) => {
  try {
    if (!msConfigured()) {
      res.status(500).send("Missing MS_CLIENT_ID / MS_CLIENT_SECRET in .env");
      return;
    }
    const url = await getMicrosoftAuthUrl(req.session);
    res.redirect(url);
  } catch (err) {
    next(err);
  }
});

authRouter.get("/microsoft/callback", async (req, res, next) => {
  try {
    const code = String(req.query.code ?? "");
    const state = String(req.query.state ?? "");
    const error = req.query.error;
    if (error) {
      res
        .status(400)
        .send(`Microsoft OAuth error: ${String(error)} ${String(req.query.error_description ?? "")}`);
      return;
    }
    const { accessToken, serializedCache } = await exchangeAuthCode({
      code,
      state,
      session: req.session,
    });
    const me = await graphJson<GraphMe>(
      "https://graph.microsoft.com/v1.0/me",
      accessToken,
    );
    const email = (me.mail || me.userPrincipalName || "").trim();
    if (!email) {
      throw new Error("Graph /me did not return an email");
    }
    const account = await upsertAccountByEmail({
      email,
      microsoft_user_id: me.id ?? "",
      statusIfNew: "Running",
    });
    await saveTokenCache(account.token_file, serializedCache);
    res.redirect("/");
  } catch (err) {
    next(err);
  }
});
