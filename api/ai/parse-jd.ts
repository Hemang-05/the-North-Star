import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleAiParseJdRequest } from '../../src/server/aiHandler.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await handleAiParseJdRequest(req, res);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API Serverless Error]:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: `Serverless invocation error: ${message}` }));
    }
  }
}
