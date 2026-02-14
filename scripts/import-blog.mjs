#!/usr/bin/env node

/**
 * FiredUp Blog Import Script
 *
 * Scrapes articles from jakoszczedzacpieniadze.pl RSS feed,
 * rewrites them with Gemini AI in FiredUp's voice,
 * and imports into local Strapi CMS.
 *
 * Usage: node ~/claude/repos/home-budget/scripts/import-blog.mjs
 *
 * Environment:
 *   GEMINI_API_KEY         - Required for AI rewriting
 *   STRAPI_API_TOKEN       - Optional, skip admin login if provided
 *   STRAPI_ADMIN_EMAIL     - Admin login (default: admin@firedup.app)
 *   STRAPI_ADMIN_PASSWORD  - Admin password (default: Admin123!)
 */

import { RelayClient } from '/Users/maestro/claude/tools/unbrowse/relay-client.mjs';

const STRAPI_URL = 'http://localhost:1337';
const RSS_URL = 'https://jakoszczedzacpieniadze.pl/feed';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Hardcoded fallback token (generated via DB insert, hashed with API_TOKEN_SALT)
const FALLBACK_TOKEN = '3659e4e849ecb7377a3a5fdd0cf82cfadeca96000fbbecdafcc641d1bcca1c988156644b6cf2c14b079b7b4964c4590d3874052601d3b324a076a270fe43ab5e';

const SCRAPE_DELAY_MS = 3000;
const CATEGORY_ENUM = ['budgeting', 'savings', 'debt', 'investing', 'taxes', 'tools'];

if (!GEMINI_API_KEY) {
  console.error('ERROR: GEMINI_API_KEY environment variable is required');
  process.exit(1);
}

// ─── Strapi Auth ─────────────────────────────────────────────

async function getStrapiToken() {
  // Check env var first
  if (process.env.STRAPI_API_TOKEN) {
    console.log('API token: from environment variable');
    return process.env.STRAPI_API_TOKEN;
  }

  const email = process.env.STRAPI_ADMIN_EMAIL || 'elcukro@gmail.com';
  const password = process.env.STRAPI_ADMIN_PASSWORD || 'Admin1234';

  // Login as admin
  const loginRes = await fetch(`${STRAPI_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    console.log(`Admin login failed (${loginRes.status}), using fallback token`);
    return FALLBACK_TOKEN;
  }

  const { data: loginData } = await loginRes.json();
  const adminJwt = loginData.token;

  // Check for existing "blog-import" token
  const tokensRes = await fetch(`${STRAPI_URL}/admin/api-tokens`, {
    headers: { Authorization: `Bearer ${adminJwt}` },
  });
  const { data: tokens } = await tokensRes.json();
  const existing = tokens?.find(t => t.name === 'blog-import');

  if (existing) {
    // Can't retrieve the actual token value from list, create a new one
    // Delete old one first
    await fetch(`${STRAPI_URL}/admin/api-tokens/${existing.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminJwt}` },
    });
  }

  // Create new full-access token
  const createRes = await fetch(`${STRAPI_URL}/admin/api-tokens`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminJwt}`,
    },
    body: JSON.stringify({
      name: 'blog-import',
      description: 'Auto-generated for blog import script',
      type: 'full-access',
      lifespan: null,
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create API token: ${err}`);
  }

  const { data: tokenData } = await createRes.json();
  console.log('API token: created via admin API');
  return tokenData.accessKey;
}

// ─── Author ──────────────────────────────────────────────────

async function ensureAuthor(token) {
  const name = 'Zespół FiredUp';

  const res = await fetch(
    `${STRAPI_URL}/api/authors?filters[name][$eq]=${encodeURIComponent(name)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const { data } = await res.json();

  if (data && data.length > 0) {
    console.log(`Author: ${name} (exists, documentId: ${data[0].documentId})`);
    return data[0].documentId;
  }

  const createRes = await fetch(`${STRAPI_URL}/api/authors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      data: {
        name,
        bio: 'Zespół FiredUp - Twój partner w zarządzaniu domowym budżetem.',
        email: 'zespol@firedup.app',
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create author: ${err}`);
  }

  const { data: author } = await createRes.json();
  console.log(`Author: ${name} (created, documentId: ${author.documentId})`);
  return author.documentId;
}

// ─── RSS Feed ────────────────────────────────────────────────

async function fetchRSSArticles() {
  const res = await fetch(RSS_URL);
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const xml = await res.text();

  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const getTag = (tag) => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? (m[1] || m[2] || '').trim() : '';
    };

    // Check for podcast enclosure (audio)
    const hasAudio = /<enclosure[^>]+type="audio/i.test(itemXml);

    if (!hasAudio) {
      // Extract categories
      const categories = [];
      const catRegex = /<category[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/category>/g;
      let catMatch;
      while ((catMatch = catRegex.exec(itemXml)) !== null) {
        categories.push(catMatch[1].trim());
      }

      items.push({
        title: getTag('title'),
        link: getTag('link'),
        pubDate: getTag('pubDate'),
        description: getTag('description').replace(/<[^>]+>/g, '').slice(0, 500),
        categories,
      });
    }
  }

  return items;
}

// ─── Gemini API ──────────────────────────────────────────────

async function callGemini(prompt, retries = 5) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 65536,
          },
        }),
      });

      if (res.status === 429) {
        const wait = (attempt + 1) * 15000; // 15s, 30s, 45s, 60s, 75s
        console.log(`  Rate limited, waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini API error ${res.status}: ${err.slice(0, 200)}`);
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      if (!candidate) throw new Error('No candidates in Gemini response');

      // Gemini 2.5 may have multiple parts (thought + text), concat all text parts
      const parts = candidate.content?.parts || [];
      const text = parts.filter(p => p.text).map(p => p.text).join('\n');
      if (!text) throw new Error('Empty Gemini response');

      if (candidate.finishReason === 'MAX_TOKENS') {
        console.log('  Warning: Gemini response truncated (MAX_TOKENS)');
      }

      return text;
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(2000);
    }
  }
  throw new Error('Gemini API: all retries exhausted');
}

function extractJSON(text) {
  // Try to find JSON block in markdown code fence
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    try { return JSON.parse(fenceMatch[1].trim()); } catch {}
  }

  // Try parsing raw text — find outermost { }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }

  // Try array [ ]
  const arrStart = text.indexOf('[');
  const arrEnd = text.lastIndexOf(']');
  if (arrStart !== -1 && arrEnd > arrStart) {
    try { return JSON.parse(text.slice(arrStart, arrEnd + 1)); } catch {}
  }

  throw new Error('No JSON found in Gemini response: ' + text.slice(0, 200));
}

// ─── Relevance Filter ────────────────────────────────────────

async function filterRelevantArticles(articles) {
  const articlesForGemini = articles.map((a, i) => ({
    index: i,
    title: a.title,
    description: a.description.slice(0, 200),
    categories: a.categories.join(', '),
  }));

  const prompt = `You are a content curator for FiredUp - a Polish home budgeting app.

Review these articles from a Polish personal finance blog and select the ones most relevant to home budgeting app users.

INCLUDE articles about:
- Practical budgeting tips, saving money strategies
- Debt management, loan repayment advice
- Tax tips for individuals, PIT declarations
- Financial tools, apps, calculators
- Household expense optimization (bills, subscriptions, groceries)
- Financial planning, emergency funds
- Income optimization, side hustles

EXCLUDE articles about:
- Community/clan promotions, membership drives
- Book/product reviews not related to budgeting
- Investment-heavy content (stocks, ETFs, crypto) - we focus on budgeting
- Podcast episode announcements
- Generic motivational content without practical tips

Articles:
${JSON.stringify(articlesForGemini, null, 2)}

Return a JSON array of indices of selected articles, ordered by relevance (most relevant first).
Target: select 15-20 of the most relevant articles.

Return ONLY a JSON array like: [0, 3, 5, 12, ...]`;

  const response = await callGemini(prompt);
  const indices = extractJSON(response);

  if (!Array.isArray(indices)) throw new Error('Gemini did not return an array');
  return indices.filter(i => typeof i === 'number' && i >= 0 && i < articles.length);
}

// ─── Scraping ────────────────────────────────────────────────

async function scrapeArticle(relay, url) {
  let target = null;
  try {
    target = await relay.openUrl(url);
    await sleep(3000); // Wait for page load

    const data = await relay.evaluate(target.targetId, `
      (() => {
        const ogImage = document.querySelector('meta[property="og:image"]')?.content || '';

        // Try multiple selectors for content
        const contentEl = document.querySelector('.entry-content')
          || document.querySelector('.post-content')
          || document.querySelector('article .content')
          || document.querySelector('article');

        let content = '';
        if (contentEl) {
          // Remove scripts, styles, ads, sharing buttons
          const clone = contentEl.cloneNode(true);
          clone.querySelectorAll('script, style, .sharedaddy, .jp-relatedposts, .sd-sharing, .wpcf7, iframe, .post-navigation').forEach(el => el.remove());
          content = clone.innerHTML;
        }

        return JSON.stringify({
          ogImage,
          content,
          title: document.title,
        });
      })()
    `);

    return JSON.parse(data);
  } finally {
    if (target) {
      await relay.closeTarget(target.targetId).catch(() => {});
    }
  }
}

// ─── AI Rewrite ──────────────────────────────────────────────

async function rewriteArticle(article, scrapedContent) {
  // Strip HTML to get plain text for Gemini (it handles markdown better)
  const plainContent = scrapedContent.content
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#?\w+;/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000); // Limit to avoid token overflow

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

ORIGINAL TITLE: ${article.title}
ORIGINAL DESCRIPTION: ${article.description}
ORIGINAL CONTENT:
${plainContent}

Return a JSON object (and ONLY the JSON, no other text) with these fields:
{
  "title": "New article title in Polish (max 150 chars)",
  "slug": "url-friendly-slug-in-polish (max 100 chars, lowercase, hyphens only)",
  "excerpt": "Brief summary in Polish (max 300 chars)",
  "content": "Full article in Markdown format (500-800 words)",
  "category": "one of: budgeting, savings, debt, investing, taxes, tools",
  "seoTitle": "SEO title in Polish (max 70 chars)",
  "seoDescription": "Meta description in Polish (max 160 chars)",
  "seoKeywords": "comma-separated keywords in Polish (max 255 chars)"
}`;

  const response = await callGemini(prompt);
  const data = extractJSON(response);

  // Validate and truncate fields
  if (!data.title || !data.content || !data.category) {
    throw new Error('Missing required fields in Gemini response');
  }

  if (!CATEGORY_ENUM.includes(data.category)) {
    data.category = 'budgeting'; // Safe fallback
  }

  data.title = data.title.slice(0, 150);
  data.slug = (data.slug || slugify(data.title)).slice(0, 100);
  data.excerpt = (data.excerpt || '').slice(0, 300);
  data.seoTitle = (data.seoTitle || data.title.slice(0, 70)).slice(0, 70);
  data.seoDescription = (data.seoDescription || data.excerpt.slice(0, 160)).slice(0, 160);
  data.seoKeywords = (data.seoKeywords || '').slice(0, 255);

  return data;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[ąáà]/g, 'a').replace(/[ćč]/g, 'c').replace(/[ęéè]/g, 'e')
    .replace(/[łl]/g, 'l').replace(/[ńñ]/g, 'n').replace(/[óòö]/g, 'o')
    .replace(/[śš]/g, 's').replace(/[źżž]/g, 'z').replace(/[ůúü]/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

// ─── Image Upload ────────────────────────────────────────────

async function uploadCoverImage(token, imageUrl, slug) {
  if (!imageUrl) return createPlaceholderImage(token, slug);

  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return createPlaceholderImage(token, slug);

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const filename = `${slug}.${ext}`;

    const formData = new FormData();
    formData.append('files', new Blob([buffer], { type: contentType }), filename);

    const uploadRes = await fetch(`${STRAPI_URL}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.log(`  Image upload failed: ${err.slice(0, 100)}`);
      return createPlaceholderImage(token, slug);
    }

    const [uploaded] = await uploadRes.json();
    return uploaded.id;
  } catch (err) {
    console.log(`  Image download failed: ${err.message}`);
    return createPlaceholderImage(token, slug);
  }
}

async function createPlaceholderImage(token, slug) {
  // Generate a simple SVG placeholder
  const colors = ['#FF6B35', '#4ECDC4', '#2C3E50', '#E74C3C', '#3498DB', '#27AE60'];
  const color = colors[Math.abs(hashCode(slug)) % colors.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${color}"/>
  <text x="600" y="300" font-family="Arial,sans-serif" font-size="72" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">FiredUp</text>
  <text x="600" y="380" font-family="Arial,sans-serif" font-size="28" fill="rgba(255,255,255,0.8)" text-anchor="middle" dominant-baseline="middle">Blog</text>
</svg>`;

  const formData = new FormData();
  formData.append('files', new Blob([svg], { type: 'image/svg+xml' }), `${slug}-placeholder.svg`);

  const uploadRes = await fetch(`${STRAPI_URL}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!uploadRes.ok) throw new Error('Placeholder upload failed');
  const [uploaded] = await uploadRes.json();
  return uploaded.id;
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

// ─── Create & Publish Post ───────────────────────────────────

async function createBlogPost(token, articleData, imageId, authorDocId) {
  // Idempotency: check if slug already exists
  const checkRes = await fetch(
    `${STRAPI_URL}/api/blog-posts?filters[slug][$eq]=${encodeURIComponent(articleData.slug)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const { data: existing } = await checkRes.json();

  if (existing && existing.length > 0) {
    console.log(`  Skipped (slug exists): ${articleData.slug}`);
    return { skipped: true, documentId: existing[0].documentId };
  }

  const postBody = {
    data: {
      title: articleData.title,
      slug: articleData.slug,
      excerpt: articleData.excerpt,
      content: articleData.content,
      category: articleData.category,
      coverImage: imageId,
      author: authorDocId,
      seoTitle: articleData.seoTitle,
      seoDescription: articleData.seoDescription,
      seoKeywords: articleData.seoKeywords,
    },
  };

  const createRes = await fetch(`${STRAPI_URL}/api/blog-posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(postBody),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Create post failed: ${err.slice(0, 200)}`);
  }

  const { data: post } = await createRes.json();

  // Publish the post
  const publishRes = await fetch(
    `${STRAPI_URL}/api/blog-posts/${post.documentId}/actions/publish`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!publishRes.ok) {
    console.log(`  Warning: publish failed for ${post.documentId}`);
  }

  return { skipped: false, documentId: post.documentId };
}

// ─── Helpers ─────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main Pipeline ───────────────────────────────────────────

async function main() {
  console.log('=== FiredUp Blog Import ===\n');

  // Step 1: Get API token
  const token = await getStrapiToken();

  // Step 2: Ensure author
  const authorDocId = await ensureAuthor(token);

  // Step 3: Fetch RSS
  console.log('\nFetching RSS feed...');
  const allArticles = await fetchRSSArticles();
  console.log(`RSS: ${allArticles.length} blog articles found (podcasts filtered out)`);

  if (allArticles.length === 0) {
    console.log('No articles found. Exiting.');
    return;
  }

  // Step 4: Relevance filtering with Gemini
  console.log('\nFiltering for relevance with Gemini...');
  const selectedIndices = await filterRelevantArticles(allArticles);
  const selectedArticles = selectedIndices.map(i => allArticles[i]);
  console.log(`Relevance filter: ${selectedArticles.length} selected for import (${allArticles.length - selectedArticles.length} skipped)\n`);

  // Step 4b: Pre-fetch existing posts to skip already-imported source URLs
  const existingRes = await fetch(
    `${STRAPI_URL}/api/blog-posts?pagination[limit]=100&fields[0]=seoKeywords`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const existingPosts = (await existingRes.json()).data || [];
  // We store source URL slug in seoKeywords as a marker for idempotency
  const importedSourceSlugs = new Set(
    existingPosts
      .filter(p => p.seoKeywords?.startsWith('source:'))
      .map(p => p.seoKeywords.split('source:')[1].split(',')[0].trim())
  );

  // Step 5: Process each article
  const relay = new RelayClient();
  await relay.connect();

  let success = 0, skipped = 0, failed = 0;

  for (let i = 0; i < selectedArticles.length; i++) {
    const article = selectedArticles[i];
    const num = `[${i + 1}/${selectedArticles.length}]`;
    const sourceSlug = new URL(article.link).pathname.replace(/\//g, '');

    console.log(`${num} ${article.title.slice(0, 60)}...`);

    // Idempotency: skip if source URL already imported
    if (importedSourceSlugs.has(sourceSlug)) {
      console.log(`  → Skipped (already imported from this source)`);
      skipped++;
      continue;
    }

    try {
      // Scrape
      const scraped = await scrapeArticle(relay, article.link);
      const contentLen = scraped.content?.length || 0;
      console.log(`  → Scraped (${(contentLen / 1024).toFixed(1)}KB content)`);

      if (contentLen < 200) {
        console.log(`  → Skipped: too little content`);
        skipped++;
        await sleep(SCRAPE_DELAY_MS);
        continue;
      }

      // Rewrite with Gemini
      const rewritten = await rewriteArticle(article, scraped);
      // Tag seoKeywords with source slug for idempotency
      rewritten.seoKeywords = `source:${sourceSlug},${rewritten.seoKeywords || ''}`.slice(0, 255);
      console.log(`  → Rewritten: "${rewritten.title.slice(0, 50)}" [${rewritten.category}]`);

      // Upload cover image
      const imageId = await uploadCoverImage(token, scraped.ogImage, rewritten.slug);
      console.log(`  → Image uploaded (id: ${imageId})`);

      // Create & publish
      const result = await createBlogPost(token, rewritten, imageId, authorDocId);
      if (result.skipped) {
        skipped++;
      } else {
        console.log(`  → Published ✓`);
        success++;
      }
    } catch (err) {
      console.error(`  → FAILED: ${err.message}`);
      failed++;
    }

    // Rate limit between articles
    if (i < selectedArticles.length - 1) {
      await sleep(SCRAPE_DELAY_MS);
    }
  }

  await relay.close();

  console.log(`\n=== Complete: ${success} success, ${skipped} skipped, ${failed} failed ===`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
