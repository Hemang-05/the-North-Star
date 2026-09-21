import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleAiAnalyzeRequest } from '../../src/server/aiHandler.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleAiAnalyzeRequest(req, res);
}
