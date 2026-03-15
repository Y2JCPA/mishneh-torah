#!/usr/bin/env node
// Fix remaining Hebrew callout labels, callout bodies, and quiz content

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const glob = require('child_process');

const API_KEY = process.env.OPENAI_API_KEY;

function isHebrewHeavy(text) {
  const clean = text.replace(/[0-9\s\-–—·:,\.!\?״׳'"<>\/\(\)\[\]]/g, '')
                     .replace(/[\u{1F000}-\u{1F9FF}]/gu, '');
  if (!clean) return false;
  const hebrew = (clean.match(/[\u0590-\u05FF]/g) || []).length;
  const latin = (clean.match(/[a-zA-Z]/g) || []).length;
  const total = hebrew + latin;
  if (total === 0) return false;
  return hebrew / total > 0.5;
}

function stripHtml(t) { return t.replace(/<[^>]+>/g, '').trim(); }

async function callAPI(texts, context) {
  const body = JSON.stringify({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `Translate these Hebrew texts from Mishneh Torah study materials into clear English. Keep HTML tags and emoji. Return ONLY a JSON object: {"translations": ["...", "..."]}. Same count as input.

Context: ${context}

${texts.map((t, i) => `${i+1}. ${t}`).join('\n')}`
    }],
    max_tokens: 8192,
    temperature: 0.3,
    response_format: { type: "json_object" }
  });

  const tmpFile = `/tmp/tr_cq_${Date.now()}.json`;
  fs.writeFileSync(tmpFile, body);
  try {
    const result = execSync(`curl -s https://api.openai.com/v1/chat/completions \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${API_KEY}" \
      -d @${tmpFile}`, { maxBuffer: 10*1024*1024, timeout: 120000 }).toString();
    fs.unlinkSync(tmpFile);
    const resp = JSON.parse(result);
    if (resp.error) { console.error('  API err:', resp.error.message); return null; }
    const parsed = JSON.parse(resp.choices[0].message.content);
    return parsed.translations || Object.values(parsed);
  } catch(e) {
    console.error('  Err:', e.message?.substring(0,80));
    try { fs.unlinkSync(tmpFile); } catch(ee) {}
    return null;
  }
}

async function fixFile(filePath) {
  let html = fs.readFileSync(filePath, 'utf-8');
  const isQuiz = filePath.endsWith('quiz.html');
  
  const items = [];
  let m;
  
  if (isQuiz) {
    // Quiz questions
    const qRe = /(<div class="q-text">)(.*?)(<\/div>)/g;
    while ((m = qRe.exec(html)) !== null) {
      if (isHebrewHeavy(m[2])) items.push({ pre: m[1], text: m[2].trim(), post: m[3], full: m[0] });
    }
    // Quiz options
    const oRe = /(<button class="option"[^>]*>)(.*?)(<\/button>)/g;
    while ((m = oRe.exec(html)) !== null) {
      if (isHebrewHeavy(m[2])) items.push({ pre: m[1], text: m[2].trim(), post: m[3], full: m[0] });
    }
    // Explanations
    const eRe = /(<div class="explanation">)(.*?)(<\/div>)/g;
    while ((m = eRe.exec(html)) !== null) {
      if (isHebrewHeavy(m[2])) items.push({ pre: m[1], text: m[2].trim(), post: m[3], full: m[0] });
    }
  } else {
    // Callout labels
    const lRe = /(<div class="label">)(.*?)(<\/div>)/g;
    while ((m = lRe.exec(html)) !== null) {
      const clean = m[2].replace(/[\u{1F000}-\u{1F9FF}]/gu, '').trim();
      if (isHebrewHeavy(clean)) items.push({ pre: m[1], text: m[2].trim(), post: m[3], full: m[0] });
    }
    // Callout bodies — more precise: match between label closing and callout closing
    const cRe = /(<div class="callout"><div class="label">.*?<\/div>)([\s\S]*?)(<\/div>)/g;
    while ((m = cRe.exec(html)) !== null) {
      const body = m[2].trim();
      if (body && isHebrewHeavy(stripHtml(body))) {
        items.push({ pre: m[1], text: body, post: m[3], full: m[0] });
      }
    }
    // Principle titles
    const ptRe = /(<strong>)(.*?)(<\/strong><br>)/g;
    while ((m = ptRe.exec(html)) !== null) {
      if (isHebrewHeavy(stripHtml(m[2]))) items.push({ pre: m[1], text: m[2].trim(), post: m[3], full: m[0] });
    }
    // Principle descriptions
    const pdRe = /(<span[^>]*style="font-size:\.9rem"[^>]*>)(.*?)(<\/span>)/g;
    while ((m = pdRe.exec(html)) !== null) {
      if (isHebrewHeavy(stripHtml(m[2]))) items.push({ pre: m[1], text: m[2].trim(), post: m[3], full: m[0] });
    }
  }
  
  if (items.length === 0) return 0;
  
  const sectionName = filePath.split('/').slice(0,2).join('/');
  const translations = await callAPI(items.map(it => it.text), `File: ${filePath}`);
  
  if (!translations || translations.length !== items.length) {
    console.error(`  ✗ ${filePath}: count mismatch (got ${translations?.length}, need ${items.length})`);
    return -1;
  }
  
  // Replace using full match for precision
  let modified = html;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const newFull = item.pre + translations[i] + item.post;
    modified = modified.replace(item.full, newFull);
  }
  
  fs.writeFileSync(filePath, modified);
  return items.length;
}

async function main() {
  // Find all files needing fixes
  const allFiles = execSync("find /tmp/mishneh-torah -path '*/he/*' -prune -o -name 'index.html' -print -o -name 'quiz.html' -print", 
    { encoding: 'utf-8' }).trim().split('\n').filter(Boolean).sort();
  
  let totalFixed = 0;
  let filesFixed = 0;
  let failures = 0;
  
  for (const file of allFiles) {
    const rel = file.replace('/tmp/mishneh-torah/', '');
    // Quick check if file has Hebrew content we care about
    const html = fs.readFileSync(file, 'utf-8');
    const isQuiz = file.endsWith('quiz.html');
    
    let hasHebrew = false;
    if (isQuiz) {
      const qs = html.match(/class="q-text">(.*?)<\/div>/g) || [];
      hasHebrew = qs.some(q => isHebrewHeavy(q.replace(/<[^>]+>/g, '')));
    } else {
      const labels = html.match(/<div class="label">(.*?)<\/div>/g) || [];
      hasHebrew = labels.some(l => {
        const clean = l.replace(/<[^>]+>/g, '').replace(/[\u{1F000}-\u{1F9FF}]/gu, '').trim();
        return isHebrewHeavy(clean);
      });
      if (!hasHebrew) {
        // Check callout bodies
        const bodies = html.match(/<div class="callout"><div class="label">.*?<\/div>([\s\S]*?)<\/div>/g) || [];
        hasHebrew = bodies.some(b => isHebrewHeavy(stripHtml(b)));
      }
    }
    
    if (!hasHebrew) continue;
    
    process.stdout.write(`  → ${rel}...`);
    const count = await fixFile(file);
    if (count > 0) {
      console.log(` ✓ ${count} items`);
      totalFixed += count;
      filesFixed++;
    } else if (count === 0) {
      console.log(' (none)');
    } else {
      console.log(' FAILED');
      failures++;
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log(`\n=== DONE === Files: ${filesFixed} | Items: ${totalFixed} | Failures: ${failures}`);
}

main().catch(console.error);
