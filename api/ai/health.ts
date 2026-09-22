import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleAiHealthRequest } from '../../src/server/aiHandler.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    handleAiHealthRequest(req, res);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[API Serverless Error]:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'error', error: message }));
    }
  }
}
