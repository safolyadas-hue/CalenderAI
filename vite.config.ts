import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';

/**
 * Lightweight Vite plugin that intercepts POST /api/ai-planner during local dev
 * and routes it through the same handleAIPlannerRequest processor used by Netlify,
 * so the backend works identically in `npm run dev` and production without Netlify CLI.
 */
function calenderAiLocalBackend(): Plugin {
  return {
    name: 'calender-ai-local-backend',
    configureServer(server) {
      server.middlewares.use('/api/ai-planner', async (req, res) => {
        // Dynamically import the handler to avoid bundling issues
        const { handleAIPlannerRequest } = await import('./netlify/functions/ai-planner');

        // Collect request body
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', async () => {
          const body = Buffer.concat(chunks).toString('utf-8');

          const result = await handleAIPlannerRequest({
            method: req.method || 'POST',
            body,
            clientIp: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
              || req.socket.remoteAddress
              || '127.0.0.1',
          });

          res.statusCode = result.statusCode;
          for (const [key, value] of Object.entries(result.headers)) {
            res.setHeader(key, value);
          }
          res.end(result.body);
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), calenderAiLocalBackend()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
