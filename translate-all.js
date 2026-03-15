#!/usr/bin/env node
// Batch translate Hebrew structural elements in Mishneh Torah chapters to English
// Uses OpenAI GPT-4o-mini API

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) { console.error('No OPENAI_API_KEY'); process.exit(1); }

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

function stripHtml(text) { return text.replace(/<[^>]+>/g, '').trim(); }

function extractHebrewItems(html) {
  const items = [];
  let m;
  
  // 1. Chapter description
  const descMatch = html.match(/<div style="color:#e0d5c1;font-size:1\.1rem[^"]*">(.*?)<\/div>/);
  if (descMatch && isHebrewHeavy(stripHtml(descMatch[1]))) {
    items.push({ type: 'desc', hebrew: descMatch[1].trim() });
  }
  
  // 2. Group titles
  const groupRe = /<h2[^>]*style="text-align:center;color:#c9a84c;margin-bottom:\.3rem">(.*?)<\/h2>/gs;
  while ((m = groupRe.exec(html)) !== null) {
    if (isHebrewHeavy(stripHtml(m[1]))) {
      items.push({ type: 'group_title', hebrew: m[1].trim() });
    }
  }
  
  // 3. Callout labels  
  const labelRe = /<div class="label">(.*?)<\/div>/g;
  while ((m = labelRe.exec(html)) !== null) {
    const clean = m[1].replace(/[\u{1F000}-\u{1F9FF}]/gu, '').trim();
    if (isHebrewHeavy(clean)) {
      items.push({ type: 'callout_label', hebrew: m[1].trim() });
    }
  }
  
  // 4. Callout bodies
  const calloutRe = /<div class="callout"><div class="label">.*?<\/div>([\s\S]*?)<\/div>/g;
  while ((m = calloutRe.exec(html)) !== null) {
    const body = m[1].trim();
    if (body && isHebrewHeavy(stripHtml(body))) {
      items.push({ type: 'callout_body', hebrew: body });
    }
  }
  
  // 5. Principle titles and descriptions
  const princRe = /<strong>(.*?)<\/strong><br><span[^>]*>(.*?)<\/span>/gs;
  while ((m = princRe.exec(html)) !== null) {
    if (isHebrewHeavy(stripHtml(m[1]))) {
      items.push({ type: 'principle_title', hebrew: m[1].trim() });
    }
    if (isHebrewHeavy(stripHtml(m[2]))) {
      items.push({ type: 'principle_desc', hebrew: m[2].trim() });
    }
  }
  
  return items;
}

function extractQuizItems(html) {
  const items = [];
  let m;
  
  const qRe = /<div class="q-text">(.*?)<\/div>/g;
  while ((m = qRe.exec(html)) !== null) {
    if (isHebrewHeavy(m[1])) items.push({ type: 'quiz_q', hebrew: m[1].trim() });
  }
  
  const optRe = /<button class="option"[^>]*>(.*?)<\/button>/g;
  while ((m = optRe.exec(html)) !== null) {
    if (isHebrewHeavy(m[1])) items.push({ type: 'quiz_opt', hebrew: m[1].trim() });
  }
  
  const expRe = /<div class="explanation">(.*?)<\/div>/g;
  while ((m = expRe.exec(html)) !== null) {
    if (isHebrewHeavy(m[1])) items.push({ type: 'quiz_exp', hebrew: m[1].trim() });
  }
  
  return items;
}

async function translateBatch(hebrewTexts, context) {
  const prompt = `Translate each numbered Hebrew text from Mishneh Torah (Rambam) study materials into clear academic English for a Torah study website.

Context: ${context}

Rules:
- Keep any HTML tags (<strong>, etc.) in place
- Keep emoji characters in place  
- For callout labels (type starting with emoji): keep emoji, translate Hebrew text to short English phrase
- For callout bodies: use <strong> tags for key halachic terms, write clear synthesis
- For group titles: make them descriptive and distinctive
- For principle titles: concise 3-6 word English
- For principle descriptions: 1-2 clear English sentences
- For quiz items: straightforward English, transliterate halachic terms
- Return ONLY a JSON array of translated strings, same order, same count

Texts to translate:
${hebrewTexts.map((t, i) => `${i + 1}. [${t.type}] ${t.hebrew}`).join('\n')}`;

  const body = JSON.stringify({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 8192,
    temperature: 0.3,
    response_format: { type: "json_object" }
  });
  
  const tmpFile = `/tmp/tr_${Date.now()}.json`;
  fs.writeFileSync(tmpFile, body);
  
  try {
    const result = execSync(`curl -s https://api.openai.com/v1/chat/completions \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${API_KEY}" \
      -d @${tmpFile}`, { maxBuffer: 10 * 1024 * 1024, timeout: 120000 }).toString();
    
    fs.unlinkSync(tmpFile);
    const response = JSON.parse(result);
    
    if (response.error) {
      console.error('  API error:', response.error.message);
      return null;
    }
    
    const text = response.choices[0].message.content;
    const parsed = JSON.parse(text);
    
    // Handle both array and object with "translations" key
    const translations = Array.isArray(parsed) ? parsed : 
                         parsed.translations ? parsed.translations : 
                         Object.values(parsed);
    
    if (translations.length !== hebrewTexts.length) {
      console.error(`  Count mismatch: got ${translations.length}, expected ${hebrewTexts.length}`);
      return null;
    }
    
    return translations;
  } catch(e) {
    console.error('  Translation failed:', e.message?.substring(0, 100));
    try { fs.unlinkSync(tmpFile); } catch(ee) {}
    return null;
  }
}

function applyTranslations(html, items, translations) {
  let modified = html;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const translated = translations[i];
    if (!translated) continue;
    
    // Simple string replacement of the Hebrew text with English
    const idx = modified.indexOf(item.hebrew);
    if (idx !== -1) {
      modified = modified.substring(0, idx) + translated + modified.substring(idx + item.hebrew.length);
    } else {
      console.error(`    Could not find text to replace for ${item.type}: "${item.hebrew.substring(0, 40)}..."`);
    }
  }
  return modified;
}

async function processChapter(section, ch) {
  const indexPath = path.join(section, String(ch), 'index.html');
  const quizPath = path.join(section, String(ch), 'quiz.html');
  
  if (!fs.existsSync(indexPath)) {
    console.error(`  Missing: ${indexPath}`);
    return false;
  }
  
  let html = fs.readFileSync(indexPath, 'utf-8');
  const indexItems = extractHebrewItems(html);
  
  let quizHtml = fs.existsSync(quizPath) ? fs.readFileSync(quizPath, 'utf-8') : '';
  const quizItems = quizHtml ? extractQuizItems(quizHtml) : [];
  
  const allItems = [...indexItems, ...quizItems];
  if (allItems.length === 0) {
    console.log(`  ✓ ${section}/${ch}: already translated`);
    return true;
  }
  
  console.log(`  → ${section}/${ch}: translating ${indexItems.length} index + ${quizItems.length} quiz items...`);
  
  const sectionName = section.split('/').pop().replace(/-/g, ' ');
  const translations = await translateBatch(allItems, `Section: ${sectionName}, Chapter ${ch}`);
  
  if (!translations) return false;
  
  // Apply to index.html
  const modifiedHtml = applyTranslations(html, indexItems, translations.slice(0, indexItems.length));
  fs.writeFileSync(indexPath, modifiedHtml);
  
  // Apply to quiz.html
  if (quizItems.length > 0) {
    const modifiedQuiz = applyTranslations(quizHtml, quizItems, translations.slice(indexItems.length));
    fs.writeFileSync(quizPath, modifiedQuiz);
  }
  
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
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  console.log(`\n=== COMPLETE ===`);
  console.log(`Total: ${total} | Success: ${success} | Failed: ${failed}`);
}

main().catch(console.error);
