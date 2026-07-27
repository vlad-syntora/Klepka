import { defineConfig, loadEnv, type Plugin } from 'vite'
import path from 'path'
import fs from 'fs'
import type { IncomingMessage, ServerResponse } from 'http'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Dev-only: run the api/ serverless functions inside the Vite dev server, so `npm run dev`
// can serve /api/* without `vercel dev` (which conflicts with Vite 6 and mangles module
// requests into index.html). We shim just enough of the @vercel/node contract — a JSON-parsed
// req.body and a chainable res.status().json(). `apply: 'serve'` keeps this out of the build.
function vercelApiDev(): Plugin {
  return {
    name: 'vercel-api-dev',
    apply: 'serve',
    configureServer(server) {
      // Load every var from .env / .env.local (not just VITE_*) so the functions can read
      // SUPABASE_SERVICE_ROLE_KEY, GOOGLE_OAUTH_* etc. — the same names Vercel injects.
      const env = loadEnv('development', process.cwd(), '')
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value
      }

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/')) return next()

        const pathname = url.split('?')[0]
        // Only handle file-backed .ts functions (e.g. /api/google/drive -> api/google/drive.ts).
        // Anything else (like the proxied /api/listings) falls through untouched.
        const file = path.join(process.cwd(), `${pathname}.ts`)
        if (!fs.existsSync(file)) return next()

        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk as Buffer)
        const raw = Buffer.concat(chunks).toString('utf8')
        const isJson = (req.headers['content-type'] ?? '').includes('json')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(req as any).body = raw && isJson ? JSON.parse(raw) : raw || undefined

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shim = res as any
        shim.status = (code: number) => {
          res.statusCode = code
          return shim
        }
        shim.json = (payload: unknown) => {
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(payload))
          return shim
        }

        try {
          const mod = await server.ssrLoadModule(file)
          await mod.default(req, res)
        } catch (error) {
          server.config.logger.error(`[api] ${pathname} failed: ${String(error)}`)
          if (!res.writableEnded) {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
            res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Function error' }))
          }
        }
      })
    },
  }
}

export default defineConfig({
  server: {
    proxy: {
      '/api/listings': {
        target: 'https://api.appexchange.salesforce.com/partners/experience/listings',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/listings/, ''),
      },
    },
  },
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    vercelApiDev(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
})
