/**
 * Prerender script: generates static HTML snapshots for all known routes.
 * Runs after `vite build` via the `postbuild` npm script.
 *
 * Crawlers (Bing, GPTBot, ClaudeBot, etc.) that don't execute JavaScript
 * will receive a fully-rendered HTML page including all JSON-LD structured
 * data, headings, and visible text content.
 */

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { loadEnv, fetchPublishedArticles } from './load-env.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '../dist');
const PORT = 3099;

const ROUTES = [
  '/',
  '/about',
  '/pricing',
  '/partners',
  '/careers',
  '/products',
  '/fec',
  '/rplc',
  '/card/sergii-romashov',
  '/card/daria-ezerovych',
];

// Article routes are dynamic: published slugs come from Supabase at build time.
loadEnv();
const articles = await fetchPublishedArticles();
if (articles.length > 0) {
  ROUTES.push('/articles', ...articles.map((article) => `/articles/${article.slug}`));
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.json': 'application/json',
  '.xml':  'application/xml',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

// Minimal static file server for the dist directory.
const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let filePath = join(DIST, url.pathname);

  // Directory → try index.html
  if (!extname(filePath)) filePath = join(filePath, 'index.html');

  // SPA fallback
  if (!existsSync(filePath)) filePath = join(DIST, 'index.html');

  try {
    const content = readFileSync(filePath);
    const mime = MIME_TYPES[extname(filePath)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

await new Promise((resolve) => server.listen(PORT, resolve));
console.log(`🚀 Static server listening on http://localhost:${PORT}`);

const executablePath =
  process.env.PUPPETEER_EXECUTABLE_PATH ??
  (await chromium.executablePath());

const browser = await puppeteer.launch({
  args: chromium.args,
  executablePath,
  headless: chromium.headless,
});

for (const route of ROUTES) {
  const page = await browser.newPage();

  // Suppress browser console noise
  page.on('console', () => {});
  page.on('pageerror', () => {});

  await page.goto(`http://localhost:${PORT}${route}`, {
    waitUntil: 'networkidle2',
    timeout: 30_000,
  });

  // Allow React + Helmet to fully flush
  await new Promise((r) => setTimeout(r, 600));

  const html = await page.content();

  if (route === '/') {
    writeFileSync(join(DIST, 'index.html'), html, 'utf-8');
  } else {
    const dir = join(DIST, route.slice(1));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html, 'utf-8');
  }

  console.log(`✓ Prerendered ${route}`);
  await page.close();
}

await browser.close();
server.close();
console.log('✅ Prerender complete');
