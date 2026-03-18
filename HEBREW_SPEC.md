# Mishneh Torah Hebrew Version — Project Spec

## Overview
Hebrew-language version of the Mishneh Torah interactive learning site. Lives in the same repo as the English version under `/he/`. Same design, same structure — but all UI, group titles, callouts, principles, and quizzes are in Hebrew.

## Links
- **Live site**: https://y2jcpa.github.io/mishneh-torah/he/
- **English site**: https://y2jcpa.github.io/mishneh-torah/
- **Repo**: https://github.com/Y2JCPA/mishneh-torah (same repo, `/he/` directory)
- **Git email**: `yaacovtimes2@gmail.com`

## Current State (as of Mar 18, 2026)

### Completed in Hebrew
| Book | Hebrew | Chapters | Status |
|------|--------|----------|--------|
| Zemanim | ספר זמנים | 55 of 109 | ⚠️ Partial (pre-existing) |
| Avodah | ספר עבודה | 68 of 95 | ⚠️ Partial (pre-existing) |
| Zeraim | ספר זרעים | 20 of 85 | ⚠️ Partial (pre-existing) |
| **Nashim** | **ספר נשים** | **53 of 53** | **✅ Complete (translated via pipeline)** |

### Total Hebrew chapters: ~196 of 1,012

### Remaining Books (not yet in Hebrew)
| Book | Hebrew | Chapters | Notes |
|------|--------|----------|-------|
| Madda | ספר המדע | 46 | High priority (Book 1) |
| Ahavah | ספר אהבה | 46 | High priority (Book 2) |
| Kedushah | ספר קדושה | 53 | |
| Hafla'ah | ספר הפלאה | 43 | |
| Korbanot | ספר קרבנות | 45 | |
| Taharah | ספר טהרה | 144 | Largest book |
| Nezikin | ספר נזיקין | 62 | |
| Kinyan | ספר קניין | 75 | |
| Mishpatim | ספר משפטים | 75 | |
| Shoftim | ספר שופטים | 81 | |
| Zemanim (gaps) | ספר זמנים | ~54 | Sabbath, Eruvin, Holiday, Yom Kippur |
| Avodah (gaps) | ספר עבודה | ~27 | Partial sections |
| Zeraim (gaps) | ספר זרעים | ~65 | Heave Offerings, Gifts to Poor, etc. |

**Total remaining: ~816 chapters**

## Strategy: Translate from English, Don't Regenerate

The full English version is complete (1,012 chapters). Instead of re-fetching from Sefaria and regenerating content from scratch, we translate the English-generated content to Hebrew. This is 5-10x cheaper in tokens.

### What Needs Translating Per Chapter
Each English chapter has these translatable text elements:

**Lesson page (index.html):**
1. **Page title** — e.g., "Leavened and Unleavened Bread · Chapter 1" → "הלכות חמץ ומצה פרק א"
2. **Group titles** (2-5 per chapter) — e.g., "Chametz Prohibitions and Their Penalties" → "איסורי חמץ ועונשיהם"
3. **Callout/flow-box text** — summary boxes within each group (1 per group)
4. **Key Principles** (4 per chapter) — title + description
5. **UI chrome** — "Chapter X · Y Halachot", "Start Quiz →", "Key Principles", etc.

**Quiz page (quiz.html):**
6. **5 quiz questions** — question text + 4 answer options + explanation
7. **UI chrome** — "Question 1", "5 Questions", "Back to Chapter X", etc.

**NOT translated (stays Hebrew already):**
- The actual halacha text (Hebrew source from Sefaria) — already in Hebrew
- Halacha references (הלכות א׳–ה׳) — already in Hebrew

## Pipeline (proven with Nashim build)

### Step 1: Extract English Content
**Script**: `/tmp/extract_english_v2.js`
```
node /tmp/extract_english_v2.js <book> <repo_dir> <output_dir>
# Example: node /tmp/extract_english_v2.js nashim /tmp/mishneh-torah /tmp/he_translate
```
- Reads each English chapter's `index.html` + `quiz.html`
- Extracts: section title, group titles, callout labels/text, principles (title+desc), quiz (question+options+correct+explanation)
- Outputs: `/tmp/he_translate/{book}_{section}_ch{N}.json`
- **Extraction patterns** (learned from Nashim build):
  - Group titles: `<h2>` tags (skip first = section title, skip "Key Principles" and "Ready to Test")
  - Callouts: `class="callout"` divs — emoji is first char, rest is text
  - Principles: text blocks after "Key Principles" heading, parsed as title/desc pairs
  - Quiz: from separate `quiz.html` — question text after "Question N", then 4 options, then explanation
  - Correct answers: extracted from `check(this, true/false)` onclick handlers

### Step 2: Translate via Sub-agents
**Spawn pattern** (optimized from Nashim experience):
```
sessions_spawn with:
  model: sonnet
  mode: run
  runTimeoutSeconds: 300
  batch size: 2-3 files per agent (NOT 5+)
  max concurrent: 5 agents
```

**Critical instruction for sub-agents**: Include "WRITE EACH FILE IMMEDIATELY after translating it" in the prompt. Agents that translate all files first then write tend to timeout before writing.

**Translation prompt** (proven effective):
```
Translate Mishneh Torah chapters from English to Hebrew. Read each file, 
translate ALL English text to Hebrew, WRITE IMMEDIATELY after each translation.
mkdir -p /tmp/he_translated first.

Keep JSON structure, "book","section","chapter" unchanged, emojis unchanged, 
"sub" fields unchanged. Use standard halachic Hebrew.
```

### Step 3: Fix JSON Issues
After translation, validate all JSON files:
```python
for f in nashim_*.json:
    python3 -c "import json; json.load(open('$f'))" 2>/dev/null || echo "INVALID: $f"
```
**Common issues found in Nashim build:**
- `""word""` — doubled quotes from Hebrew abbreviations. Fix: replace `""` with `\"`
- `ט"ו` — Hebrew date abbreviations with unescaped ASCII quotes. Fix: regex replace Hebrew+`"`+Hebrew with Hebrew gershayim (״)
- Control characters — rare, fix with targeted regex

### Step 4: Build Hebrew HTML
**Script**: `/tmp/build_hebrew.js`
```
node /tmp/build_hebrew.js <translated_dir> <repo_dir> <book>
# Example: node /tmp/build_hebrew.js /tmp/he_translated /tmp/mishneh-torah nashim
```
- Reads translated JSON + original English HTML (extracts halacha cards with Hebrew/English text)
- Generates `he/{book}/{section}/{chapter}/index.html` + `quiz.html`
- **IMPORTANT**: Builder needs section metadata (Hebrew names, chapter counts, icons) hardcoded per book. Update the `SECTIONS` object in `build_hebrew.js` for each new book.

### Step 5: Build Index Pages
Python script builds:
- Section index pages (`he/{book}/{section}/index.html`) — chapter list
- Book index page (`he/{book}/index.html`) — section list
- Updates Hebrew homepage (`he/index.html`) — add new book link

### Step 6: Deploy
```bash
cd /tmp/mishneh-torah
git add -A
git commit -m "Add Hebrew Sefer X: N chapters (...)"
git push
```
GitHub Pages auto-deploys.

## Lessons Learned (from Nashim build, Mar 18 2026)

### Sub-agent Timing
- **5-minute timeout is tight** for 5+ chapters. Agents spend ~1-2 min reading files, ~2-3 min translating, then run out of time writing.
- **2-3 files per agent is optimal**. Agents reliably complete 2-3 translations within 5 minutes.
- **5 files per agent works but often produces partial results** — some files get written, some don't.
- **"Write immediately" instruction is critical**. Without it, agents buffer all translations in memory and try to write at the end, often timing out.
- **Multiple rounds are normal**. Expect 2-3 rounds of spawning agents to cover all chapters. After each round, check which files are still missing and respawn for those.

### Token Usage
- Nashim (53 chapters) used approximately 130K tokens total across all sub-agents
- That's ~2.5K tokens per chapter on average (very efficient)
- Translation-only approach is confirmed 5-10x cheaper than full content generation

### JSON Validation
- **Always validate JSON after translation before building HTML**. Sub-agents sometimes produce invalid JSON with Hebrew quote characters.
- Hebrew abbreviations like ט"ו, י"ג use ASCII double-quote which breaks JSON. Fix with: `re.sub(r'([\u0590-\u05FF])"([\u0590-\u05FF])', r'\1״\2', content)` (replace with Hebrew gershayim ״)
- Run validation loop and fix before building.

### HTML Builder
- The English HTML structure varies slightly across books/chapters. The extractor handles: `<h2>` group titles, `class="callout"` boxes, inline-styled principle blocks, separate `quiz.html` files.
- Filter out meta-groups like "Ready to Test Yourself?" and "🎓 Key Principles" from the groups array before building.
- Halacha cards are extracted from English HTML (they contain both Hebrew source and English translation) and placed into Hebrew pages with an "English ↕" toggle.

### Existing Hebrew Chapters
- **Keep them.** The pre-existing 143 chapters (Zemanim partial, Avodah, Zeraim partial) were hand-crafted and differ slightly in structure from the pipeline output.
- The pipeline should **skip** any section that already has chapters in `/he/`.
- When filling gaps in partially-complete books (e.g., adding Sabbath to Zemanim), check which chapters already exist before generating.

### Process Summary (cookbook for next book)
1. `node /tmp/extract_english_v2.js <book> /tmp/mishneh-torah /tmp/he_translate`
2. Spawn sub-agents: 2-3 files each, sonnet, 300s timeout, "write immediately"
3. Monitor: check `ls /tmp/he_translated/<book>_*.json | wc -l` between rounds
4. Respawn for missing files until all are done
5. Validate JSON: fix Hebrew quote issues
6. `node /tmp/build_hebrew.js /tmp/he_translated /tmp/mishneh-torah <book>`
7. Build index pages (section + book + update homepage)
8. `git add -A && git commit && git push`

## File Locations
- **Extractor script**: `/tmp/extract_english_v2.js`
- **Builder script**: `/tmp/build_hebrew.js`
- **Extracted English JSONs**: `/tmp/he_translate/{book}_{section}_ch{N}.json`
- **Translated Hebrew JSONs**: `/tmp/he_translated/{book}_{section}_ch{N}.json`
- **Repo clone**: `/tmp/mishneh-torah/`
- **Hebrew pages**: `/tmp/mishneh-torah/he/{book}/{section}/{chapter}/`

## Section Metadata Registry
Each book needs its sections defined for the builder. Here's what's been configured:

### Nashim (complete)
```javascript
{
  'marriage': { he: 'הלכות אישות', chapters: 25, icon: '💍' },
  'divorce': { he: 'הלכות גירושין', chapters: 13, icon: '📜' },
  'levirate-marriage-and-release': { he: 'הלכות ייבום וחליצה', chapters: 8, icon: '👞' },
  'virgin-maiden': { he: 'הלכות נערה בתולה', chapters: 3, icon: '⚖️' },
  'woman-suspected-of-infidelity': { he: 'הלכות סוטה', chapters: 4, icon: '🏛️' },
}
```

### For future books
- Check English repo directory names: `ls /tmp/mishneh-torah/<book>/`
- Map each directory to its Hebrew name + chapter count + emoji
- Add to the `SECTIONS` object in `build_hebrew.js`
