#!/usr/bin/env node
// Fix Hebrew group titles in translated chapters
// Targets specifically the h2 elements with group titles

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const API_KEY = process.env.OPENAI_API_KEY;

const CHAPTERS = {
  'avodah/admission-into-the-sanctuary': [5, 6, 9],
  'avodah/daily-offerings-and-additional-offerings': [6, 7, 9, 10],
  'avodah/sacrifices-rendered-unfit': [1,2,3,4,5,6,8,11,13,14,15,16,17,18,19],
  'avodah/sacrificial-procedure': [1,2,3,5,6,7,8,9,10,11,12,13,15,16,17,18,19],
  'avodah/service-on-the-day-of-atonement': [1,2,3,4,5],
  'avodah/things-forbidden-on-the-altar': [2,4,5,6,7],
  'avodah/trespass': [3,5,6,7,8],
  'avodah/vessels-of-the-sanctuary-and-those-who-serve-therein': [1],
  'zeraim/first-fruits-and-other-gifts-to-priests-outside-the-sanctuary': [7],
  'zeraim/sabbatical-year-and-the-jubilee': [1,2,6,9,12,13],
  'zeraim/second-tithes-and-fourth-year-s-fruit': [6,8,9,10,11],
  'zeraim/tithes': [5,6,9,13],
};

function isHebrewHeavy(text) {
  const clean = text.replace(/[0-9\s\-–—·:,\.!\?״׳'"<>\/\(\)\[\]]/g, '')
                     .replace(/[\u{1F000}-\u{1F9FF}]/gu, '');
  if (!clean) return false;
  const hebrew = (clean.match(/[\u0590-\u05FF]/g) || []).length;
  const latin = (clean.match(/[a-zA-Z]/g) || []).length;
  return hebrew > 0 && latin === 0;
}

function stripHtml(t) { return t.replace(/<[^>]+>/g, '').trim(); }

async function translateTexts(texts, context) {
  const body = JSON.stringify({
    model: "gpt-4o-mini",
    messages: [{
      role: "user",
      content: `Translate these Hebrew Mishneh Torah (Rambam) group/section titles into clear, descriptive English titles suitable for a study website. Each title should be distinctive and describe the content of that group of halachot.

Context: ${context}

Return ONLY a JSON object with key "translations" containing an array of English strings, same order and count.

${texts.map((t, i) => `${i+1}. ${t}`).join('\n')}`
    }],
    max_tokens: 2048,
    temperature: 0.3,
    response_format: { type: "json_object" }
  });

  const tmpFile = `/tmp/tr_gt_${Date.now()}.json`;
  fs.writeFileSync(tmpFile, body);
  try {
    const result = execSync(`curl -s https://api.openai.com/v1/chat/completions \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${API_KEY}" \
      -d @${tmpFile}`, { maxBuffer: 5*1024*1024, timeout: 60000 }).toString();
    fs.unlinkSync(tmpFile);
    const resp = JSON.parse(result);
    if (resp.error) { console.error('  API error:', resp.error.message); return null; }
    const parsed = JSON.parse(resp.choices[0].message.content);
    return parsed.translations || Object.values(parsed);
  } catch(e) {
    console.error('  Failed:', e.message?.substring(0,80));
    try { fs.unlinkSync(tmpFile); } catch(ee) {}
    return null;
  }
}

async function processChapter(section, ch) {
  const indexPath = path.join(section, String(ch), 'index.html');
  if (!fs.existsSync(indexPath)) return true;
  
  let html = fs.readFileSync(indexPath, 'utf-8');
  
  // Find all Hebrew group h2 titles AND their corresponding flowchart entries
  const h2Re = /(<h2[^>]*style="text-align:center;color:#c9a84c;margin-bottom:[^"]*"[^>]*>)(.*?)(<\/h2>)/gs;
  const hebrewH2s = [];
  let m;
  while ((m = h2Re.exec(html)) !== null) {
    const title = stripHtml(m[2]);
    if (isHebrewHeavy(title)) {
      hebrewH2s.push({ fullMatch: m[0], prefix: m[1], content: m[2].trim(), suffix: m[3], clean: title });
    }
  }
  
  // Also find flowchart box titles that match (they appear in overview slide)
  // Pattern: <div class="flow-box...">Hebrew title<br>
  const flowRe = /(<div class="flow-box[^"]*">)([\s\S]*?)(<br>)/g;
  const hebrewFlows = [];
  while ((m = flowRe.exec(html)) !== null) {
    const title = stripHtml(m[2]);
    if (isHebrewHeavy(title)) {
      hebrewFlows.push({ fullMatch: m[0], prefix: m[1], content: m[2].trim(), suffix: m[3], clean: title });
    }
  }
  
  // Also find the chapter description
  const descRe = /(<div style="color:#e0d5c1;font-size:1\.1rem[^"]*">)(.*?)(<\/div>)/;
  const descMatch = html.match(descRe);
  let descItem = null;
  if (descMatch && isHebrewHeavy(stripHtml(descMatch[2]))) {
    descItem = { fullMatch: descMatch[0], prefix: descMatch[1], content: descMatch[2].trim(), suffix: descMatch[3], clean: stripHtml(descMatch[2]) };
  }
  
  // Also find the overview h2 title (the one after slide 1)
  const overviewH2Re = /(<h2 style="text-align:center;color:#c9a84c;margin-bottom:\.5rem">)(.*?)(<\/h2>)/;
  const ovMatch = html.match(overviewH2Re);
  let overviewItem = null;
  if (ovMatch && isHebrewHeavy(stripHtml(ovMatch[2]))) {
    overviewItem = { fullMatch: ovMatch[0], prefix: ovMatch[1], content: ovMatch[2].trim(), suffix: ovMatch[3], clean: stripHtml(ovMatch[2]) };
  }
  
  const allItems = [];
  if (descItem) allItems.push(descItem);
  if (overviewItem) allItems.push(overviewItem);
  allItems.push(...hebrewH2s);
  allItems.push(...hebrewFlows);
  
  if (allItems.length === 0) {
    return true;
  }
  
  console.log(`  → ${section}/${ch}: ${allItems.length} items (${hebrewH2s.length} h2, ${hebrewFlows.length} flow, desc=${!!descItem}, overview=${!!overviewItem})`);
  
  const sectionName = section.split('/').pop().replace(/-/g, ' ');
  const translations = await translateTexts(
    allItems.map(it => it.clean),
    `Section: ${sectionName}, Chapter ${ch}`
  );
  
  if (!translations || translations.length !== allItems.length) {
    console.error(`  ✗ Count mismatch: got ${translations?.length}, expected ${allItems.length}`);
    return false;
  }
  
  // Replace each item — use the full match for precise replacement
  let modified = html;
  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    const translated = translations[i];
    const newFull = item.prefix + translated + item.suffix;
    modified = modified.replace(item.fullMatch, newFull);
  }
  
  fs.writeFileSync(indexPath, modified);
  console.log(`  ✓ ${section}/${ch}: done`);
  return true;
}

async function main() {
  let total = 0, success = 0, failed = 0;
  for (const [section, chapters] of Object.entries(CHAPTERS)) {
    console.log(`\n=== ${section} ===`);
    for (const ch of chapters) {
      total++;
      try {
        const ok = await processChapter(section, ch);
        if (ok) success++; else failed++;
      } catch(e) {
        console.error(`  ✗ ${section}/${ch}: ${e.message}`);
        failed++;
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }
  console.log(`\n=== COMPLETE === Total: ${total} | Success: ${success} | Failed: ${failed}`);
}

main().catch(console.error);
