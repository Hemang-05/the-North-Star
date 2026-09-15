import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { handleAiAnalyzeRequest, handleAiParseJdRequest } from './src/server/aiHandler.ts';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables (including non-VITE_ prefixed like GEMINI_API_KEY)
  const env = loadEnv(mode, process.cwd(), '');
  if (env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  }

  const handleAiApi = async (req: any, res: any, next: any) => {
    const rawUrl = req.originalUrl || req.url || '/';
    const parsedUrl = new URL(rawUrl, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname.replace(/\/+$/, '');

    if (pathname === '/api/ai/health') {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      res.end(JSON.stringify({
        status: 'ok',
        model: 'gemini-3.7-flash',
      }));
      return;
    }

    if (pathname === '/api/ai/analyze') {
      await handleAiAnalyzeRequest(req, res);
      return;
    }

    if (pathname === '/api/ai/parse-jd') {
      await handleAiParseJdRequest(req, res);
      return;
    }

    next();
  };

  const aiApiPlugin = {
    name: 'personal-os-ai-api',
    configureServer(server: any) {
      server.middlewares.use(handleAiApi);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(handleAiApi);
    },
  };

  return {
    plugins: [react(), aiApiPlugin],
  };
});
