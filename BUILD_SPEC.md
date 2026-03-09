# Mishneh Torah Builder — Spec Sheet

## What This Is
An automated build system for the Mishneh Torah interactive study site.
It reads halachot from Sefaria API data, sends them to a model to generate
structured chapter content (groupings, callouts, principles, quizzes), then
builds static HTML pages with slides, Hebrew/English text, and interactive quizzes.

## Architecture

```
Sefaria JSON data (/tmp/mt_<section>_<ch>.json)
        ↓
build-chapters.js (reads data, calls model API)
        ↓
Structured chapter JSON (groups, callouts, principles, quiz)
        ↓
HTML builder (proven template from TEMPLATE_PEREK.html)
        ↓
Static HTML files → GitHub Pages
```

## Key Files

| File | Purpose |
|------|---------|
| `/tmp/mishneh-torah/build-chapters.js` | Main build script — run this |
| `/tmp/mishneh-torah/TEMPLATE_PEREK.html` | CSS template (extracted by builder) |
| `/tmp/mishneh-torah/BUILD_SPEC.md` | This file — how everything works |
| `/tmp/mishneh-torah/sections.json` | Section definitions (names, prefixes, paths, chapter counts) |
| `/tmp/mt_<prefix>_<ch>.json` | Raw Sefaria data per chapter |

## How to Run

```bash
# Build one section:
node /tmp/mishneh-torah/build-chapters.js --section shofar-sukkah-lulav

# Build all remaining sections:
node /tmp/mishneh-torah/build-chapters.js --all

# Build specific chapters:
node /tmp/mishneh-torah/build-chapters.js --section taaniyot --chapters 1,2,3

# Dry run (generate content JSON without building HTML):
node /tmp/mishneh-torah/build-chapters.js --section taaniyot --dry-run
```

## Sefaria Data

Raw chapter data is fetched from Sefaria API v3 and cached as JSON:
- `/tmp/mt_<prefix>_<ch>.json`
- Each has `versions[]` with `language: 'he'|'en'` and `text: string[]`

### Fetching missing data:
```bash
# Example: fetch Shofar/Sukkah/Lulav chapter 1
curl -s "https://www.sefaria.org/api/v3/texts/Mishneh_Torah%2C_Shofar%2C_Sukkah%2C_and_Lulav.1?version=english&version=hebrew" > /tmp/mt_shofar-sukkah-lulav_1.json
```

### Section prefixes and API names:
| Section | Prefix | Sefaria API Name | Chapters |
|---------|--------|-------------------|----------|
| Shabbat | sabbath | Sabbath | 30 |
| Eruvin | eruvin | Eruvin | 8 |
| Shevitat Asor | shevitat-asor | Rest_on_the_Tenth_of_Tishrei | 3 |
| Shevitat Yom Tov | shevitat-yomtov | Rest_on_a_Holiday | 8 |
| Chametz uMatzah | chametz-matzah | Leavened_and_Unleavened_Bread | 8 |
| Shofar/Sukkah/Lulav | shofar-sukkah-lulav | Shofar%2C_Sukkah%2C_and_Lulav | 8 |
| Shekalim | shekalim | Sheqel_Dues | 4 |
| Kiddush HaChodesh | kiddush-hachodesh | Sanctification_of_the_New_Month | 19 |
| Taaniyot | taaniyot | Fasts | 5 |
| Megillah/Chanukah | megillah-chanukah | Scroll_of_Esther_and_Hanukkah | 4 |

## Content Quality Standard

Each chapter MUST have:
1. **Groups**: 2-5 thematic groupings of halachot with:
   - Meaningful titles (NOT "Part 1", "Part 2")
   - Halacha index ranges matching actual content
   - A callout box synthesizing the group's theme
2. **Key Principles**: 4 principles with emoji, title, description — unique to the chapter
3. **Quiz**: 5 multiple-choice questions testing specific halachot from the chapter, with substantive explanations

### What "quality" means:
- Group titles reflect what's ACTUALLY in those halachot (e.g., "The Craftsman's Practice Prohibition" not "More Rules")
- Callouts synthesize themes, not just summarize
- Quiz questions reference specific halachot content, not general knowledge
- Principles are unique to this chapter, not generic

## Chapter Data Object Format

```javascript
{
  title: 'Chapter Title — Descriptive',
  groups: [
    {
      title: 'Group Title',
      sub: 'הלכות א׳–ה׳',  // Hebrew range
      idx: [0, 1, 2, 3, 4],  // 0-based indices into halachot array
      c: {
        l: '🔥 Callout Label',  // emoji + short label
        t: 'Callout text with <strong>HTML</strong> allowed...'
      }
    }
  ],
  p: [
    { i: '🔥', t: 'Principle Title', d: 'Description text' }
  ],
  quiz: [
    {
      q: 'Question text?',
      o: ['Option A', 'Option B', 'Option C', 'Option D'],
      c: 1,  // correct answer index (0-based)
      e: 'Explanation text'
    }
  ]
}
```

## HTML Structure

Each chapter generates:
- `<section>/<ch>/index.html` — Slide-based lesson
- `<section>/<ch>/quiz.html` — Interactive quiz

Slides:
1. Title slide (book, section, chapter info)
2. Overview/flowchart slide
3. One slide per group (halacha cards + callout)
4. Key principles slide
5. Quiz CTA slide

## Theme
- Background: #1a1a1a
- Gold accents: #c9a84c
- Text: #e0d5c1
- Hebrew serif: David/Noto Serif Hebrew
- Cards: #222 with #333 borders

## Hebrew Numerals
```javascript
const heCNmap = {1:'א',2:'ב',3:'ג',4:'ד',5:'ה',6:'ו',7:'ז',8:'ח',9:'ט',
  10:'י',11:'י״א',12:'י״ב',13:'י״ג',14:'י״ד',15:'ט״ו',16:'ט״ז',
  17:'י״ז',18:'י״ח',19:'י״ט',20:'כ',21:'כ״א',22:'כ״ב',23:'כ״ג',
  24:'כ״ד',25:'כ״ה',26:'כ״ו',27:'כ״ז'};
```

## Site Structure
```
/tmp/mishneh-torah/
├── index.html          (root — all 14 books)
├── madda/              (Book 1 — 46ch COMPLETE)
├── ahavah/             (Book 2 — 46ch COMPLETE)
├── zemanim/            (Book 3 — 57/96ch, building)
│   ├── sabbath/        (30ch ✅)
│   ├── eruvin/         (8ch ✅)
│   ├── rest-on-the-tenth-of-tishrei/ (3ch ✅)
│   ├── rest-on-a-holiday/ (8ch ✅)
│   ├── leavened-and-unleavened-bread/ (8ch ⚠️ bulk)
│   └── ... (5 sections remaining)
├── nashim/             (Book 4 — placeholder)
├── ...                 (Books 5-14 — placeholders)
└── TEMPLATE_PEREK.html
```

## GitHub
- Repo: https://github.com/Y2JCPA/mishneh-torah
- Pages: https://y2jcpa.github.io/mishneh-torah/
- Branch: main
- Git user: yaacovtimes2@gmail.com

## Model Usage
- Content generation: GPT-4o-mini via OpenAI API (cheap, good for structured output)
- Key in env: OPENAI_API_KEY
- Falls back to spawning a Sonnet sub-agent if needed
