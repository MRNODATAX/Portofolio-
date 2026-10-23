import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function localApi(): Plugin {
  const register = (middlewares: any, ssrLoadModule?: (url: string) => Promise<any>) => {
    middlewares.use('/api', async (req: any, res: any, next: any) => {
      const route = req.url?.split('?')[0];
      if (!['/chat', '/health', '/ratings', '/content', '/admin'].includes(route || '')) return next();
      const maxBytes = route === '/content' ? 8 * 1024 * 1024 : 50000;
      let raw = '';
      try {
        for await (const chunk of req) {
          raw += chunk;
          if (Buffer.byteLength(raw) > maxBytes) {
            res.statusCode = 413;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Ukuran data melebihi batas maksimal.' }));
            return;
          }
        }
        req.body = raw ? JSON.parse(raw) : {};
        req.ip = req.socket?.remoteAddress || '127.0.0.1';
        const fullUrl = new URL(req.url || '/', 'http://localhost');
        req.query = Object.fromEntries(fullUrl.searchParams.entries());
        res.status = (status: number) => {
          res.statusCode = status;
          return res;
        };
        res.json = (body: unknown) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(body));
        };
        const fileHref = pathToFileURL(path.resolve(process.cwd(), `api${route}.js`)).href;
        const mod = ssrLoadModule
          ? await ssrLoadModule(`/api${route}.js`)
          : await import(/* @vite-ignore */ fileHref);
        await mod.default(req, res);
      } catch {
        if (!res.writableEnded) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Permintaan tidak valid.' }));
        }
      }
    });
  };

  return {
    name: 'local-vercel-functions',
    configureServer(server) {
      register(server.middlewares, (u) => server.ssrLoadModule(u));
    },
    configurePreviewServer(server) {
      register(server.middlewares);
    },
  };
}

export default defineConfig(({ mode }) => {
  const localEnv = {
    ...loadEnv(mode, process.cwd(), 'CHAT_'),
    ...loadEnv(mode, process.cwd(), 'SUPABASE_'),
    ...loadEnv(mode, process.cwd(), 'UPSTASH_'),
    ...loadEnv(mode, process.cwd(), 'GEMINI_'),
    ...loadEnv(mode, process.cwd(), 'ADMIN_'),
    ...loadEnv(mode, process.cwd(), 'RATING_'),
  };
  for (const [key, value] of Object.entries(localEnv)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return {
    plugins: [react(), localApi()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: true,
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      allowedHosts: true,
    },
    build: {
      target: 'es2022',
      emptyOutDir: true,
    },
  };
});
