import { defineConfig, loadEnv } from 'vite';
import handler from './api/diagnose.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Populate process.env so api/diagnose.js has OPENROUTER_API_KEY, etc. in dev mode
  Object.assign(process.env, env);

  return {
    plugins: [
      {
        name: 'api-diagnose-dev-middleware',
        configureServer(server) {
          server.middlewares.use('/api/diagnose', async (req, res, next) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Method not allowed' }));
              return;
            }

            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });

            req.on('end', async () => {
              try {
                req.body = body ? JSON.parse(body) : {};
              } catch (e) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Invalid JSON body' }));
                return;
              }

              res.status = (code) => {
                res.statusCode = code;
                return {
                  json: (data) => {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(data));
                  },
                };
              };

              try {
                await handler(req, res);
              } catch (err) {
                console.error('API middleware error:', err);
                if (!res.writableEnded) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
                }
              }
            });
          });
        },
      },
    ],
  };
});
