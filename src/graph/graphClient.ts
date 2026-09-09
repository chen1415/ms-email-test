import { recordGraphStatus } from "../stats.js";

export class GraphError extends Error {
  constructor(
    public status: number,
    public body: string,
    public retryAfterSec?: number,
  ) {
    super(`Graph ${status}: ${body.slice(0, 300)}`);
    this.name = "GraphError";
  }
}

function retryAfterSeconds(header: string | null): number | undefined {
  if (!header) return undefined;
  const asInt = Number(header);
  if (Number.isFinite(asInt)) return asInt;
  const when = Date.parse(header);
  if (Number.isNaN(when)) return undefined;
  return Math.max(0, Math.ceil((when - Date.now()) / 1000));
}

export async function graphFetch(
  url: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    recordGraphStatus(response.status);
    const body = await response.text();
    throw new GraphError(
      response.status,
      body,
      retryAfterSeconds(response.headers.get("retry-after")),
    );
  }
  return response;
}

export async function graphJson<T>(
  url: string,
  accessToken: string,
): Promise<T> {
  const response = await graphFetch(url, accessToken);
  return (await response.json()) as T;
}

export type GraphMe = {
  id?: string;
  mail?: string;
  userPrincipalName?: string;
};

export type GraphMessage = {
  id?: string;
  subject?: string;
  internetMessageId?: string;
  receivedDateTime?: string;
  from?: { emailAddress?: { address?: string } };
  toRecipients?: { emailAddress?: { address?: string } }[];
};

export type GraphDeltaPage = {
  value?: GraphMessage[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
};
