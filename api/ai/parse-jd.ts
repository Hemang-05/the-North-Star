import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleAiParseJdRequest } from '../../src/server/aiHandler.ts';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await handleAiParseJdRequest(req, res);
}
