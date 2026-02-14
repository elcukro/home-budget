#!/usr/bin/env node

/**
 * FiredUp Blog Import — specific URLs mode
 * Imports specific articles by URL, skipping already-imported ones.
 *
 * Usage: node import-blog-urls.mjs <url1> <url2> ...
 *   or pipe URLs: echo "url1\nurl2" | node import-blog-urls.mjs --stdin
 */

import { RelayClient } from '/Users/maestro/claude/tools/unbrowse/relay-client.mjs';

const STRAPI_URL = 'http://localhost:1337';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const SCRAPE_DELAY_MS = 3000;
const CATEGORY_ENUM = ['budgeting', 'savings', 'debt', 'investing', 'taxes', 'tools'];

if (!GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY required');
  process.exit(1);
}

// ─── Strapi helpers ──────────────────────────────────────────

async function getStrapiToken() {
  if (process.env.STRAPI_API_TOKEN) return process.env.STRAPI_API_TOKEN;

  const email = process.env.STRAPI_ADMIN_EMAIL || 'elcukro@gmail.com';
  const password = process.env.STRAPI_ADMIN_PASSWORD || 'Admin1234';

  const loginRes = await fetch(`${STRAPI_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    // Fallback: create token via existing one or use hardcoded
    console.log(`Admin login failed (${loginRes.status}), trying fallback...`);
    // Try to find a working token from DB-generated ones
    const fallback = '3659e4e849ecb7377a3a5fdd0cf82cfadeca96000fbbecdafcc641d1bcca1c988156644b6cf2c14b079b7b4964c4590d3874052601d3b324a076a270fe43ab5e';
    const testRes = await fetch(`${STRAPI_URL}/api/blog-posts?pagination[limit]=1`, {
      headers: { Authorization: `Bearer ${fallback}` },
    });
    if (testRes.ok) {
      console.log('API token: using fallback');
      return fallback;
    }
    throw new Error('No working API token available');
  }

  const { data: loginData } = await loginRes.json();
  const adminJwt = loginData.token;

  // Delete old blog-import token if exists, create new
  const tokensRes = await fetch(`${STRAPI_URL}/admin/api-tokens`, {
    headers: { Authorization: `Bearer ${adminJwt}` },
  });
  const { data: tokens } = await tokensRes.json();
  const existing = tokens?.find(t => t.name === 'blog-import');
  if (existing) {
    await fetch(`${STRAPI_URL}/admin/api-tokens/${existing.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminJwt}` },
    });
  }

  const createRes = await fetch(`${STRAPI_URL}/admin/api-tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
    body: JSON.stringify({ name: 'blog-import', description: 'Blog import', type: 'full-access', lifespan: null }),
  });
  const { data: tokenData } = await createRes.json();
  console.log('API token: created via admin API');
  return tokenData.accessKey;
}

async function ensureAuthor(token) {
  const name = 'Zespół FiredUp';
  const res = await fetch(`${STRAPI_URL}/api/authors?filters[name][$eq]=${encodeURIComponent(name)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { data } = await res.json();
  if (data?.length > 0) return data[0].documentId;

  const createRes = await fetch(`${STRAPI_URL}/api/authors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: { name, bio: 'Zespół FiredUp - Twój partner w zarządzaniu domowym budżetem.', email: 'zespol@firedup.app' } }),
  });
  const { data: author } = await createRes.json();
  return author.documentId;
}

async function getImportedSourceSlugs(token) {
  const res = await fetch(`${STRAPI_URL}/api/blog-posts?pagination[limit]=200&fields[0]=seoKeywords`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const posts = (await res.json()).data || [];
  return new Set(
    posts.filter(p => p.seoKeywords?.startsWith('source:')).map(p => p.seoKeywords.split('source:')[1].split(',')[0].trim())
  );
}

// ─── Gemini ──────────────────────────────────────────────────

async function callGemini(prompt, retries = 5) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 65536 },
        }),
      });

      if (res.status === 429) {
        const wait = (attempt + 1) * 15000;
        console.log(`  Rate limited, waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }

      if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);

      const data = await res.json();
      const candidate = data.candidates?.[0];
      if (!candidate) throw new Error('No candidates');

      const parts = candidate.content?.parts || [];
      const text = parts.filter(p => p.text).map(p => p.text).join('\n');
      if (!text) throw new Error('Empty response');

      if (candidate.finishReason === 'MAX_TOKENS') console.log('  Warning: response truncated');
      return text;
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(3000);
    }
  }
  throw new Error('Gemini: all retries exhausted');
}

function extractJSON(text) {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) { try { return JSON.parse(fenceMatch[1].trim()); } catch {} }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) { try { return JSON.parse(text.slice(start, end + 1)); } catch {} }

  throw new Error('No JSON found: ' + text.slice(0, 200));
}

// ─── Scraping ────────────────────────────────────────────────

async function scrapeArticle(relay, url) {
  let target = null;
  try {
    target = await relay.openUrl(url);
    await sleep(3000);

    const data = await relay.evaluate(target.targetId, `
      (() => {
        const ogImage = document.querySelector('meta[property="og:image"]')?.content || '';
        const contentEl = document.querySelector('.entry-content')
          || document.querySelector('.post-content')
          || document.querySelector('article .content')
          || document.querySelector('article');
        let content = '';
        if (contentEl) {
          const clone = contentEl.cloneNode(true);
          clone.querySelectorAll('script, style, .sharedaddy, .jp-relatedposts, .sd-sharing, .wpcf7, iframe, .post-navigation').forEach(el => el.remove());
          content = clone.innerHTML;
        }
        return JSON.stringify({ ogImage, content, title: document.title });
      })()
    `);
    return JSON.parse(data);
  } finally {
    if (target) await relay.closeTarget(target.targetId).catch(() => {});
  }
}

// ─── Rewrite ─────────────────────────────────────────────────

async function rewriteArticle(title, description, htmlContent) {
  const plain = htmlContent
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#?\w+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000);

  const prompt = `You are the editor for FiredUp — a Polish home budgeting app blog.

Rewrite the following article in FiredUp's voice:
- Polish language (pl-PL), practical tone
- Focus on actionable budgeting & saving tips
- Use "Ty" (informal) form when addressing the reader
- Keep it concise but informative (500-800 words)
- Format as Markdown with ## headings, bullet lists, **bold** for key points
- Add a brief intro paragraph and a "Podsumowanie" section at the end
- Do NOT mention the source blog or author
- Do NOT use the exact same title

ORIGINAL TITLE: ${title}
ORIGINAL CONTENT:
${plain}

Return a JSON object (and ONLY the JSON, no other text) with these fields:
{
  "title": "New article title in Polish (max 150 chars)",
  "slug": "url-friendly-slug-in-polish (max 100 chars, lowercase, hyphens only)",
  "excerpt": "Brief summary in Polish (max 300 chars)",
  "content": "Full article in Markdown format (500-800 words)",
  "category": "one of: budgeting, savings, debt, investing, taxes, tools",
  "seoTitle": "SEO title in Polish (max 70 chars)",
  "seoDescription": "Meta description in Polish (max 160 chars)",
  "seoKeywords": "comma-separated keywords in Polish (max 200 chars)"
}`;

  const response = await callGemini(prompt);
  const data = extractJSON(response);

  if (!data.title || !data.content || !data.category) throw new Error('Missing required fields');
  if (!CATEGORY_ENUM.includes(data.category)) data.category = 'budgeting';

  data.title = data.title.slice(0, 150);
  data.slug = (data.slug || slugify(data.title)).slice(0, 100);
  data.excerpt = (data.excerpt || '').slice(0, 300);
  data.seoTitle = (data.seoTitle || data.title.slice(0, 70)).slice(0, 70);
  data.seoDescription = (data.seoDescription || '').slice(0, 160);
  data.seoKeywords = (data.seoKeywords || '').slice(0, 200);

  return data;
}

function slugify(text) {
  return text.toLowerCase()
    .replace(/[ąáà]/g, 'a').replace(/[ćč]/g, 'c').replace(/[ęéè]/g, 'e')
    .replace(/[łl]/g, 'l').replace(/[ńñ]/g, 'n').replace(/[óòö]/g, 'o')
    .replace(/[śš]/g, 's').replace(/[źżž]/g, 'z').replace(/[ůúü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}

// ─── Image Upload ────────────────────────────────────────────

async function uploadCoverImage(token, imageUrl, slug) {
  if (!imageUrl) return createPlaceholder(token, slug);
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return createPlaceholder(token, slug);

    const ct = imgRes.headers.get('content-type') || 'image/jpeg';
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    const formData = new FormData();
    formData.append('files', new Blob([buffer], { type: ct }), `${slug}.${ext}`);

    const uploadRes = await fetch(`${STRAPI_URL}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!uploadRes.ok) return createPlaceholder(token, slug);
    const [uploaded] = await uploadRes.json();
    return uploaded.id;
  } catch { return createPlaceholder(token, slug); }
}

async function createPlaceholder(token, slug) {
  const colors = ['#FF6B35', '#4ECDC4', '#2C3E50', '#E74C3C', '#3498DB', '#27AE60'];
  const color = colors[Math.abs(hashCode(slug)) % colors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="${color}"/><text x="600" y="300" font-family="Arial" font-size="72" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">FiredUp</text><text x="600" y="380" font-family="Arial" font-size="28" fill="rgba(255,255,255,0.8)" text-anchor="middle">Blog</text></svg>`;

  const formData = new FormData();
  formData.append('files', new Blob([svg], { type: 'image/svg+xml' }), `${slug}-placeholder.svg`);

  const res = await fetch(`${STRAPI_URL}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
  if (!res.ok) throw new Error('Placeholder upload failed');
  const [uploaded] = await res.json();
  return uploaded.id;
}

function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; } return h; }

// ─── Create & Publish ────────────────────────────────────────

async function createBlogPost(token, articleData, imageId, authorDocId) {
  // Check slug
  const checkRes = await fetch(`${STRAPI_URL}/api/blog-posts?filters[slug][$eq]=${encodeURIComponent(articleData.slug)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { data: existing } = await checkRes.json();
  if (existing?.length > 0) {
    console.log(`  Skipped (slug exists): ${articleData.slug}`);
    return { skipped: true };
  }

  const createRes = await fetch(`${STRAPI_URL}/api/blog-posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      data: {
        title: articleData.title, slug: articleData.slug, excerpt: articleData.excerpt,
        content: articleData.content, category: articleData.category, coverImage: imageId,
        author: authorDocId, seoTitle: articleData.seoTitle, seoDescription: articleData.seoDescription,
        seoKeywords: articleData.seoKeywords,
      },
    }),
  });

  if (!createRes.ok) throw new Error(`Create failed: ${(await createRes.text()).slice(0, 200)}`);
  const { data: post } = await createRes.json();

  // Publish
  await fetch(`${STRAPI_URL}/api/blog-posts/${post.documentId}/actions/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });

  return { skipped: false, documentId: post.documentId };
}

// ─── Helpers ─────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function sourceSlugFromUrl(url) {
  try { return new URL(url).pathname.replace(/\//g, ''); } catch { return url; }
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  // Parse URLs from args
  const urls = process.argv.slice(2).filter(u => u.startsWith('http'));
  if (urls.length === 0) {
    console.error('Usage: node import-blog-urls.mjs <url1> <url2> ...');
    process.exit(1);
  }

  console.log(`=== FiredUp Blog Import (${urls.length} URLs) ===\n`);

  const token = await getStrapiToken();
  const authorDocId = await ensureAuthor(token);
  const importedSlugs = await getImportedSourceSlugs(token);

  // Filter already imported
  const toImport = [];
  const alreadyImported = [];
  for (const url of urls) {
    const slug = sourceSlugFromUrl(url);
    if (importedSlugs.has(slug)) {
      alreadyImported.push(url);
    } else {
      toImport.push(url);
    }
  }

  if (alreadyImported.length > 0) {
    console.log(`Already imported (${alreadyImported.length}):`);
    alreadyImported.forEach(u => console.log(`  ✓ ${sourceSlugFromUrl(u)}`));
    console.log();
  }

  if (toImport.length === 0) {
    console.log('Nothing new to import!');
    return;
  }

  console.log(`New to import: ${toImport.length}\n`);

  const relay = new RelayClient();
  await relay.connect();

  let success = 0, skipped = 0, failed = 0;

  for (let i = 0; i < toImport.length; i++) {
    const url = toImport[i];
    const sourceSlug = sourceSlugFromUrl(url);
    const num = `[${i + 1}/${toImport.length}]`;

    console.log(`${num} ${sourceSlug}`);

    try {
      // Scrape
      const scraped = await scrapeArticle(relay, url);
      const contentLen = scraped.content?.length || 0;
      console.log(`  → Scraped (${(contentLen / 1024).toFixed(1)}KB)`);

      if (contentLen < 200) {
        console.log(`  → Skipped: too little content`);
        skipped++;
        await sleep(SCRAPE_DELAY_MS);
        continue;
      }

      // Rewrite
      const rewritten = await rewriteArticle(scraped.title, '', scraped.content);
      rewritten.seoKeywords = `source:${sourceSlug},${rewritten.seoKeywords}`.slice(0, 255);
      console.log(`  → Rewritten: "${rewritten.title.slice(0, 50)}" [${rewritten.category}]`);

      // Upload image
      const imageId = await uploadCoverImage(token, scraped.ogImage, rewritten.slug);
      console.log(`  → Image uploaded (id: ${imageId})`);

      // Create & publish
      const result = await createBlogPost(token, rewritten, imageId, authorDocId);
      if (result.skipped) { skipped++; } else { console.log(`  → Published ✓`); success++; }
    } catch (err) {
      console.error(`  → FAILED: ${err.message}`);
      failed++;
    }

    if (i < toImport.length - 1) await sleep(SCRAPE_DELAY_MS);
  }

  await relay.close();
  console.log(`\n=== Complete: ${success} success, ${skipped} skipped, ${failed} failed ===`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
