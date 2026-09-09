import { ConfidentialClientApplication, CryptoProvider } from "@azure/msal-node";
import type { Session } from "express-session";
import { config } from "../config.js";
import { loadTokenCache, saveTokenCache } from "./tokenStore.js";

type OAuthSession = Session & {
  oauth?: { verifier: string; state: string };
};

const cryptoProvider = new CryptoProvider();

function createCca(): ConfidentialClientApplication {
  return new ConfidentialClientApplication({
    auth: {
      clientId: config.msClientId,
      authority: `https://login.microsoftonline.com/${config.msTenant}`,
      clientSecret: config.msClientSecret,
    },
  });
}

export async function getMicrosoftAuthUrl(session: Session): Promise<string> {
  const { verifier, challenge } = await cryptoProvider.generatePkceCodes();
  const state = cryptoProvider.createNewGuid();
  const oauthSession = session as OAuthSession;
  oauthSession.oauth = { verifier, state };
  const cca = createCca();
  return cca.getAuthCodeUrl({
    scopes: config.scopes,
    redirectUri: config.msRedirectUri,
    codeChallenge: challenge,
    codeChallengeMethod: "S256",
    state,
    prompt: "select_account",
  });
}

export async function exchangeAuthCode(input: {
  code: string;
  state: string;
  session: Session;
}): Promise<{ accessToken: string; serializedCache: string }> {
  const oauth = (input.session as OAuthSession).oauth;
  if (!oauth || oauth.state !== input.state) {
    throw new Error("OAuth state mismatch");
  }
  const cca = createCca();
  const result = await cca.acquireTokenByCode({
    code: input.code,
    scopes: config.scopes,
    redirectUri: config.msRedirectUri,
    codeVerifier: oauth.verifier,
  });
  if (!result?.accessToken) {
    throw new Error("No access token from Microsoft");
  }
  (input.session as OAuthSession).oauth = undefined;
  return {
    accessToken: result.accessToken,
    serializedCache: cca.getTokenCache().serialize(),
  };
}

export async function getAccessToken(tokenFile: string): Promise<string> {
  const cca = createCca();
  const raw = await loadTokenCache(tokenFile);
  if (!raw) {
    throw new Error("Token cache file is missing");
  }
  cca.getTokenCache().deserialize(raw);
  const accounts = await cca.getTokenCache().getAllAccounts();
  const account = accounts[0];
  if (!account) {
    throw new Error("No cached Microsoft account");
  }
  const result = await cca.acquireTokenSilent({
    account,
    scopes: config.scopes,
    forceRefresh: false,
  });
  if (!result?.accessToken) {
    throw new Error("Silent token refresh returned empty token");
  }
  await saveTokenCache(tokenFile, cca.getTokenCache().serialize());
  return result.accessToken;
}
