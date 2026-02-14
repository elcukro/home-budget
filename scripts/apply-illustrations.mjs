#!/usr/bin/env node

/**
 * Apply AI illustrations to blog posts.
 * Reads prompts from blog-gemini2.5-pro-prompts.md, sends to FAL.AI,
 * uploads to Strapi and attaches as coverImage.
 */

import { readFileSync } from 'fs';

const STRAPI_URL = 'http://localhost:1337';
const FAL_KEY = process.env.FAL_KEY;
const FAL_URL = 'https://fal.run/fal-ai/nano-banana-pro';

if (!FAL_KEY) { console.error('ERROR: FAL_KEY required'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Parse prompts from markdown ───────────────────────────

function parsePrompts() {
  const md = readFileSync('/Users/maestro/claude/repos/home-budget/scripts/blog-gemini2.5-pro-prompts.md', 'utf8');
  const blocks = [];
  const regex = /## (.+?)\n\n\*\*Slug:\*\* `(.+?)`.*?\n\n\*\*Prompt:\*\*\n\n```\n([\s\S]*?)\n```/g;
  let match;
  while ((match = regex.exec(md)) !== null) {
    const title = match[1];
    const slug = match[2];
    let falJson;
    try {
      falJson = JSON.parse(match[3]);
    } catch {
      console.log(`  ⚠ Could not parse JSON for ${slug}, skipping`);
      continue;
    }
    blocks.push({ title, slug, falJson });
  }
  return blocks;
}

// ─── Strapi helpers ────────────────────────────────────────

async function getStrapiToken() {
  const res = await fetch(`${STRAPI_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'elcukro@gmail.com', password: 'Admin1234' }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const { data } = await res.json();
  const adminJwt = data.token;

  const createRes = await fetch(`${STRAPI_URL}/admin/api-tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminJwt}` },
    body: JSON.stringify({ name: `illust-${Date.now()}`, type: 'full-access', lifespan: 604800000 }),
  });
  const { data: t } = await createRes.json();
  return t.accessKey;
}

async function findPostBySlug(token, slug) {
  const res = await fetch(`${STRAPI_URL}/api/blog-posts?filters[slug][$eq]=${encodeURIComponent(slug)}&fields[0]=title&fields[1]=slug`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const { data } = await res.json();
  return data?.[0] || null;
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
  if (!res.ok) throw new Error(`Update failed: ${res.status}`);

  // Re-publish (ignore 405 — means already published)
  await fetch(`${STRAPI_URL}/api/blog-posts/${documentId}/actions/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
}

// ─── FAL.AI ────────────────────────────────────────────────

async function generateImage(falJson) {
  const res = await fetch(FAL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${FAL_KEY}`,
    },
    body: JSON.stringify(falJson),
  });

  if (!res.ok) throw new Error(`FAL.AI ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json();
  const imageUrl = data.images?.[0]?.url;
  if (!imageUrl) throw new Error('No image URL in FAL response');

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Image download failed: ${imgRes.status}`);
  return Buffer.from(await imgRes.arrayBuffer());
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  console.log('=== FiredUp Blog — Apply AI Illustrations ===\n');

  const prompts = parsePrompts();
  console.log(`Parsed: ${prompts.length} prompts from markdown\n`);

  const token = await getStrapiToken();
  console.log('API token: obtained\n');

  let success = 0, failed = 0, skipped = 0;

  for (let i = 0; i < prompts.length; i++) {
    const { title, slug, falJson } = prompts[i];
    console.log(`[${i + 1}/${prompts.length}] ${title.slice(0, 60)}`);

    try {
      // Find post in Strapi
      const post = await findPostBySlug(token, slug);
      if (!post) {
        console.log(`  ⚠ Post not found for slug "${slug}", skipping`);
        skipped++;
        continue;
      }

      // Generate image via FAL.AI
      const imageBuffer = await generateImage(falJson);
      console.log(`  → Image generated (${(imageBuffer.length / 1024).toFixed(0)}KB)`);

      // Upload to Strapi
      const filename = `firedup-illust-${slug.slice(0, 50)}.png`;
      const imageId = await uploadImage(token, imageBuffer, filename);
      console.log(`  → Uploaded (id: ${imageId})`);

      // Attach to post
      await updatePostImage(token, post.documentId, imageId);
      console.log(`  → Attached ✓`);

      success++;
      if (i < prompts.length - 1) await sleep(2000);
    } catch (err) {
      console.log(`  → FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== Complete: ${success} success, ${skipped} skipped, ${failed} failed ===`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
