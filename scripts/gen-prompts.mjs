#!/usr/bin/env node

/**
 * Generate image prompts for all blog posts using Gemini 2.5 Pro
 * Outputs a markdown file with all prompts for review.
 */

import { writeFileSync } from 'fs';

const STRAPI_URL = 'http://localhost:1337';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;

const sleep = ms => new Promise(r => setTimeout(r, ms));

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
    body: JSON.stringify({ name: `prompts-${Date.now()}`, description: 'temp', type: 'full-access', lifespan: 604800000 }),
  });
  const { data: t } = await createRes.json();
  return t.accessKey;
}

async function callGemini(prompt, retries = 6) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1.0, maxOutputTokens: 16384 },
        }),
      });

      if (res.status === 429) {
        const wait = (attempt + 1) * 20000;
        console.log(`  ⏳ Rate limited, waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);

      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts.filter(p => p.text).map(p => p.text).join('\n').trim();
      if (!text) throw new Error('Empty response');
      return text.replace(/^```\w*\n?/, '').replace(/\n?```$/, '').replace(/^["']|["']$/g, '').trim();
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`  ⚠ Attempt ${attempt + 1} failed: ${err.message}, retrying...`);
      await sleep(5000);
    }
  }
}

async function main() {
  console.log('=== Generating image prompts with Gemini 2.5 Pro ===\n');

  const token = await getStrapiToken();
  const res = await fetch(`${STRAPI_URL}/api/blog-posts?pagination[limit]=100&fields[0]=title&fields[1]=slug&fields[2]=content&fields[3]=category&fields[4]=seoKeywords`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { data: posts } = await res.json();

  const filtered = posts.filter(p => (p.seoKeywords || '') !== 'test');
  console.log(`Posts: ${filtered.length}\n`);

  const results = [];

  for (let i = 0; i < filtered.length; i++) {
    const post = filtered[i];
    console.log(`[${i + 1}/${filtered.length}] ${post.title.slice(0, 60)}`);

    const metaPrompt = `przygotuj prompt do zdjęcia ilustrującego poniższy artykuł, które zostanie opublikowany w aplikacji online służącej jako wsparcie do mądrego zarządzania finansami osobistymi. Motywy tego serwisu to miętowy zielony i biały jako kolory dominujące. Styl lay flat. Język polski. Treść artykułu: ${post.content || ''}

odpowiedz poniższym formatem:

{ "prompt": "[YOUR_PROMPT_FOR_IMAGE]", "num_images": 1, "aspect_ratio": "16:9", "output_format": "png", "resolution": "1K"}`;

    try {
      const raw = await callGemini(metaPrompt);
      // Extract JSON from response
      let falJson;
      try {
        const jsonMatch = raw.match(/\{[\s\S]*"prompt"[\s\S]*\}/);
        falJson = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch { falJson = null; }

      const promptText = falJson?.prompt || raw;
      const fullResponse = falJson ? JSON.stringify(falJson, null, 2) : raw;
      console.log(`  ✓ ${promptText.slice(0, 80)}...`);
      results.push({ slug: post.slug, title: post.title, category: post.category, prompt: fullResponse, promptText });

      // Delay between calls
      if (i < filtered.length - 1) await sleep(3000);
    } catch (err) {
      console.log(`  ✗ FAILED: ${err.message}`);
      results.push({ slug: post.slug, title: post.title, category: post.category, prompt: `ERROR: ${err.message}` });
    }
  }

  // Write markdown
  let md = `# Blog Image Prompts (Gemini 2.5 Pro)\n\n`;
  md += `Generated: ${new Date().toISOString()}\n`;
  md += `Model: gemini-2.5-pro | Temperature: 1.0\n`;
  md += `Total: ${results.length} prompts\n\n---\n\n`;

  for (const r of results) {
    md += `## ${r.title}\n\n`;
    md += `**Slug:** \`${r.slug}\` | **Category:** ${r.category}\n\n`;
    md += `**Prompt:**\n\n\`\`\`\n${r.prompt}\n\`\`\`\n\n---\n\n`;
  }

  const outPath = '/Users/maestro/claude/repos/home-budget/scripts/blog-gemini2.5-pro-prompts.md';
  writeFileSync(outPath, md);
  console.log(`\n✅ Saved to ${outPath}`);

  const failed = results.filter(r => r.prompt.startsWith('ERROR')).length;
  console.log(`\n=== Done: ${results.length - failed} success, ${failed} failed ===`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
