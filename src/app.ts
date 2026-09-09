import path from "node:path";
import { promises as fs } from "node:fs";
import express from "express";
import session from "express-session";
import { config, msConfigured } from "./config.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { authRouter } from "./routes/auth.js";
import { accountsRouter } from "./routes/accounts.js";
import { messagesRouter } from "./routes/messages.js";
import { pollAccounts } from "./worker/pollAccounts.js";
import { withCsvFile } from "./csv/csvFile.js";
import { ACCOUNT_COLUMNS, REDIRECT_COLUMNS } from "./types.js";

async function ensureStorage(): Promise<void> {
  await fs.mkdir(config.tokensDir, { recursive: true });
  await fs.mkdir(config.emlDir, { recursive: true });
  await withCsvFile(config.accountsCsv, ACCOUNT_COLUMNS, (rows) => rows);
  await withCsvFile(config.redirectsCsv, REDIRECT_COLUMNS, (rows) => rows);
}

async function main(): Promise<void> {
  await ensureStorage();

  const app = express();
  app.set("trust proxy", 1);
  app.set("view engine", "ejs");
  app.set("views", path.join(config.rootDir, "views"));
  app.use(express.urlencoded({ extended: false }));
  app.use(
    session({
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      proxy: true,
      cookie: { httpOnly: true, secure: "auto", sameSite: "lax" },
    }),
  );

  app.use((_req, res, next) => {
    res.locals.msConfigured = msConfigured();
    res.locals.enableForward = config.enableForward;
    next();
  });

  app.use(dashboardRouter);
  app.use("/auth", authRouter);
  app.use("/account", accountsRouter);
  app.use("/message", messagesRouter);

  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).send(`<pre>${message}</pre>`);
    },
  );

  app.listen(config.port, () => {
    console.log(`ms-email-test listening on http://localhost:${config.port}`);
    console.log(`OAuth redirect: ${config.msRedirectUri}`);
    if (!msConfigured()) {
      console.log("MS_CLIENT_ID / MS_CLIENT_SECRET not set. Add Outlook will fail until .env is filled.");
    }
    if (config.pollIntervalMs > 0) {
      setInterval(() => {
        void pollAccounts();
      }, config.pollIntervalMs);
    }
  });
}

void main();
