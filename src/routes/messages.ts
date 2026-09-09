import path from "node:path";
import { Router } from "express";
import { config } from "../config.js";
import { getRedirectById } from "../csv/redirectStore.js";
import { maybeForward } from "../graph/syncInbox.js";
import { forwardReady } from "../mail/resendToFastmail.js";

export const messagesRouter = Router();

messagesRouter.get("/:id", async (req, res, next) => {
  try {
    const message = await getRedirectById(req.params.id);
    if (!message) {
      res.status(404).send("Message not found");
      return;
    }
    res.render("message", { message, forwardReady: forwardReady() });
  } catch (err) {
    next(err);
  }
});

messagesRouter.get("/:id/eml", async (req, res, next) => {
  try {
    const message = await getRedirectById(req.params.id);
    if (!message?.eml_path) {
      res.status(404).send("EML not downloaded");
      return;
    }
    res.download(path.join(config.rootDir, message.eml_path));
  } catch (err) {
    next(err);
  }
});

messagesRouter.post("/:id/retry-forward", async (req, res, next) => {
  try {
    const message = await getRedirectById(req.params.id);
    if (!message) {
      res.status(404).send("Message not found");
      return;
    }
    if (message.redirect_status === "Success") {
      res.redirect(`/message/${message.id}`);
      return;
    }
    await maybeForward(message);
    res.redirect(`/message/${message.id}`);
  } catch (err) {
    next(err);
  }
});
