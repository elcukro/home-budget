#!/usr/bin/env node

/**
 * FiredUp Blog — AI Illustration Generator
 *
 * Generates custom illustrations for blog posts using:
 *   1. Gemini → generates an image prompt from article content
 *   2. FAL.AI nano-banana-pro → renders the illustration
 *   3. Uploads to Strapi and attaches as coverImage
 *
 * Usage:
 *   node generate-illustrations.mjs              # all posts
 *   node generate-illustrations.mjs --force       # regenerate even if image exists
 *   node generate-illustrations.mjs --dry-run     # preview prompts without generating
 *   node generate-illustrations.mjs --only <slug> # single post by slug
 */

const STRAPI_URL = 'http://localhost:1337';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FAL_KEY = process.env.FAL_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const FAL_URL = 'https://fal.run/fal-ai/nano-banana-pro';

if (!GEMINI_API_KEY) { console.error('ERROR: GEMINI_API_KEY required'); process.exit(1); }
if (!FAL_KEY) { console.error('ERROR: FAL_KEY required'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── CLI args ──────────────────────────────────────────────

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const DRY_RUN = args.includes('--dry-run');
const onlyIdx = args.indexOf('--only');
const ONLY_SLUG = onlyIdx !== -1 ? args[onlyIdx + 1] : null;

// ─── Strapi helpers ────────────────────────────────────────

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
    const fallback = '3659e4e849ecb7377a3a5fdd0cf82cfadeca96000fbbecdafcc641d1bcca1c988156644b6cf2c14b079b7b4964c4590d3874052601d3b324a076a270fe43ab5e';
    const testRes = await fetch(`${STRAPI_URL}/api/blog-posts?pagination[limit]=1`, {
      headers: { Authorization: `Bearer ${fallback}` },
    });
    if (testRes.ok) return fallback;
    throw new Error('No working API token');
  }

  const { data: loginData } = await loginRes.json();
  const adminJwt = loginData.token;

  // Create a temporary full-access token
  const createRes = await fetch(`${STRAPI_URL}/admin/api-tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
    body: JSON.stringify({ name: `illust-${Date.now()}`, description: 'Illustration generation', type: 'full-access', lifespan: 604800000 }),
  });
  const { data: tokenData } = await createRes.json();
  return tokenData.accessKey;
}

async function getAllPosts(token) {
  const res = await fetch(`${STRAPI_URL}/api/blog-posts?pagination[limit]=100&fields[0]=title&fields[1]=slug&fields[2]=content&fields[3]=seoKeywords&populate[coverImage][fields][0]=name&populate[coverImage][fields][1]=url`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch posts: ${res.status}`);
  const { data } = await res.json();
  return data;
}

async function uploadImage(token, imageBuffer, filename) {
  const formData = new FormData();
  formData.append('files', new Blob([imageBuffer], { type: 'image/png' }), filename);

  const res = await fetch(`${STRAPI_URL}/api/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const [uploaded] = await res.json();
  return uploaded.id;
}

async function updatePostImage(token, documentId, imageId) {
  const res = await fetch(`${STRAPI_URL}/api/blog-posts/${documentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: { coverImage: imageId } }),
  });
  if (!res.ok) throw new Error(`Update failed: ${res.status} ${await res.text()}`);

  // Re-publish
  const pubRes = await fetch(`${STRAPI_URL}/api/blog-posts/${documentId}/actions/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!pubRes.ok) console.log(`  Warning: re-publish failed (${pubRes.status})`);
}

// ─── Gemini: generate image prompt ─────────────────────────

async function generateImagePrompt(articleContent, articleTitle) {
  const prompt = `przygotuj prompt do zdjęcia ilustrującego poniższy artykuł, które zostanie opublikowany w aplikacji online służącej jako wsparcie do mądrego zarządzania finansami osobistymi. Motywy tego serwisu to miętowy zielony i biały jako kolory dominujące. Prompt powinien być w języku angielskim, opisywać nowoczesną, czystą ilustrację (nie zdjęcie stockowe). Zwróć TYLKO sam prompt, bez dodatkowego tekstu.

Tytuł artykułu: ${articleTitle}

Treść artykułu:
${articleContent.slice(0, 4000)}`;

  for (let attempt = 0; attempt <= 5; attempt++) {
    try {
      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 1024 },
        }),
      });

      if (res.status === 429) {
        const wait = (attempt + 1) * 15000;
        console.log(`  Rate limited, waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }

      if (!res.ok) throw new Error(`Gemini ${res.status}`);

      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts.filter(p => p.text).map(p => p.text).join('\n').trim();
      if (!text) throw new Error('Empty Gemini response');

      // Clean up — remove markdown fences or quotes if present
      return text.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').replace(/^["']|["']$/g, '').trim();
    } catch (err) {
      if (attempt === 5) throw err;
      await sleep(3000);
    }
  }
}

// ─── FAL.AI: generate image ────────────────────────────────

async function generateImage(imagePrompt) {
  const res = await fetch(FAL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${FAL_KEY}`,
    },
    body: JSON.stringify({
      prompt: imagePrompt,
      num_images: 1,
      aspect_ratio: '16:9',
      output_format: 'png',
      resolution: '1K',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`FAL.AI ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  const imageUrl = data.images?.[0]?.url;
  if (!imageUrl) throw new Error('No image URL in FAL response');

  // Download the image
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Image download failed: ${imgRes.status}`);
  return Buffer.from(await imgRes.arrayBuffer());
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  console.log('=== FiredUp Blog — AI Illustration Generator ===\n');

  const token = await getStrapiToken();
  console.log('API token: obtained');

  const posts = await getAllPosts(token);
  console.log(`Blog posts: ${posts.length} total\n`);

  // Filter posts
  let toProcess = posts.filter(p => {
    // Skip test post
    if (p.seoKeywords === 'test') return false;
    // If --only specified, filter by slug
    if (ONLY_SLUG && p.slug !== ONLY_SLUG) return false;
    // If not --force, skip posts that already have AI-generated images
    if (!FORCE && p.coverImage?.name?.startsWith('firedup-illust-')) return false;
    return true;
  });

  console.log(`To process: ${toProcess.length} posts ${FORCE ? '(force mode)' : ''} ${DRY_RUN ? '(dry run)' : ''}\n`);

  let success = 0, failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const post = toProcess[i];
    console.log(`[${i + 1}/${toProcess.length}] ${post.title.slice(0, 60)}`);

    try {
      // Step 1: Generate image prompt via Gemini
      const imagePrompt = await generateImagePrompt(post.content, post.title);
      console.log(`  → Prompt: "${imagePrompt.slice(0, 80)}..."`);

      if (DRY_RUN) {
        console.log(`  → [DRY RUN] Would generate image and upload`);
        success++;
        continue;
      }

      // Step 2: Generate image via FAL.AI
      const imageBuffer = await generateImage(imagePrompt);
      console.log(`  → Image generated (${(imageBuffer.length / 1024).toFixed(0)}KB)`);

      // Step 3: Upload to Strapi
      const filename = `firedup-illust-${post.slug.slice(0, 50)}.png`;
      const imageId = await uploadImage(token, imageBuffer, filename);
      console.log(`  → Uploaded (id: ${imageId})`);

      // Step 4: Attach to post and re-publish
      await updatePostImage(token, post.documentId, imageId);
      console.log(`  → Attached & published ✓`);

      success++;

      // Rate limit: small delay between posts
      if (i < toProcess.length - 1) await sleep(2000);
    } catch (err) {
      console.log(`  → FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== Complete: ${success} success, ${failed} failed ===`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
