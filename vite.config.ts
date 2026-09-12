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

  const aiApiPlugin = {
    name: 'personal-os-ai-api',
    configureServer(server: any) {
      server.middlewares.use('/api/ai/health', (_req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({
          status: 'ok',
          model: 'gemini-3.7-flash',
        }));
      });

      server.middlewares.use('/api/ai/analyze', async (req: any, res: any) => {
        await handleAiAnalyzeRequest(req, res);
      });

      server.middlewares.use('/api/ai/parse-jd', async (req: any, res: any) => {
        await handleAiParseJdRequest(req, res);
      });
    },
    configurePreviewServer(server: any) {
      server.middlewares.use('/api/ai/health', (_req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({
          status: 'ok',
          model: 'gemini-3.7-flash',
        }));
      });

      server.middlewares.use('/api/ai/analyze', async (req: any, res: any) => {
        await handleAiAnalyzeRequest(req, res);
      });

      server.middlewares.use('/api/ai/parse-jd', async (req: any, res: any) => {
        await handleAiParseJdRequest(req, res);
      });
    },
  };

  return {
    plugins: [react(), aiApiPlugin],
  };
});
