import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleAiHealthRequest } from '../../src/server/aiHandler.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  handleAiHealthRequest(req, res);
}
