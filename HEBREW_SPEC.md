# Mishneh Torah Hebrew Version — Project Spec

## Overview
Hebrew-language version of the Mishneh Torah interactive learning site. Lives in the same repo as the English version under `/he/`. Same design, same structure — but all UI, group titles, callouts, principles, and quizzes are in Hebrew.

## Links
- **Live site**: https://y2jcpa.github.io/mishneh-torah/he/
- **English site**: https://y2jcpa.github.io/mishneh-torah/
- **Repo**: https://github.com/Y2JCPA/mishneh-torah (same repo, `/he/` directory)
- **Git email**: `yaacovtimes2@gmail.com`

## Current State (as of Mar 18, 2026)

### Already Done in Hebrew (143 chapters)
| Book | Hebrew | Sections Done | Chapters | Status |
|------|--------|--------------|----------|--------|
| Zemanim | ספר זמנים | 6 of 10 sections | 55 | ⚠️ Partial |
| Avodah | ספר עבודה | 8 of 8 sections | 68 | ✅ Complete |
| Zeraim | ספר זרעים | 4 of 7 sections | 20 | ⚠️ Partial |

### Missing Zemanim sections (not yet in Hebrew)
- שבת (Sabbath) — 30 chapters
- עירובין (Eruvin) — 8 chapters
- יום טוב (Rest on a Holiday) — 8 chapters
- יום הכיפורים (Rest on the Tenth) — 3 chapters
Total missing from Zemanim: 49 chapters

### Missing Zeraim sections (not yet in Hebrew)
- תרומות (Heave Offerings) — 15 chapters
- מתנות עניים (Gifts to the Poor) — 10 chapters
- ערלה ונטע רבעי (Orlah) — included partially?
Total missing from Zeraim: ~25 chapters

### Books Not Started in Hebrew (11 books, ~824 chapters)
| Book | Hebrew | Chapters | Priority |
|------|--------|----------|----------|
| Madda | ספר המדע | 46 | High (Book 1) |
| Ahavah | ספר אהבה | 46 | High (Book 2) |
| Nashim | ספר נשים | 53 | Medium |
| Kedushah | ספר קדושה | 53 | Medium |
| Hafla'ah | ספר הפלאה | 43 | Medium |
| Korbanot | ספר קרבנות | 45 | Medium |
| Taharah | ספר טהרה | 144 | Low (largest) |
| Nezikin | ספר נזיקין | 62 | Medium |
| Kinyan | ספר קניין | 75 | Medium |
| Mishpatim | ספר משפטים | 75 | Medium |
| Shoftim | ספר שופטים | 81 | Medium |

**Total remaining: ~869 chapters**

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

### Estimated Translatable Text Per Chapter
- ~15-25 short text blocks per chapter
- ~200-400 words total per chapter
- Sub-agent prompt: ~800 tokens input, ~600 tokens output
- Total for 869 chapters: ~1.2M tokens (very efficient)

## Architecture

### Step 1: Extract English Content
Script reads each English chapter's HTML and extracts:
```json
{
  "book": "zemanim",
  "section": "leavened-and-unleavened-bread",
  "chapter": 1,
  "title": "Leavened and Unleavened Bread",
  "groups": [
    {
      "title": "Chametz Prohibitions and Their Penalties",
      "sub": "הלכות א׳–ב׳",
      "callout_label": "📦 Core Prohibitions",
      "callout_text": "Eating chametz on Pesach carries karet..."
    }
  ],
  "principles": [
    { "icon": "⚖️", "title": "Karet for Chametz", "desc": "..." }
  ],
  "quiz": [
    {
      "q": "What is the penalty for...",
      "options": ["Lashes", "Karet", "Death", "Sin offering"],
      "correct": 1,
      "explanation": "Halacha 1: one who intentionally..."
    }
  ]
}
```

### Step 2: Translate via Sub-agents
Each sub-agent receives the extracted JSON and returns Hebrew translations:
```json
{
  "title": "הלכות חמץ ומצה",
  "groups": [
    {
      "title": "איסורי חמץ ועונשיהם",
      "callout_label": "📦 איסורים עיקריים",
      "callout_text": "אכילת חמץ בפסח חייבת כרת..."
    }
  ],
  "principles": [
    { "title": "כרת על חמץ", "desc": "..." }
  ],
  "quiz": [
    {
      "q": "מה העונש על...",
      "options": ["מלקות", "כרת", "מיתה", "חטאת"],
      "correct": 1,
      "explanation": "הלכה א: האוכל כזית חמץ..."
    }
  ]
}
```

### Step 3: Build Hebrew HTML
Builder script takes:
- Hebrew translation JSON (from step 2)
- Original English HTML as template (for halacha cards, which are already bilingual)
- Hebrew HTML template (CSS, layout — from existing `/he/` pages)

Generates: `he/{book}/{section}/{chapter}/index.html` + `quiz.html`

## Hebrew Page Template (from existing Book 3 — Zemanim)

### Lesson Page Structure
```
┌─────────────────────────────────┐
│ לרפואת פייגא בת יטא רבקה (banner)│
├─────────────────────────────────┤
│ ← nav: הלכות חמץ ומצה פרק א     │
│   chapter dots · ■ □ □ □ □ □ □   │
├─────────────────────────────────┤
│ SLIDE 1: Title slide             │
│   📖 ספר זמנים                   │
│   הלכות חמץ ומצה                 │
│   פרק א · 10 הלכות              │
├─────────────────────────────────┤
│ SLIDE 2-N: Group slides          │
│   Group title (Hebrew)           │
│   הלכות א׳–ב׳                   │
│   ┌─ Halacha card ─────────────┐ │
│   │ Hebrew text (from Sefaria) │ │
│   │ [toggle: English]          │ │
│   └────────────────────────────┘ │
│   ┌─ Callout box ──────────────┐ │
│   │ 📦 Label                   │ │
│   │ Hebrew summary text        │ │
│   └────────────────────────────┘ │
├─────────────────────────────────┤
│ SLIDE N+1: Flow diagram         │
│   Group1 ⬇️ Group2 ⬇️ Group3    │
│   (all Hebrew titles)           │
├─────────────────────────────────┤
│ SLIDE N+2: Quiz CTA             │
│   🎯 מוכן למבחן?               │
│   התחל מבחן →                   │
└─────────────────────────────────┘
```

### Quiz Page Structure
```
┌─────────────────────────────────┐
│ 🎓 מבחן                         │
│ הלכות חמץ ומצה פרק א · 5 שאלות  │
├─────────────────────────────────┤
│ שאלה 1                          │
│ מה העונש על אכילת כזית חמץ...?  │
│ ○ מלקות                         │
│ ● כרת              ← correct    │
│ ○ מיתה בידי שמים                │
│ ○ חטאת קבועה                    │
│ [explanation after answering]    │
│ הלכה א: האוכל כזית חמץ...       │
├─────────────────────────────────┤
│ ... שאלות 2-5 ...               │
├─────────────────────────────────┤
│ Score: X/5                       │
│ ← חזרה לפרק 1                   │
└─────────────────────────────────┘
```

### Hebrew UI Strings (constants)
```javascript
const UI_HE = {
  chapter: "פרק",
  halachot: "הלכות",
  questions: "שאלות",
  question: "שאלה",
  startQuiz: "התחל מבחן →",
  readyForQuiz: "🎯 מוכן למבחן?",
  quiz: "🎓 מבחן",
  backToChapter: "← חזרה לפרק",
  keyPrinciples: "עקרונות מפתח",
  correct: "✅ נכון!",
  incorrect: "❌ לא נכון",
  score: "ציון",
  nextChapter: "פרק הבא →",
  prevChapter: "← פרק קודם",
  backToSection: "← חזרה",
  englishVersion: "English Version →",
};

// Hebrew chapter numerals (already exist in English builder)
const HEB_NUMERALS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י",
  "יא", "יב", "יג", "יד", "טו", "טז", "יז", "יח", "יט", "כ",
  "כא", "כב", "כג", "כד", "כה", "כו", "כז", "כח", "כט", "ל"];
```

### Section Index Pages
Each section (e.g., `he/zemanim/chametz-umatzah/index.html`) has a chapter list:
```html
<a href="1/" class="chapter">
  <span class="ch-num">פרק א׳</span>
  <span class="ch-title">Hebrew chapter title</span>
</a>
```

### Book Index Pages
Each book (e.g., `he/zemanim/index.html`) lists sections:
```html
<a href="chametz-umatzah/" class="book">
  <div class="book-title">🍞 הלכות חמץ ומצה</div>
  <div class="book-sub">9 פרקים</div>
</a>
```

### Hebrew Homepage (`he/index.html`)
Lists all 14 books with link back to English version.

## Directory Structure
```
mishneh-torah/
├── he/
│   ├── index.html              ← Hebrew homepage (all 14 books)
│   ├── madda/
│   │   ├── index.html          ← Book index
│   │   ├── foundations-of-the-torah/
│   │   │   ├── index.html      ← Section index (chapter list)
│   │   │   ├── 1/
│   │   │   │   ├── index.html  ← Lesson page
│   │   │   │   └── quiz.html   ← Quiz page
│   │   │   ├── 2/
│   │   │   ...
│   │   ├── human-dispositions/
│   │   ...
│   ├── zemanim/                 ← (partially exists)
│   ...
```

## Pipeline

### Scripts Needed
1. **`extract_english.js`** — Reads all English chapter HTML files, extracts translatable content into JSON files
   - Input: `{book}/{section}/{chapter}/index.html` + `quiz.html`
   - Output: `/tmp/he_translate/{book}_{section}_ch{N}.json`

2. **`translate_chapter.js`** — Sub-agent prompt template for translating one chapter's content
   - Input: extracted English JSON
   - Output: Hebrew translation JSON

3. **`build_hebrew.js`** — Builder script that generates Hebrew HTML from translations + original halacha data
   - Input: Hebrew translation JSON + English HTML (for halacha cards)
   - Output: `he/{book}/{section}/{chapter}/index.html` + `quiz.html`

4. **`build_hebrew_indexes.js`** — Generates section index, book index, and homepage
   - Input: Section/book metadata + chapter titles
   - Output: index.html files at each level

### Sub-agent Config
- **Model**: `sonnet` (good quality Hebrew, fast)
- **Batch size**: 10 chapters per sub-agent (they're just translating, not generating)
- **Max concurrent**: 5 sub-agents
- **Timeout**: 120s per batch
- **Estimated time**: ~1-2 hours for all 869 chapters

### Translation Prompt Template
```
You are translating Mishneh Torah study content from English to Hebrew.
Translate ONLY the English text. Keep all emojis, HTML tags, and Hebrew source references unchanged.

Rules:
- Use modern Hebrew, clear and accessible
- Halachic terms should use standard Hebrew terminology (כרת, מלקות, חטאת, etc.)
- Quiz questions should be natural Hebrew questions, not word-for-word translation
- Keep explanations concise — reference הלכה number as in the source
- Group titles should be descriptive Hebrew titles (2-5 words)
- Principle titles: 2-4 word Hebrew titles
- DO NOT translate the halacha text itself (it's already in Hebrew from Sefaria)

Input JSON:
{extracted_english_json}

Return ONLY valid JSON with the same structure, all English text replaced with Hebrew.
```

## Quality Checks
- [ ] Compare 5 random translated chapters against existing Hebrew chapters for consistency
- [ ] Verify all quiz answers are correct (correct index preserved from English)
- [ ] Verify halacha card Hebrew text renders properly (RTL, nikud if present)
- [ ] Verify navigation links between chapters, sections, books
- [ ] Verify homepage lists all 14 books
- [ ] Cross-link: each Hebrew page links to its English equivalent and vice versa

## Existing Hebrew Chapters — Keep or Redo?
**Keep them.** The 143 existing Hebrew chapters were hand-crafted and are high quality. The translation pipeline should:
1. Skip chapters that already exist in `/he/`
2. Only generate missing chapters
3. Existing section/book indexes may need updating to include new chapters

## Deployment
Same as English — push to `main` branch, GitHub Pages auto-deploys.
No separate build step needed (static HTML).

## Lessons (from English build)
- Always batch large sections (>15 chapters) into groups of ~10 for sub-agents
- Save progress frequently — don't let 30+ chapters build in memory
- Check for existing files before regenerating
- Hebrew numerals beyond כ״ח need special handling (כ״ט = 29, ל׳ = 30, etc.)
