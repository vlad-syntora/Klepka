/**
 * Sitemap generator: extends the static sitemap from public/ with the
 * articles list page and every published article. Runs after prerender
 * via the `postbuild` npm script and overwrites dist/sitemap.xml.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadEnv, fetchPublishedArticles } from './load-env.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SITE_URL = 'https://klepka.solutions';

loadEnv();

const articles = await fetchPublishedArticles();

const baseSitemap = readFileSync(join(ROOT, 'public/sitemap.xml'), 'utf-8');

const today = new Date().toISOString().slice(0, 10);

const entries = [
  `  <url>\n    <loc>${SITE_URL}/articles</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
  ...articles.map((article) => {
    const lastmod = (article.updated_at ?? today).slice(0, 10);
    return `  <url>\n    <loc>${SITE_URL}/articles/${article.slug}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`;
  }),
];

const sitemap = baseSitemap.replace('</urlset>', `${entries.join('\n')}\n</urlset>`);

writeFileSync(join(ROOT, 'dist/sitemap.xml'), sitemap, 'utf-8');
console.log(`✅ Sitemap written with ${articles.length} article route(s)`);
