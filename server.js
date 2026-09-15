// ============================================================================
// PERSONAL OS — Production Server Boundary
// Standalone Node.js HTTP server. Runs production builds and protects GEMINI_API_KEY.
// ============================================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...vals] = trimmed.split('=');
      const val = vals.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

const PORT = Number(process.env.PORT) || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

// Dynamically import compiled or source AI handler
let handleAiAnalyzeRequest;
let handleAiHealthRequest;
let handleAiParseJdRequest;
try {
  const handlerModule = await import('./src/server/aiHandler.ts');
  handleAiAnalyzeRequest = handlerModule.handleAiAnalyzeRequest;
  handleAiHealthRequest = handlerModule.handleAiHealthRequest;
  handleAiParseJdRequest = handlerModule.handleAiParseJdRequest;
} catch {
  console.warn('Could not import TypeScript handler directly; ensure ts-node or compiled handler is used.');
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // AI API Endpoints
  if (pathname === '/api/ai/health') {
    if (handleAiHealthRequest) {
      handleAiHealthRequest(req, res);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify({
        status: 'ok',
        model: 'gemini-3.7-flash',
      }));
    }
    return;
  }

  if (pathname === '/api/ai/analyze') {
    if (handleAiAnalyzeRequest) {
      await handleAiAnalyzeRequest(req, res);
    } else {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: 'AI server handler unavailable' }));
    }
    return;
  }

  if (pathname === '/api/ai/parse-jd') {
    if (handleAiParseJdRequest) {
      await handleAiParseJdRequest(req, res);
    } else {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'AI server handler unavailable' }));
    }
    return;
  }

  // Static File Serving
  let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`[Personal OS Server] Running on http://localhost:${PORT}`);
  console.log(`[Personal OS Server] Gemini Key configured: ${Boolean(process.env.GEMINI_API_KEY)}`);
});
