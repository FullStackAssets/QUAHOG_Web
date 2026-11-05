// Minimal, dependency-free typings for the Vercel Node serverless handlers in
// this folder. The functions run on Vercel's Node runtime; rather than pull in
// `@vercel/node` just for types, we model the small surface we actually use so
// handlers can drop `req: any, res: any` in favour of real types.

export interface ApiRequest {
  method?: string;
  /** Parsed query string (Vercel populates this from the URL). */
  query?: Record<string, string | string[] | undefined>;
  /** Request headers (lower-cased keys). */
  headers: Record<string, string | string[] | undefined>;
  /** Body may arrive pre-parsed (object) or as a raw string, depending on config. */
  body?: unknown;
  /** Present when bodyParser is disabled (raw stream); async-iterable of chunks. */
  [Symbol.asyncIterator]?: () => AsyncIterator<Buffer | string>;
  socket?: { remoteAddress?: string };
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  send(body: string | Buffer): void;
  setHeader(name: string, value: string): void;
}

/** A typed Vercel-style serverless handler. */
export type ApiHandler = (req: ApiRequest, res: ApiResponse) => void | Promise<void>;
