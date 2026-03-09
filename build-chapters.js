#!/usr/bin/env node
/**
 * Mishneh Torah Chapter Builder
 * 
 * Reads Sefaria JSON data, generates structured chapter content via GPT-4o-mini,
 * then builds static HTML with slides, Hebrew/English text, and quizzes.
 * 
 * Usage:
 *   node build-chapters.js --section shofar-sukkah-lulav
 *   node build-chapters.js --section taaniyot --chapters 1,2,3
 *   node build-chapters.js --all
 *   node build-chapters.js --section taaniyot --dry-run
 * 
 * See BUILD_SPEC.md for full documentation.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ============ CONFIG ============
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = 'gpt-4o-mini';
const BASE_PATH = '/tmp/mishneh-torah';
const SECTIONS = JSON.parse(fs.readFileSync(path.join(BASE_PATH, 'sections.json'), 'utf8'));
const CSS = fs.readFileSync(path.join(BASE_PATH, 'TEMPLATE_PEREK.html'), 'utf8').match(/<style>([\s\S]*?)<\/style>/)[1];

// ============ HELPERS ============
function clean(s) { return s ? s.replace(/<[^>]+>/g, '').trim() : ''; }

const heN = ['א','ב','ג','ד','ה','ו','ז','ח','ט','י','י״א','י״ב','י״ג','י״ד','ט״ו','ט״ז','י״ז','י״ח','י״ט','כ','כ״א','כ״ב','כ״ג','כ״ד','כ״ה','כ״ו','כ״ז'];
const heCNmap = {1:'א',2:'ב',3:'ג',4:'ד',5:'ה',6:'ו',7:'ז',8:'ח',9:'ט',10:'י',11:'י״א',12:'י״ב',13:'י״ג',14:'י״ד',15:'ט״ו',16:'ט״ז',17:'י״ז',18:'י״ח',19:'י״ט',20:'כ',21:'כ״א',22:'כ״ב',23:'כ״ג',24:'כ״ד',25:'כ״ה',26:'כ״ו',27:'כ״ז'};

function heRange(start, end) {
  return `הלכות ${heN[start]}׳–${heN[end]}׳`;
}

// ============ OPENAI API CALL ============
function callOpenAI(messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error.message));
            return;
          }
          const content = json.choices[0].message.content;
          resolve(JSON.parse(content));
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}\nRaw: ${data.substring(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ============ CONTENT GENERATION PROMPT ============
function buildPrompt(halachot, secEn, secHe, chNum, totalH) {
  const halachotText = halachot.map((h, i) => `H${i + 1}: ${h}`).join('\n\n');
  
  return [
    {
      role: 'system',
      content: `You are an expert in Rambam's Mishneh Torah creating structured study content. You MUST return valid JSON matching the exact schema below. Read every halacha carefully and create content that reflects what's ACTUALLY in the text.

QUALITY RULES:
- Group titles must be MEANINGFUL (e.g., "The Craftsman's Practice Prohibition", NOT "Part 1")
- Callouts must SYNTHESIZE themes across the halachot in that group
- Quiz questions must test SPECIFIC content from these halachot, not general Jewish knowledge
- Principles must be UNIQUE to this chapter
- Use <strong>HTML bold</strong> in callout text for emphasis

JSON SCHEMA:
{
  "title": "Chapter Title — Descriptive phrase",
  "groups": [
    {
      "title": "Meaningful Group Title",
      "sub": "הלכות א׳–ה׳",
      "idx": [0, 1, 2, 3, 4],
      "calloutLabel": "🔥 Short Label",
      "calloutText": "Synthesis of this group's theme with <strong>bold</strong> emphasis..."
    }
  ],
  "principles": [
    { "icon": "🔥", "title": "Principle Title", "desc": "One-sentence description" }
  ],
  "quiz": [
    {
      "q": "Question about specific content?",
      "options": ["Wrong answer", "Correct answer", "Wrong answer", "Wrong answer"],
      "correct": 1,
      "explanation": "Why this is correct, referencing specific halachot"
    }
  ]
}

CONSTRAINTS:
- 2-5 groups covering ALL halachot (every halacha must be in exactly one group)
- idx arrays are 0-based and must be contiguous ranges
- Exactly 4 principles
- Exactly 5 quiz questions, each with exactly 4 options
- "correct" is 0-based index of the right answer
- sub field uses Hebrew numerals: א׳, ב׳... י׳, י״א, etc.`
    },
    {
      role: 'user',
      content: `Create study content for ${secEn} (${secHe}), Chapter ${chNum} (${totalH} halachot).

Here are ALL the halachot in this chapter:

${halachotText}

Remember: read each halacha carefully. Group them by actual theme. Quiz questions must reference specific rulings from this text.`
    }
  ];
}

// ============ HTML BUILDERS ============
function card(he, en, i) {
  const lg = en.length > 250;
  return `<div class="halacha-card"><div class="halacha-num">הלכה ${heN[i]}׳</div><div class="halacha-he">${he}</div><div class="halacha-en${lg ? ' long' : ''}">${en}</div>${lg ? '<button class="expand-btn" onclick="toggleExpand(this)">Read full text ▼</button>' : ''}</div>`;
}

function buildPage(ch, heD, enD, secHe, secEn, emoji, book, chNum) {
  const heCh = heCNmap[chNum] || String(chNum);
  const totalH = enD.length;
  const n = ch.groups.length;
  const tot = 2 + n + 2;

  let sl = `<div class="slide active" data-slide="0"><div class="slide-num">1/${tot}</div><div style="text-align:center;padding:1rem 0"><div style="font-size:.9rem;color:#888;margin-bottom:1rem">📖 ${book}</div><div class="emoji">${emoji}</div><h1 style="font-size:1.8rem;color:#c9a84c;margin:.5rem 0">${secHe}</h1><h2 style="font-size:1rem;color:#a89060;margin-bottom:1.5rem">${secEn}</h2><div style="width:60px;height:2px;background:#c9a84c;margin:0 auto 1.5rem"></div><div style="font-size:1.6rem;color:#c9a84c">פרק ${heCh}</div><div style="color:#888;margin:.5rem 0 1.5rem">Chapter ${chNum} · ${totalH} Halachot</div><div style="color:#e0d5c1;font-size:1.1rem;text-align:center">${ch.title}</div></div></div>\n`;

  sl += `<div class="slide" data-slide="1"><div class="slide-num">2/${tot}</div><h2 style="text-align:center;color:#c9a84c;margin-bottom:.5rem">${ch.title}</h2><div class="subtitle">Chapter ${chNum}</div><div class="flowchart">${ch.groups.map((g, i) => `<div class="flow-box${i === 0 ? ' highlight' : ''}">${g.title}<br><span style="font-size:.8rem;color:#888">${g.sub}</span></div>${i < n - 1 ? '<div class="flow-arrow">⬇️</div>' : ''}`).join('')}</div></div>\n`;

  ch.groups.forEach((g, gi) => {
    sl += `<div class="slide" data-slide="${gi + 2}"><div class="slide-num">${gi + 3}/${tot}</div><h2 style="text-align:center;color:#c9a84c;margin-bottom:.3rem">${g.title}</h2><div class="subtitle">${g.sub}</div>${g.idx.map(i => card(heD[i] || '', enD[i] || '', i)).join('')}${g.c ? `<div class="callout"><div class="label">${g.c.l}</div>${g.c.t}</div>` : ''}</div>\n`;
  });

  const ps = 2 + n;
  sl += `<div class="slide" data-slide="${ps}"><div class="slide-num">${ps + 1}/${tot}</div><h2 style="text-align:center;color:#c9a84c;margin-bottom:.3rem">🎓 Key Principles</h2><div class="subtitle">Chapter ${chNum}</div><div class="flowchart" style="gap:.8rem">${ch.p.map(p => `<div class="flow-box highlight" style="width:100%;max-width:100%;text-align:right"><div style="font-size:1.5rem;margin-bottom:.3rem;text-align:center">${p.i}</div><strong>${p.t}</strong><br><span style="font-size:.9rem">${p.d}</span></div>`).join('')}</div></div>\n`;

  sl += `<div class="slide" data-slide="${ps + 1}"><div class="slide-num">${tot}/${tot}</div><div style="text-align:center;padding:3rem 1rem"><div style="font-size:4rem;margin-bottom:1rem">📝</div><h2 style="color:#c9a84c;font-size:1.8rem;margin-bottom:.5rem">Ready to Test Yourself?</h2><p style="color:#888;margin-bottom:.5rem">${secHe} פרק ${heCh}</p><p style="color:#666;margin-bottom:2rem;font-size:.9rem">5 questions · Multiple choice</p><a href="quiz.html" style="display:inline-block;background:#c9a84c;color:#1a1a1a;padding:1rem 2.5rem;border-radius:10px;text-decoration:none;font-weight:bold;font-size:1.2rem">Start Quiz →</a></div></div>`;

  return `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0,viewport-fit=cover"><title>${secHe} פרק ${heCh}</title><style>${CSS}</style></head><body><div class="nav"><a href="../">← ${secHe}</a><span class="title">פרק ${heCh} · Ch ${chNum}</span></div><div class="slide-wrap">${sl}</div><div class="controls"><button class="arrow" id="prev" onclick="go(-1)" disabled>→</button><div class="dots">${Array.from({ length: tot }, (_, i) => `<div class="dot${i === 0 ? ' active' : ''}" onclick="goTo(${i})"></div>`).join('')}</div><button class="arrow" id="next" onclick="go(1)">←</button></div><script>function toggleExpand(b){const c=b.closest('.halacha-card'),t=c.querySelector('.halacha-en');t.classList.contains('expanded')?(t.classList.remove('expanded'),b.textContent='Read full text ▼'):(t.classList.add('expanded'),b.textContent='Show less ▲')}let cur=0;const tot=${tot};function go(d){goTo(cur+d)}function goTo(n){if(n<0||n>=tot)return;document.querySelector('.slide.active').classList.remove('active');document.querySelectorAll('.slide')[n].classList.add('active');document.querySelector('.dot.active').classList.remove('active');document.querySelectorAll('.dot')[n].classList.add('active');cur=n;document.getElementById('prev').disabled=cur===0;document.getElementById('next').disabled=cur===tot-1;document.querySelector('.slide-wrap').scrollTop=0}document.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')go(1);if(e.key==='ArrowRight')go(-1)});let tx=0;document.addEventListener('touchstart',e=>{tx=e.touches[0].clientX},{passive:true});document.addEventListener('touchend',e=>{const d=tx-e.changedTouches[0].clientX;if(Math.abs(d)>50){d>0?go(1):go(-1)}},{passive:true});</script></body></html>`;
}

function buildQuiz(ch, secHe, chNum) {
  const heCh = heCNmap[chNum] || String(chNum);
  const qHtml = ch.quiz.map((q, qi) => `<div class="q" id="q${qi + 1}"><div class="q-num">Question ${qi + 1}</div><div class="q-text">${q.q}</div>${q.o.map((opt, oi) => `<button class="option" onclick="check(this,${oi === q.c})">${opt}</button>`).join('')}<div class="explanation">${q.e}</div></div>`).join('');

  return `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Quiz — ${secHe} פרק ${heCh}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#1a1a1a;color:#e0d5c1;font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh;padding:1rem}.container{max-width:600px;margin:0 auto}h1{color:#c9a84c;text-align:center;font-size:1.5rem;margin-bottom:.5rem}.subtitle{text-align:center;color:#888;margin-bottom:2rem;font-size:.9rem}.q{background:#222;border:1px solid #333;border-radius:10px;padding:1.2rem;margin-bottom:1.2rem}.q-text{color:#e0d5c1;font-size:1rem;margin-bottom:1rem;line-height:1.5;text-align:right}.q-num{color:#c9a84c;font-size:.85rem;margin-bottom:.5rem}.option{display:block;width:100%;text-align:right;background:#2a2520;border:1px solid #333;border-radius:8px;padding:.8rem 1rem;margin-bottom:.5rem;color:#e0d5c1;cursor:pointer;font-size:.95rem;transition:all .2s}.option:hover{border-color:#c9a84c}.option.correct{background:#1a3a1a;border-color:#4caf50;color:#4caf50}.option.wrong{background:#3a1a1a;border-color:#f44336;color:#f44336}.explanation{display:none;margin-top:.8rem;padding:.8rem;background:#1a1a1a;border-radius:8px;border:1px solid #333;color:#a89060;font-size:.9rem;line-height:1.4;text-align:right}.back{display:block;text-align:center;color:#c9a84c;text-decoration:none;margin-top:2rem;font-size:1rem}.score{display:none;text-align:center;margin-top:2rem;padding:1.5rem;background:#222;border:1px solid #c9a84c;border-radius:12px}.score h2{color:#c9a84c;font-size:1.5rem;margin-bottom:.5rem}</style></head><body><div class="container"><h1>🎓 Quiz</h1><div class="subtitle">${secHe} פרק ${heCh} · 5 Questions</div>${qHtml}<div class="score" id="score"><h2 id="score-text"></h2><p style="color:#888;margin-top:.5rem" id="score-sub"></p></div><a href="./" class="back">← Back to Chapter ${chNum}</a></div><script>let answered=0,correct=0;function check(btn,isCorrect){const q=btn.closest('.q');if(q.classList.contains('done'))return;q.classList.add('done');answered++;if(isCorrect){correct++;btn.classList.add('correct')}else{btn.classList.add('wrong')}q.querySelectorAll('.option').forEach(o=>o.style.pointerEvents='none');q.querySelector('.explanation').style.display='block';if(answered===5){const s=document.getElementById('score');s.style.display='block';document.getElementById('score-text').textContent=correct+'/5';const msgs=['Keep studying! 📖','Getting there! 💪','Not bad! 📚','Great job! 🌟','Perfect! 🎉'];document.getElementById('score-sub').textContent=msgs[correct]}}</script></body></html>`;
}

function buildSectionIndex(sec, chapters) {
  const dir = path.join(BASE_PATH, sec.dir);
  const chCount = Object.keys(chapters).length;
  const idx = `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${sec.secHe}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#1a1a1a;color:#e0d5c1;font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh;padding:1rem}.container{max-width:600px;margin:0 auto}h1{color:#c9a84c;text-align:center;font-size:1.8rem;margin-bottom:.3rem}.subtitle{text-align:center;color:#888;margin-bottom:2rem;font-size:.9rem}.back{display:block;text-align:center;color:#c9a84c;text-decoration:none;margin-bottom:2rem}.ch{display:block;background:#222;border:1px solid #333;border-radius:10px;padding:1.2rem;margin-bottom:.8rem;text-decoration:none;color:#e0d5c1;transition:all .2s}.ch:hover{border-color:#c9a84c;background:#2a2520}.ch-num{color:#c9a84c;font-size:.85rem}.ch-title{font-size:1.1rem;margin:.3rem 0}</style></head><body><div class="container"><h1>${sec.emoji} ${sec.secHe}</h1><div class="subtitle">${sec.secEn} · ${chCount} Chapters</div><a href="../" class="back">← ספר זמנים</a>${Object.entries(chapters).sort((a,b)=>parseInt(a[0])-parseInt(b[0])).map(([n, ch]) => `<a href="${n}/" class="ch"><div class="ch-num">פרק ${heCNmap[parseInt(n)]}׳</div><div class="ch-title">${ch.title}</div></a>`).join('')}</div></body></html>`;
  fs.writeFileSync(path.join(dir, 'index.html'), idx);
}

// ============ TRANSFORM API RESPONSE → INTERNAL FORMAT ============
function transformResponse(resp) {
  return {
    title: resp.title,
    groups: resp.groups.map(g => ({
      title: g.title,
      sub: g.sub,
      idx: g.idx,
      c: { l: g.calloutLabel, t: g.calloutText }
    })),
    p: resp.principles.map(p => ({ i: p.icon, t: p.title, d: p.desc })),
    quiz: resp.quiz.map(q => ({
      q: q.q,
      o: q.options,
      c: q.correct,
      e: q.explanation
    }))
  };
}

// ============ MAIN BUILD FUNCTION ============
async function buildChapter(sectionKey, chNum, dryRun = false) {
  const sec = SECTIONS[sectionKey];
  const dataFile = `/tmp/mt_${sec.prefix}_${chNum}.json`;
  
  if (!fs.existsSync(dataFile)) {
    console.error(`  ❌ Data file missing: ${dataFile}`);
    return null;
  }

  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const heD = (data.versions.find(v => v.language === 'he')?.text || []).map(clean);
  const enD = (data.versions.find(v => v.language === 'en')?.text || []).map(clean);
  const totalH = enD.length;

  if (totalH === 0) {
    console.error(`  ❌ No English text for ${sectionKey} ch${chNum}`);
    return null;
  }

  console.log(`  📖 ${sec.secEn} Ch${chNum} (${totalH}h) — generating content...`);

  // Call OpenAI
  const messages = buildPrompt(enD, sec.secEn, sec.secHe, chNum, totalH);
  let response;
  try {
    response = await callOpenAI(messages);
  } catch (e) {
    console.error(`  ❌ API error: ${e.message}`);
    return null;
  }

  const ch = transformResponse(response);

  if (dryRun) {
    console.log(`  ✅ DRY RUN — ${ch.title}`);
    console.log(`     Groups: ${ch.groups.map(g => g.title).join(' | ')}`);
    console.log(`     Quiz: ${ch.quiz.length} questions`);
    return ch;
  }

  // Build HTML
  const pageHtml = buildPage(ch, heD, enD, sec.secHe, sec.secEn, sec.emoji, sec.book, chNum);
  const quizHtml = buildQuiz(ch, sec.secHe, chNum);

  const dir = path.join(BASE_PATH, sec.dir, String(chNum));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), pageHtml);
  fs.writeFileSync(path.join(dir, 'quiz.html'), quizHtml);

  console.log(`  ✅ Ch${chNum} — ${ch.title} (${ch.groups.length} groups)`);
  return ch;
}

async function buildSection(sectionKey, specificChapters = null, dryRun = false) {
  const sec = SECTIONS[sectionKey];
  if (!sec) {
    console.error(`Unknown section: ${sectionKey}`);
    console.error(`Available: ${Object.keys(SECTIONS).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n🔨 Building ${sec.secEn} (${sec.secHe}) — ${sec.chapters} chapters`);
  
  const chapters = specificChapters || Array.from({ length: sec.chapters }, (_, i) => i + 1);
  const built = {};
  let count = 0;

  for (const chNum of chapters) {
    const ch = await buildChapter(sectionKey, chNum, dryRun);
    if (ch) {
      built[chNum] = ch;
      count++;
    }
    // Small delay to avoid rate limiting
    if (!dryRun) await new Promise(r => setTimeout(r, 1000));
  }

  if (!dryRun && count > 0) {
    buildSectionIndex(sec, built);
    console.log(`\n✅ ${sec.secEn}: ${count}/${chapters.length} chapters built`);
  }

  return count;
}

// ============ CLI ============
async function main() {
  const args = process.argv.slice(2);
  
  if (!OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not set');
    process.exit(1);
  }

  const dryRun = args.includes('--dry-run');
  const buildAll = args.includes('--all');
  
  let sectionKey = null;
  let specificChapters = null;

  const secIdx = args.indexOf('--section');
  if (secIdx !== -1 && args[secIdx + 1]) {
    sectionKey = args[secIdx + 1];
  }

  const chIdx = args.indexOf('--chapters');
  if (chIdx !== -1 && args[chIdx + 1]) {
    specificChapters = args[chIdx + 1].split(',').map(Number);
  }

  if (buildAll) {
    let total = 0;
    for (const key of Object.keys(SECTIONS)) {
      total += await buildSection(key, null, dryRun);
    }
    console.log(`\n🎉 Total built: ${total} chapters`);
  } else if (sectionKey) {
    await buildSection(sectionKey, specificChapters, dryRun);
  } else {
    console.log('Mishneh Torah Chapter Builder');
    console.log('Usage:');
    console.log('  node build-chapters.js --section <key>');
    console.log('  node build-chapters.js --section <key> --chapters 1,2,3');
    console.log('  node build-chapters.js --all');
    console.log('  node build-chapters.js --section <key> --dry-run');
    console.log('\nAvailable sections:');
    for (const [key, sec] of Object.entries(SECTIONS)) {
      console.log(`  ${key} — ${sec.secEn} (${sec.chapters}ch)`);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
